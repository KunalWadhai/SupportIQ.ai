from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None

    redis_url: str = "redis://localhost:6379"

    # RAG configuration
    chunk_size: int = 800
    chunk_overlap: int = 150
    retriever_top_k: int = 5
    # Confidence below which we flag for escalation
    escalation_threshold: float = 0.40

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
