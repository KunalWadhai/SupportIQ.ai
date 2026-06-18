#!/usr/bin/env bash
# Deploy SupportIQ AI Service to AWS Lambda (container image)
# Usage: ./scripts/deploy-lambda.sh
# Loads AWS + app config from repo root .env

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SERVICE_DIR="$ROOT/services/ai-service"
ENV_FILE="$ROOT/.env"

STAGE="${STAGE:-staging}"
FUNCTION_NAME="supportiq-ai-service-${STAGE}"
ECR_REPO="supportiq-ai-service-${STAGE}"
ROLE_NAME="supportiq-ai-lambda-role-${STAGE}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
set -a && source "$ENV_FILE" && set +a

: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID in .env}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY in .env}"
: "${AWS_REGION:?Set AWS_REGION in .env}"
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY in .env}"
: "${QDRANT_URL:?Set QDRANT_URL in .env}"
: "${QDRANT_API_KEY:?Set QDRANT_API_KEY in .env}"

export AWS_DEFAULT_REGION="$AWS_REGION"
REDIS_URL="${REDIS_URL:-}"

echo "🔐 Verifying AWS credentials..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "   Account: $ACCOUNT_ID  Region: $AWS_REGION"

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_URI="${ECR_URI}:${IMAGE_TAG}"

echo "📦 Ensuring ECR repository ${ECR_REPO}..."
aws ecr describe-repositories --repository-names "$ECR_REPO" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$ECR_REPO" --image-scanning-configuration scanOnPush=true

echo "🐳 Logging in to ECR..."
aws ecr get-login-password | docker login --username AWS --password-stdin \
  "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "🔨 Building Lambda container image (linux/amd64)..."
docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  -f "$SERVICE_DIR/Dockerfile.lambda" \
  -t "$IMAGE_URI" \
  --load \
  "$SERVICE_DIR"

echo "⬆️  Pushing image to ECR..."
docker push "$IMAGE_URI"

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text 2>/dev/null || true)

if [[ -z "$ROLE_ARN" ]]; then
  echo "👤 Creating IAM role ${ROLE_NAME}..."
  TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST" \
    --description "SupportIQ AI Lambda execution role"
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "   Waiting for IAM role propagation..."
  sleep 10
  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
fi

echo "λ  Deploying Lambda function ${FUNCTION_NAME}..."
if aws lambda get-function --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --image-uri "$IMAGE_URI" \
    --architectures x86_64
  aws lambda wait function-updated --function-name "$FUNCTION_NAME"
else
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --package-type Image \
    --code "ImageUri=${IMAGE_URI}" \
    --role "$ROLE_ARN" \
    --timeout 300 \
    --memory-size 2048 \
    --architectures x86_64
  aws lambda wait function-active-v2 --function-name "$FUNCTION_NAME" 2>/dev/null \
    || aws lambda wait function-active --function-name "$FUNCTION_NAME"
fi

echo "⚙️  Updating environment variables..."
ENV_JSON=$(jq -n \
  --arg openai "$OPENAI_API_KEY" \
  --arg qdrant_url "$QDRANT_URL" \
  --arg qdrant_key "$QDRANT_API_KEY" \
  --arg redis "$REDIS_URL" \
  '{Variables: {OPENAI_API_KEY: $openai, QDRANT_URL: $qdrant_url, QDRANT_API_KEY: $qdrant_key, REDIS_URL: $redis}}')
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --environment "$ENV_JSON" \
  --timeout 300 \
  --memory-size 2048
aws lambda wait function-updated --function-name "$FUNCTION_NAME"

echo "🔗 Ensuring public HTTPS endpoint..."
FUNCTION_URL=""
if aws lambda create-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --auth-type NONE \
    --invoke-mode BUFFERED >/dev/null 2>&1 \
  || aws lambda get-function-url-config --function-name "$FUNCTION_NAME" >/dev/null 2>&1; then
  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE 2>/dev/null || true
  FUNCTION_URL=$(aws lambda get-function-url-config --function-name "$FUNCTION_NAME" --query FunctionUrl --output text)
else
  echo "   Function URL unavailable (IAM). Using API Gateway HTTP API..."
  API_NAME="$FUNCTION_NAME"
  EXISTING_API=$(aws apigatewayv2 get-apis --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text 2>/dev/null || true)
  if [[ -z "$EXISTING_API" || "$EXISTING_API" == "None" ]]; then
    FUNCTION_ARN=$(aws lambda get-function --function-name "$FUNCTION_NAME" --query Configuration.FunctionArn --output text)
    API_ID=$(aws apigatewayv2 create-api \
      --name "$API_NAME" \
      --protocol-type HTTP \
      --target "$FUNCTION_ARN" \
      --query ApiId --output text)
    aws lambda add-permission \
      --function-name "$FUNCTION_NAME" \
      --statement-id "apigateway-invoke-${STAGE}" \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*" 2>/dev/null || true
  else
    API_ID="$EXISTING_API"
  fi
  FUNCTION_URL=$(aws apigatewayv2 get-api --api-id "$API_ID" --query ApiEndpoint --output text)
fi

# Trim trailing slash for consistency
FUNCTION_URL="${FUNCTION_URL%/}"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Lambda deployed successfully!"
echo ""
echo "   AI_SERVICE_URL (set on Render + GitHub Variables):"
echo "   ${FUNCTION_URL}"
echo ""
echo "   GitHub Variables to add:"
echo "   AWS_LAMBDA_FUNCTION_NAME=${FUNCTION_NAME}"
echo "   AWS_ECR_REPOSITORY=${ECR_URI}"
echo "   AI_SERVICE_URL=${FUNCTION_URL}"
echo ""
echo "   Test health:"
echo "   curl ${FUNCTION_URL}/health"
echo "════════════════════════════════════════════════════════════"
