# Deployment Guide — Render · Vercel · AWS Lambda

This project deploys three services from the `develop` branch via GitHub Actions (`.github/workflows/ci.yml`):

| Service | Platform | CI job |
|---------|----------|--------|
| `apps/api-gateway` | **Render** (Web Service) | `deploy-api-gateway` |
| `apps/web` | **Vercel** (Next.js) | `deploy-web` |
| `services/ai-service` | **AWS Lambda** (container image) | `deploy-ai-service` |

All deploy jobs run **after** CI passes (`node-ci`, `python-ci`, `docker-build`).

---

## Architecture after deploy

```
Vercel (web)  ──►  Render (api-gateway)  ──►  AWS Lambda (ai-service)
                         │                           │
                    PostgreSQL                   Qdrant Cloud
                    Redis (Upstash)              OpenAI API
                    S3 / MinIO
```

Set `AI_SERVICE_URL` on Render to your **Lambda Function URL** (from AWS SAM output).

---

## 1. API Gateway → Render

### One-time Render setup

1. Create account at [render.com](https://render.com)
2. **New → Blueprint** → connect this GitHub repo → apply `render.yaml`  
   **OR** create a **Web Service** manually:
   - **Root directory:** `.` (repo root)
   - **Branch:** `develop`
   - **Runtime:** Node
   - **Build command:**
     ```bash
     npm ci --include=dev && npx prisma generate --schema=apps/api-gateway/prisma/schema.prisma && npm run build --workspace=apps/api-gateway
     ```
   - **Start command:**
     ```bash
     npx prisma migrate deploy --schema=apps/api-gateway/prisma/schema.prisma && node apps/api-gateway/dist/index.js
     ```
   - **Health check path:** `/health`

3. In Render → your service → **Environment**, add all secrets (same as production `.env`):
   - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `OPENAI_API_KEY`
   - `AI_SERVICE_URL` → Lambda Function URL (see section 3)
   - `QDRANT_URL`, `QDRANT_API_KEY`, MinIO/S3 vars, `ALLOWED_ORIGINS`

4. Render → **Settings → Deploy Hook** → copy URL

### GitHub secret

| Secret | Where to get it |
|--------|-----------------|
| `RENDER_DEPLOY_HOOK_URL` | Render → api-gateway service → Settings → Deploy Hook |

### How CI deploys

On every push to `develop`, the workflow POSTs to the deploy hook. Render pulls the latest code and rebuilds.

---

## 2. Web → Vercel

### One-time Vercel setup

1. Create account at [vercel.com](https://vercel.com)
2. **Add New Project** → import this GitHub repo
3. Configure:
   - **Root Directory:** `apps/web`
   - **Framework:** Next.js (auto-detected)
   - `vercel.json` in `apps/web` handles monorepo install/build commands

4. **Environment Variables** (Production):
   - `NEXT_PUBLIC_API_URL` → `https://your-api.onrender.com`
   - `NEXT_PUBLIC_APP_URL` → `https://your-app.vercel.app`
   - `API_INTERNAL_URL` → same as `NEXT_PUBLIC_API_URL` (or Render internal URL)

5. Get IDs from Vercel:
   - **Account/Team ID:** Vercel → Settings → General → Team ID → `VERCEL_ORG_ID`
   - **Project ID:** Project → Settings → General → Project ID → `VERCEL_PROJECT_ID`
   - **Token:** Account → Tokens → Create → `VERCEL_TOKEN`

### GitHub configuration

| Type | Name | Example |
|------|------|---------|
| Secret | `VERCEL_TOKEN` | `vercel_xxx...` |
| Variable | `VERCEL_ORG_ID` | `team_xxx` |
| Variable | `VERCEL_PROJECT_ID` | `prj_xxx` |
| Variable | `NEXT_PUBLIC_API_URL` | `https://supportiq-api.onrender.com` |
| Variable | `NEXT_PUBLIC_APP_URL` | `https://supportiq.vercel.app` |

### How CI deploys

Uses `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` with your token.

---

## 3. AI Service → AWS Lambda (container)

### Why container image (not zip)?

This service uses **LangChain**, **unstructured**, **pypdf**, and **poppler**. A zip deployment exceeds Lambda's **250 MB** unzipped limit. Use a **container image** (up to **10 GB**).

### AWS requirements checklist

| Requirement | Details |
|-------------|---------|
| **AWS account** | With IAM user/role for CI |
| **ECR repository** | Stores Lambda container images |
| **Lambda function** | `PackageType: Image`, Python 3.11 |
| **Function URL** | Public HTTPS endpoint for api-gateway |
| **IAM permissions** | CI user needs ECR push + Lambda update |
| **Memory** | **2048 MB** minimum (embeddings + LangChain) |
| **Timeout** | **300 s** (5 min) for document ingestion |
| **Architecture** | `x86_64` |
| **Invoke mode** | `RESPONSE_STREAM` for SSE `/query/stream` |

### Python packages for Lambda

File: `services/ai-service/requirements-lambda.txt`

```
-r requirements.txt
mangum>=0.17.0,<0.19.0
```

**Mangum** adapts FastAPI (ASGI) → Lambda handler. Entrypoint: `lambda_handler.py`.

System packages in `Dockerfile.lambda` (via `yum`):
- `gcc`, `gcc-c++` — compile Python extensions
- `libmagic` — file type detection (unstructured)
- `poppler-utils` — PDF parsing

### One-time AWS setup (SAM)

```bash
# Install AWS SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

cd services/ai-service

# Create ECR repo (if not using SAM to create it)
aws ecr create-repository --repository-name supportiq-ai-service-staging --region ap-south-2

# First deploy — creates Lambda + Function URL
sam build --use-container -t template.yaml
sam deploy --guided \
  --parameter-overrides \
    Stage=staging \
    OpenAIApiKey=sk-... \
    QdrantUrl=https://your-cluster.qdrant.io \
    QdrantApiKey=... \
    RedisUrl=rediss://...
```

After deploy, note the outputs:
- **FunctionUrl** → set as `AI_SERVICE_URL` on Render + GitHub Variable
- **FunctionName** → `AWS_LAMBDA_FUNCTION_NAME`
- Create/ note ECR URI → `AWS_ECR_REPOSITORY` (e.g. `123456789.dkr.ecr.ap-south-2.amazonaws.com/supportiq-ai-service-staging`)

### IAM policy for GitHub Actions CI user

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunction",
        "lambda:PublishVersion"
      ],
      "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:supportiq-ai-service-*"
    }
  ]
}
```

### GitHub configuration

| Type | Name | Example |
|------|------|---------|
| Secret | `AWS_ACCESS_KEY_ID` | IAM access key |
| Secret | `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| Secret | `OPENAI_API_KEY` | OpenAI key (also set on Lambda env) |
| Secret | `QDRANT_API_KEY` | Qdrant API key |
| Secret | `REDIS_URL` | Upstash Redis URL |
| Variable | `AWS_REGION` | `ap-south-2` |
| Variable | `AWS_ECR_REPOSITORY` | `123456789.dkr.ecr.ap-south-2.amazonaws.com/supportiq-ai-service-staging` |
| Variable | `AWS_LAMBDA_FUNCTION_NAME` | `supportiq-ai-service-staging` |
| Variable | `AI_SERVICE_URL` | Lambda Function URL or API Gateway endpoint (for Render env) |
| Variable | `QDRANT_URL` | Qdrant cluster URL |

### How CI deploys

1. Builds `Dockerfile.lambda`
2. Pushes to ECR (`:latest` and `:${{ github.sha }}`)
3. Calls `aws lambda update-function-code` with new image
4. Updates Lambda environment variables from GitHub secrets/vars

### Lambda limitations to know

| Feature | Limitation | Mitigation |
|---------|------------|------------|
| **Cold starts** | 5–30 s first request | Provisioned concurrency (optional) |
| **SSE streaming** | Needs Function URL + `RESPONSE_STREAM` | Configured in `template.yaml` |
| **Max duration** | 15 minutes | Sufficient for ingestion |
| **Ephemeral storage** | 512 MB default | Increase to 1024 MB for large PDFs |
| **VPC** | Optional if Qdrant is private | Add VPC config in SAM if needed |

If ingestion consistently times out or exceeds memory, consider **AWS Fargate** or **App Runner** instead of Lambda.

---

## GitHub Actions flow (develop branch)

```
push to develop
    │
    ├── node-ci (test)
    ├── python-ci (test)
    └── docker-build (verify images build)
            │
            ├── deploy-api-gateway  → POST Render deploy hook
            ├── deploy-web          → vercel deploy --prod
            └── deploy-ai-service   → ECR push + Lambda update
```

PRs to `develop` run CI only — **no deploy**.

---

## Post-deploy verification

```bash
# API Gateway (Render)
curl https://YOUR-API.onrender.com/health

# Web (Vercel)
curl -I https://YOUR-APP.vercel.app/login

# AI Service (Lambda Function URL)
curl https://YOUR-FUNCTION-URL.lambda-url.REGION.on.aws/health
```

Register a user on the Vercel app, upload a document, and confirm ingestion completes (check Render logs for BullMQ worker + Lambda `/ingest` calls).

---

## Full secrets & variables reference

See [GITHUB_CI_SECRETS.md](./GITHUB_CI_SECRETS.md) for the complete list.
