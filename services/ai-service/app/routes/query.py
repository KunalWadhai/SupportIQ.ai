import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import QueryRequest, QueryResponse
from app.core.rag_pipeline import query, query_stream

router = APIRouter(prefix="/query", tags=["query"])
logger = logging.getLogger(__name__)


@router.post("", response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    """Non-streaming RAG query. Returns full answer + sources."""
    try:
        result = await query(
            org_id=request.org_id,
            question=request.question,
            conversation_history=request.conversation_history,
        )
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"],
            confidence=result["confidence"],
            should_escalate=result["should_escalate"],
        )
    except Exception as e:
        logger.error(f"Query failed for org {request.org_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def query_stream_endpoint(request: QueryRequest):
    """
    Streaming SSE RAG query.
    Emits: sources metadata → token stream → [DONE]
    """
    async def event_generator():
        try:
            async for event in query_stream(
                org_id=request.org_id,
                question=request.question,
                conversation_history=request.conversation_history,
            ):
                yield event
        except Exception as e:
            import json
            logger.error(f"Stream query failed: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )
