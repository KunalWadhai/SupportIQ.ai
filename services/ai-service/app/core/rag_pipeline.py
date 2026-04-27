import logging
import json
from typing import AsyncIterator

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser

from app.config import get_settings
from app.core.vector_store import search_documents
from app.models.schemas import Source

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful customer support assistant for the organisation. \
Your job is to answer questions accurately using ONLY the provided context documents.

Rules:
- Answer ONLY based on the provided context. Do not invent information.
- If the context doesn't contain enough information to answer fully, say so clearly and suggest the user contact a human agent.
- Be concise, friendly, and professional.
- When referencing information, you may say "Based on our documentation..." but do not invent source titles.
- If the question is completely unrelated to the provided context, say you don't have information about that.

Context from knowledge base:
{context}"""


def _build_llm(streaming: bool = False) -> ChatOpenAI:
    settings = get_settings()
    return ChatOpenAI(
        model=settings.openai_model,
        openai_api_key=settings.openai_api_key,
        temperature=0.2,
        streaming=streaming,
        max_tokens=1024,
    )


def _format_context(search_results: list[dict]) -> str:
    if not search_results:
        return "No relevant documents found."
    parts = []
    for i, r in enumerate(search_results, 1):
        parts.append(f"[{i}] From '{r['document_name']}':\n{r['content']}")
    return "\n\n---\n\n".join(parts)


def _calc_confidence(search_results: list[dict]) -> float:
    """
    Derive a confidence score from retrieval quality.
    - No results → 0.0
    - Top result score is weighted heavily, others diminish quickly
    """
    if not search_results:
        return 0.0
    scores = [r["score"] for r in search_results]
    # Weighted average: top result counts 50%, rest spread evenly
    top = scores[0] * 0.5
    rest = (sum(scores[1:]) / max(len(scores) - 1, 1)) * 0.5 if len(scores) > 1 else top
    return round(min(top + rest, 1.0), 3)


def _build_messages(
    system_with_context: str,
    conversation_history: list[dict],
    question: str,
) -> list:
    messages = [SystemMessage(content=system_with_context)]

    for turn in conversation_history[-6:]:  # Last 3 exchanges
        role = turn.get("role", "user").lower()
        content = turn.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=question))
    return messages


# ─── Non-streaming query ───────────────────────────────────────────────────────
async def query(
    org_id: str,
    question: str,
    conversation_history: list[dict] | None = None,
) -> dict:
    settings = get_settings()

    search_results = search_documents(org_id, question, top_k=settings.retriever_top_k)
    context = _format_context(search_results)
    confidence = _calc_confidence(search_results)
    should_escalate = confidence < settings.escalation_threshold

    system = SYSTEM_PROMPT.format(context=context)
    messages = _build_messages(system, conversation_history or [], question)

    llm = _build_llm(streaming=False)
    response = await llm.ainvoke(messages)
    answer = response.content

    sources = [
        Source(
            document_id=r["document_id"],
            document_name=r["document_name"],
            excerpt=r["content"][:200] + "..." if len(r["content"]) > 200 else r["content"],
            score=r["score"],
        )
        for r in search_results
    ]

    return {
        "answer": answer,
        "sources": [s.model_dump() for s in sources],
        "confidence": confidence,
        "should_escalate": should_escalate,
    }


# ─── Streaming query ───────────────────────────────────────────────────────────
async def query_stream(
    org_id: str,
    question: str,
    conversation_history: list[dict] | None = None,
) -> AsyncIterator[str]:
    """
    Yields Server-Sent Event strings:
      data: {"type": "sources", "sources": [...], "confidence": 0.8, "shouldEscalate": false}
      data: {"type": "token", "content": "Hello"}
      ...
      data: [DONE]
    """
    settings = get_settings()

    search_results = search_documents(org_id, question, top_k=settings.retriever_top_k)
    context = _format_context(search_results)
    confidence = _calc_confidence(search_results)
    should_escalate = confidence < settings.escalation_threshold

    sources = [
        {
            "document_id": r["document_id"],
            "document_name": r["document_name"],
            "excerpt": r["content"][:200] + "..." if len(r["content"]) > 200 else r["content"],
            "score": r["score"],
        }
        for r in search_results
    ]

    # Emit sources metadata first so the client can display citations before text arrives
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'confidence': confidence, 'shouldEscalate': should_escalate})}\n\n"

    system = SYSTEM_PROMPT.format(context=context)
    messages = _build_messages(system, conversation_history or [], question)

    llm = _build_llm(streaming=True)

    async for chunk in llm.astream(messages):
        token = chunk.content
        if token:
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

    yield "data: [DONE]\n\n"
