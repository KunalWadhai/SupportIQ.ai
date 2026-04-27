import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import ingest, query
from app.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("🚀 SupportIQ AI Service starting up")
    logger.info(f"   Model: {settings.openai_model}")
    logger.info(f"   Embedding: {settings.openai_embedding_model}")
    logger.info(f"   Qdrant: {settings.qdrant_url}")
    yield
    logger.info("👋 AI Service shutting down")


app = FastAPI(
    title="SupportIQ AI Service",
    description="RAG-powered customer support AI microservice",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Only the Node.js API Gateway talks to this service — internal network
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restricted at the network level (Docker internal)
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(ingest.router)
app.include_router(query.router)


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    settings = get_settings()
    return {
        "status": "ok",
        "service": "ai-service",
        "model": settings.openai_model,
    }
