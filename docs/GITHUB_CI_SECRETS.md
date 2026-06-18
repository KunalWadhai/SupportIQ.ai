# GitHub Actions — Secrets & Variables Reference

Configure in: **Settings → Secrets and variables → Actions**

See also: [DEPLOYMENT.md](./DEPLOYMENT.md) for Render, Vercel, and AWS Lambda setup.

---

## Deploy secrets (required for production CI/CD)

| Secret | Platform | How to get it |
|--------|----------|---------------|
| `RENDER_DEPLOY_HOOK_URL` | Render | Render → api-gateway service → Settings → Deploy Hook |
| `VERCEL_TOKEN` | Vercel | vercel.com → Account → Tokens |
| `AWS_ACCESS_KEY_ID` | AWS Lambda | IAM user with ECR + Lambda permissions |
| `AWS_SECRET_ACCESS_KEY` | AWS Lambda | IAM user secret key |
| `OPENAI_API_KEY` | All | platform.openai.com |
| `JWT_SECRET` | Render | Random 32+ char string |
| `NEXTAUTH_SECRET` | Vercel | Random 32+ char string |
| `DATABASE_URL` | Render | Neon/Render Postgres connection string |
| `REDIS_URL` | Render + Lambda | Upstash Redis URL |
| `QDRANT_API_KEY` | Render + Lambda | Qdrant Cloud dashboard |
| `MINIO_ACCESS_KEY` | Render | AWS S3 or MinIO access key |
| `MINIO_SECRET_KEY` | Render | AWS S3 or MinIO secret key |
| `CI_POSTGRES_PASSWORD` | CI only | Any password for ephemeral CI Postgres |
| `CODECOV_TOKEN` | CI optional | codecov.io |

---

## Deploy variables (required for production CI/CD)

| Variable | Platform | Example |
|----------|----------|---------|
| `VERCEL_ORG_ID` | Vercel | `team_xxxxxxxx` |
| `VERCEL_PROJECT_ID` | Vercel | `prj_xxxxxxxx` |
| `AWS_REGION` | AWS Lambda | `ap-south-2` |
| `AWS_ECR_REPOSITORY` | AWS Lambda | `123456789.dkr.ecr.ap-south-2.amazonaws.com/supportiq-ai-service-staging` |
| `AWS_LAMBDA_FUNCTION_NAME` | AWS Lambda | `supportiq-ai-service-staging` |
| `NEXT_PUBLIC_API_URL` | Vercel + Render CORS | `https://supportiq-api.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | Vercel | `https://supportiq.vercel.app` |
| `AI_SERVICE_URL` | Render | Lambda Function URL |
| `API_INTERNAL_URL` | Vercel | Same as `NEXT_PUBLIC_API_URL` |
| `NEXTAUTH_URL` | Vercel | Same as `NEXT_PUBLIC_APP_URL` |
| `QDRANT_URL` | Render + Lambda | `https://xxx.qdrant.io` |
| `MINIO_ENDPOINT` | Render | `s3.ap-south-2.amazonaws.com` |
| `MINIO_PORT` | Render | `443` |
| `MINIO_USE_SSL` | Render | `true` |
| `MINIO_BUCKET` | Render | `supportiq-ai` |
| `ALLOWED_ORIGINS` | Render | `https://supportiq.vercel.app` |
| `NODE_ENV` | Render | `production` |
| `AWS_S3_BUCKET` | Render | `supportiq-ai` |
| `RATE_LIMIT_WINDOW_MS` | Render | `60000` |
| `RATE_LIMIT_MAX` | Render | `100` |

---

## CI-only variables (for pull request checks)

| Variable | Example |
|----------|---------|
| `CI_POSTGRES_USER` | `supportiq` |
| `CI_POSTGRES_DB` | `supportiq_test` |
| `CI_REDIS_URL` | `redis://localhost:6379` |

---

## Environment: staging

Deploy jobs use `environment: staging`. Override any secret/variable per environment at:
**Settings → Environments → staging**

---

## Quick setup checklist

### Render (api-gateway)
- [ ] Create Web Service from repo (`render.yaml` or manual)
- [ ] Set all env vars in Render dashboard
- [ ] Copy Deploy Hook → `RENDER_DEPLOY_HOOK_URL` secret

### Vercel (web)
- [ ] Import project with root `apps/web`
- [ ] Set `NEXT_PUBLIC_*` env vars in Vercel
- [ ] Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

### AWS Lambda (ai-service)
- [ ] Create ECR repository
- [ ] Run `sam deploy --guided` once (see `services/ai-service/template.yaml`)
- [ ] Copy Function URL → `AI_SERVICE_URL` variable + Render env
- [ ] Set `AWS_ECR_REPOSITORY`, `AWS_LAMBDA_FUNCTION_NAME`, `AWS_REGION`
- [ ] Add IAM credentials to GitHub secrets

### Connect services
- [ ] Set Render `AI_SERVICE_URL` to Lambda Function URL
- [ ] Set Render `ALLOWED_ORIGINS` to Vercel app URL
- [ ] Set Vercel `NEXT_PUBLIC_API_URL` to Render API URL

Push to `develop` → CI runs → all three deploy jobs trigger automatically.
