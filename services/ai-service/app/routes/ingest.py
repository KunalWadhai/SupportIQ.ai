import logging
from fastapi import APIRouter, HTTPException

from app.models.schemas import IngestRequest, IngestResponse, DeleteVectorsRequest
from app.core.document_processor import load_and_chunk
from app.core.vector_store import upsert_documents, delete_document_vectors

router = APIRouter(prefix="/ingest", tags=["ingest"])
logger = logging.getLogger(__name__)


@router.post("", response_model=IngestResponse)
async def ingest_document(request: IngestRequest):
    """
    Called by the Node.js ingestion worker (via BullMQ).
    Downloads the document, chunks it, embeds it, and stores in Qdrant.
    """
    logger.info(
        f"Ingesting doc={request.document_id} type={request.document_type} org={request.org_id}"
    )

    try:
        chunks = load_and_chunk(
            file_url=request.file_url,
            document_type=request.document_type,
            document_name=request.document_name,
        )

        if not chunks:
            raise HTTPException(
                status_code=422,
                detail=f"No content could be extracted from '{request.document_name}'",
            )

        chunk_count = upsert_documents(
            org_id=request.org_id,
            document_id=request.document_id,
            document_name=request.document_name,
            chunks=chunks,
        )

        collection_name = f"supportiq_{request.org_id.replace('-', '_')}"

        return IngestResponse(
            chunk_count=chunk_count,
            collection_name=collection_name,
            document_id=request.document_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ingestion failed for doc {request.document_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
async def delete_document(request: DeleteVectorsRequest):
    """Remove all vectors for a document from Qdrant."""
    try:
        delete_document_vectors(
            org_id=request.org_id,
            document_id=request.document_id,
        )
        return {"success": True, "document_id": request.document_id}
    except Exception as e:
        logger.error(f"Vector deletion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
