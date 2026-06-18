# GitHub Actions — Secrets & Variables Reference

Configure in: **Settings → Secrets and variables → Actions**

---

## Why CI was failing (and what we fixed)

| Failure | Root cause | Fix |
|---------|------------|-----|
| **Postgres container failed** | `CI_POSTGRES_USER` / `CI_POSTGRES_PASSWORD` were **empty** — workflow read from Variables/Secrets you hadn't set | CI now uses **built-in test credentials** (`supportiq` / `test_password`) |
| **Python: Missing QDRANT_URL** | You stored `QDRANT_URL` as a **Secret**, but workflow expected a **Variable** | CI now falls back: `vars.QDRANT_URL \|\| secrets.QDRANT_URL` |
| **Python: Missing CI_REDIS_URL** | Variable never created | CI now uses `redis://localhost:6379` (tests are mocked) |

**CI jobs only require these two secrets** (you already have them):
- `JWT_SECRET`
- `OPENAI_API_KEY`

---

## What you already have (Secrets tab) ✅

| Secret | Status |
|--------|--------|
| `DATABASE_URL` | ✅ For Render production |
| `JWT_SECRET` | ✅ CI + Render |
| `OPENAI_API_KEY` | ✅ CI + Lambda + Render |
| `QDRANT_API_KEY` | ✅ Production |
| `QDRANT_URL` | ✅ Works (CI reads from secrets as fallback) |
| `REDIS_URL` | ✅ Production |

---

## Secrets still needed for deploy jobs

| Secret | Platform | Required when |
|--------|----------|---------------|
| `RENDER_DEPLOY_HOOK_URL` | Render | Push to `develop` |
| `VERCEL_TOKEN` | Vercel | Push to `develop` |
| `AWS_ACCESS_KEY_ID` | S3 + Lambda | Production storage + AI deploy |
| `AWS_SECRET_ACCESS_KEY` | S3 + Lambda | Production storage + AI deploy |
| `NEXTAUTH_SECRET` | Vercel | Production web |
| `MINIO_ACCESS_KEY` | — | **Not needed for CI** (only if you force MinIO in prod) |
| `MINIO_SECRET_KEY` | — | **Not needed for CI** |
| `CODECOV_TOKEN` | CI | Optional |

---

## Variables needed (Actions → Variables tab)

Create these for **deploy** jobs (not required for PR CI checks):

| Variable | Example | Used by |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `https://supportiq-api.onrender.com` | Vercel build, Render CORS |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Vercel build |
| `VERCEL_ORG_ID` | `team_xxx` | Vercel deploy |
| `VERCEL_PROJECT_ID` | `prj_xxx` | Vercel deploy |
| `AI_SERVICE_URL` | Lambda Function URL | Render env |
| `API_INTERNAL_URL` | Same as API URL | Vercel |
| `AWS_REGION` | `ap-south-2` | S3 + Lambda |
| `AWS_S3_BUCKET` | `supportiq-ai` | Production file storage |
| `AWS_ECR_REPOSITORY` | `123.dkr.ecr.ap-south-2.amazonaws.com/supportiq-ai` | Lambda deploy |
| `AWS_LAMBDA_FUNCTION_NAME` | `supportiq-ai-service-staging` | Lambda deploy |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` | Render CORS |
| `NODE_ENV` | `production` | Render |

**Tip:** `QDRANT_URL` can stay as a **Secret** (current setup) or move to **Variables** — both work in deploy jobs.

---

## Storage: MinIO (dev) vs AWS S3 (production)

| Environment | Provider | Config |
|-------------|----------|--------|
| **Local / Docker** | MinIO | `STORAGE_PROVIDER=minio` + `MINIO_*` vars |
| **Render (production)** | AWS S3 | `STORAGE_PROVIDER=s3` + `AWS_*` vars |

### Render environment variables for S3

```
STORAGE_PROVIDER=s3
NODE_ENV=production
AWS_ACCESS_KEY_ID=<from GitHub secret>
AWS_SECRET_ACCESS_KEY=<from GitHub secret>
AWS_REGION=ap-south-2
AWS_S3_BUCKET=supportiq-ai
```

### GitHub secrets for S3 (same IAM user as Lambda is fine)

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | S3 upload/delete + Lambda CI deploy |
| `AWS_SECRET_ACCESS_KEY` | S3 upload/delete + Lambda CI deploy |

IAM user needs: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` on your bucket.

---

## Quick checklist

### For PR checks to pass (minimum)
- [x] `JWT_SECRET` — you have it
- [x] `OPENAI_API_KEY` — you have it

### For full deploy pipeline
- [ ] `RENDER_DEPLOY_HOOK_URL`
- [ ] `VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`
- [ ] `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
- [ ] Variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ECR_REPOSITORY`, `AWS_LAMBDA_FUNCTION_NAME`
- [ ] Render dashboard: set `STORAGE_PROVIDER=s3` and AWS env vars

See [DEPLOYMENT.md](./DEPLOYMENT.md) for platform setup details.
