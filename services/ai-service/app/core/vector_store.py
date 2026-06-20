from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    FilterSelector,
)
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from app.config import get_settings
import uuid
import logging

logger = logging.getLogger(__name__)

VECTOR_SIZE = 1536  # text-embedding-3-small output dimension


def _collection_name(org_id: str) -> str:
    """Each organisation gets its own Qdrant collection for data isolation."""
    return f"supportiq_{org_id.replace('-', '_')}"


def _get_client() -> QdrantClient:
    settings = get_settings()
    return QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        timeout=30,
    )


def _get_embeddings() -> OpenAIEmbeddings:
    settings = get_settings()
    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        openai_api_key=settings.openai_api_key,
    )


def ensure_collection(org_id: str) -> str:
    """Create the Qdrant collection for this org if it doesn't exist yet."""
    client = _get_client()
    name = _collection_name(org_id)

    existing = [c.name for c in client.get_collections().collections]
    if name not in existing:
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info(f"Created Qdrant collection: {name}")

    return name


def upsert_documents(org_id: str, document_id: str, document_name: str, chunks: list[Document]) -> int:
    """Embed and upsert document chunks into the org's Qdrant collection."""
    if not chunks:
        return 0

    client = _get_client()
    embeddings = _get_embeddings()
    collection = ensure_collection(org_id)

    texts = [c.page_content for c in chunks]
    vectors = embeddings.embed_documents(texts)

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "org_id": org_id,
                "document_id": document_id,
                "document_name": document_name,
                "content": text,
                "chunk_index": i,
            },
        )
        for i, (text, vector) in enumerate(zip(texts, vectors))
    ]

    # Upsert in batches of 100
    batch_size = 100
    for i in range(0, len(points), batch_size):
        client.upsert(collection_name=collection, points=points[i : i + batch_size])

    logger.info(f"Upserted {len(points)} chunks for doc {document_id} in org {org_id}")
    return len(points)


def search_documents(org_id: str, query: str, top_k: int = 5) -> list[dict]:
    """Semantic search over this org's knowledge base."""
    client = _get_client()
    embeddings = _get_embeddings()
    collection = _collection_name(org_id)

    # Check collection exists
    existing = [c.name for c in client.get_collections().collections]
    if collection not in existing:
        return []

    query_vector = embeddings.embed_query(query)

    results = client.search(
        collection_name=collection,
        query_vector=query_vector,
        limit=top_k,
        with_payload=True,
        score_threshold=0.30,  # Filter out very low-relevance results
    )

    return [
        {
            "document_id": r.payload.get("document_id", ""),
            "document_name": r.payload.get("document_name", "Unknown"),
            "content": r.payload.get("content", ""),
            "score": round(r.score, 4),
        }
        for r in results
    ]


def delete_document_vectors(org_id: str, document_id: str) -> None:
    """Remove all vectors belonging to a specific document."""
    client = _get_client()
    collection = _collection_name(org_id)

    existing = [c.name for c in client.get_collections().collections]
    if collection not in existing:
        return

    client.delete(
        collection_name=collection,
        points_selector=FilterSelector(
            filter=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id),
                    )
                ]
            )
        ),
    )
    logger.info(f"Deleted vectors for doc {document_id} from org {org_id}")
