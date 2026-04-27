# SupportIQ AI 🤖

> **RAG-powered customer support platform** — Upload your docs, get an embeddable AI chat widget, resolve 80% of support tickets automatically.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-yellow)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain-0.2-purple)](https://langchain.com/)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                │
│  Next.js 14 Dashboard  |  Chat Widget  |  Customer Website   │
└──────────────┬─────────────────┬────────────────────────────┘
               │                 │ embed script
┌──────────────▼─────────────────▼────────────────────────────┐
│  API GATEWAY  (Node.js + Express + TypeScript)               │
│  JWT Auth · Rate Limiting · BullMQ Queue Producer           │
└──────────────┬──────────────────────────┬───────────────────┘
               │ HTTP                      │ BullMQ jobs
┌──────────────▼──────────┐  ┌────────────▼───────────────────┐
│  Python AI Service      │  │  Node.js Ingestion Worker      │
│  FastAPI + LangChain    │  │  PDF/DOCX/URL parsing          │
│  GPT-4o streaming RAG   │  │  Calls AI Service to embed     │
└──────┬──────────────────┘  └────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────┐
│  DATA LAYER                                                  │
│  PostgreSQL (Prisma) | Qdrant VectorDB | Redis | MinIO      │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui |
| API Gateway | Node.js, Express, Prisma ORM, BullMQ, JWT |
| AI Service | Python 3.12, FastAPI, LangChain, OpenAI GPT-4o |
| Vector DB | Qdrant (per-org collections for data isolation) |
| Database | PostgreSQL 16 |
| Cache + Queue | Redis 7 + BullMQ |
| File Storage | MinIO (S3-compatible) |
| Monorepo | Turborepo + npm workspaces |
| Containers | Docker Compose |

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- Python ≥ 3.12
- Docker + Docker Compose
- OpenAI API key

### 1. Clone & install
```bash
git clone https://github.com/yourname/supportiq-ai
cd supportiq-ai
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY, JWT_SECRET, NEXTAUTH_SECRET
```

### 3. Start all infrastructure
```bash
npm run docker:up
```
This starts: PostgreSQL, Redis, Qdrant, MinIO, AI Service, API Gateway, Web App.

### 4. Run database migrations
```bash
npm run db:migrate
```

### 5. Open the dashboard
Navigate to [http://localhost:3000](http://localhost:3000), register an account, and you're live.

---

## Development

### Run services individually (without Docker)
```bash
# Terminal 1 – infra only
docker-compose up postgres redis qdrant minio -d

# Terminal 2 – Python AI service
cd services/ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 3 – API Gateway
cd apps/api-gateway
npm run dev

# Terminal 4 – Next.js web
cd apps/web
npm run dev
```

### Turborepo (all at once)
```bash
npm run dev  # starts all apps in parallel
```

---

## Project Structure

```
supportiq-ai/
├── apps/
│   ├── api-gateway/               # Node.js Express API
│   │   ├── prisma/
│   │   │   └── schema.prisma      # Database schema
│   │   └── src/
│   │       ├── config/            # App configuration
│   │       ├── middleware/        # JWT auth, widget key auth
│   │       ├── routes/            # auth, knowledge, chat, analytics, widget
│   │       ├── services/          # AI client, MinIO, BullMQ queue
│   │       └── index.ts           # Express bootstrap
│   └── web/                       # Next.js 14 App Router
│       └── src/
│           ├── app/
│           │   ├── (auth)/login/  # Login + register
│           │   ├── (dashboard)/   # Protected dashboard pages
│           │   └── widget/[orgId] # Embeddable widget page
│           ├── components/        # Chat, Dashboard, Knowledge components
│           ├── hooks/             # useAuth, useStream (SSE)
│           └── lib/               # api.ts, utils.ts
├── services/
│   └── ai-service/                # Python FastAPI microservice
│       └── app/
│           ├── core/
│           │   ├── rag_pipeline.py      # LangChain LCEL + GPT-4o streaming
│           │   ├── vector_store.py      # Qdrant per-org collections
│           │   └── document_processor.py # PDF/DOCX/URL chunking
│           ├── routes/
│           │   ├── ingest.py      # POST /ingest, DELETE /ingest/delete
│           │   └── query.py       # POST /query, POST /query/stream
│           └── main.py            # FastAPI app
└── packages/
    └── shared-types/              # TypeScript types shared across apps
```

---

## Key Features

### RAG Pipeline
1. **Document ingestion**: Files uploaded → stored in MinIO → BullMQ job queued → Python service downloads, chunks (800 tokens, 150 overlap), embeds with `text-embedding-3-small`, stores in Qdrant
2. **Per-org isolation**: Each organisation gets its own Qdrant collection (`supportiq_{orgId}`)
3. **Semantic retrieval**: Top-K cosine similarity search with score threshold filtering
4. **Confidence scoring**: Weighted average of retrieval scores → auto-escalate if below 40%
5. **Streaming responses**: SSE token stream from GPT-4o directly to browser

### Embeddable Widget
Add to any website:
```html
<script>
  window.SupportIQConfig = {
    apiKey: "your-api-key",
    orgId: "your-org-id",
  };
</script>
<script src="https://your-domain.com/widget.js" async></script>
```

### Multi-tenancy
- JWT-based dashboard auth (per user)
- API-key-based widget auth (per org)
- All data queries scoped to `orgId`
- Separate Qdrant collections per org

---

## API Reference

### Public Widget Endpoints (API key auth)
```
POST /api/chat/widget        SSE streaming chat
GET  /api/widget/:orgId/config  Widget configuration
```

### Dashboard Endpoints (JWT auth)
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/knowledge              List documents
POST   /api/knowledge/upload       Upload file (multipart)
POST   /api/knowledge/url          Add URL source
DELETE /api/knowledge/:id          Delete document

GET    /api/chat/conversations     List conversations
GET    /api/chat/conversations/:id Get conversation + messages
PATCH  /api/chat/conversations/:id/resolve

GET    /api/analytics/overview     Stats (period in ?days=)
GET    /api/analytics/knowledge    Document stats

PATCH  /api/widget/settings        Update widget appearance
POST   /api/widget/regenerate-key  New API key
```

### Python AI Service (internal)
```
POST   /ingest             Chunk, embed, and store document
DELETE /ingest/delete      Remove document vectors
POST   /query              Non-streaming RAG query
POST   /query/stream       SSE streaming RAG query
GET    /health
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (required) |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `QDRANT_URL` | Qdrant HTTP URL |
| `MINIO_ENDPOINT` | MinIO/S3 host |
| `AI_SERVICE_URL` | Internal URL of Python service |

See `.env.example` for the full list.

---

## Resume Highlights

This project demonstrates:

- **RAG architecture** — full retrieval-augmented generation pipeline from document ingestion to streaming answers
- **Microservices** — Node.js API gateway + Python AI service communicating via HTTP
- **Event-driven** — BullMQ background job queue with retry logic for async document processing
- **Multi-tenancy** — per-org data isolation at every layer (DB, vectors, storage)
- **Real-time streaming** — Server-Sent Events (SSE) for token-by-token LLM output
- **Production patterns** — rate limiting, JWT auth, API key auth, error handling, confidence scoring, auto-escalation
- **Modern stack** — Next.js 14 App Router, Turborepo monorepo, Prisma ORM, Docker Compose

---

## License

MIT
