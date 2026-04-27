"""
Unit & integration tests for the SupportIQ AI service.
Run with: pytest tests/ -v
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import json


# ─── document_processor tests ─────────────────────────────────────────────────
class TestDocumentProcessor:
    def test_load_and_chunk_rejects_empty_content(self):
        """Empty or whitespace-only pages should produce zero valid chunks."""
        from app.core.document_processor import load_and_chunk

        with patch("app.core.document_processor.WebBaseLoader") as MockLoader:
            instance = MockLoader.return_value
            instance.load.return_value = []  # Simulates a page with no content

            result = load_and_chunk(
                file_url="https://example.com/empty",
                document_type="URL",
                document_name="Empty Page",
            )
            assert result == []

    def test_chunk_size_is_respected(self):
        """Each chunk should not exceed the configured chunk_size."""
        from langchain_core.documents import Document
        from app.core.document_processor import _get_splitter

        splitter = _get_splitter()
        long_text = "word " * 2000  # ~10 000 chars
        doc = Document(page_content=long_text)
        chunks = splitter.split_documents([doc])

        for chunk in chunks:
            # Allow slight overflow due to word boundaries, but not 2×
            assert len(chunk.page_content) <= 1200, (
                f"Chunk too large: {len(chunk.page_content)} chars"
            )

    def test_short_fragments_are_filtered(self):
        """Chunks shorter than 30 characters should be dropped."""
        from langchain_core.documents import Document
        from app.core.document_processor import load_and_chunk

        with patch("app.core.document_processor.WebBaseLoader") as MockLoader:
            instance = MockLoader.return_value
            # Mix of useful content and tiny fragments
            instance.load.return_value = [
                Document(page_content="A" * 5),          # too short
                Document(page_content="B" * 31),          # just long enough
                Document(page_content="  \n\t  "),       # whitespace only
                Document(page_content="Normal paragraph with real content here."),
            ]

            result = load_and_chunk(
                file_url="https://example.com/doc",
                document_type="URL",
                document_name="Test Doc",
            )

            for chunk in result:
                assert len(chunk.page_content.strip()) >= 30


# ─── vector_store tests ───────────────────────────────────────────────────────
class TestVectorStore:
    def test_collection_name_sanitises_uuid(self):
        """Hyphens in org UUIDs must be replaced so Qdrant collection name is valid."""
        from app.core.vector_store import _collection_name

        org_id = "550e8400-e29b-41d4-a716-446655440000"
        name = _collection_name(org_id)
        assert "-" not in name
        assert name.startswith("supportiq_")

    def test_confidence_zero_when_no_results(self):
        """_calc_confidence should return 0.0 when there are no search results."""
        from app.core.rag_pipeline import _calc_confidence

        assert _calc_confidence([]) == 0.0

    def test_confidence_max_one(self):
        """Confidence score must never exceed 1.0."""
        from app.core.rag_pipeline import _calc_confidence

        high_scores = [{"score": 0.99}, {"score": 0.98}, {"score": 0.97}]
        result = _calc_confidence(high_scores)
        assert 0.0 <= result <= 1.0

    def test_confidence_single_result(self):
        """Single high-scoring result should produce a reasonable confidence."""
        from app.core.rag_pipeline import _calc_confidence

        result = _calc_confidence([{"score": 0.90}])
        assert result > 0.5


# ─── RAG pipeline tests ────────────────────────────────────────────────────────
class TestRAGPipeline:
    def test_format_context_empty(self):
        """Empty search results should produce 'No relevant documents found.'"""
        from app.core.rag_pipeline import _format_context

        result = _format_context([])
        assert "No relevant documents" in result

    def test_format_context_numbered(self):
        """Context should include numbered references for each document."""
        from app.core.rag_pipeline import _format_context

        results = [
            {"document_id": "1", "document_name": "FAQ", "content": "Return in 30 days.", "score": 0.9},
            {"document_id": "2", "document_name": "Policy", "content": "No cash refunds.", "score": 0.8},
        ]
        context = _format_context(results)
        assert "[1]" in context
        assert "[2]" in context
        assert "FAQ" in context
        assert "Policy" in context

    def test_build_messages_includes_history(self):
        """Conversation history should be included as message objects."""
        from app.core.rag_pipeline import _build_messages
        from langchain_core.messages import HumanMessage, AIMessage

        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]
        msgs = _build_messages("System prompt.", history, "Follow-up question?")

        roles = [type(m).__name__ for m in msgs]
        assert "SystemMessage" in roles
        assert "HumanMessage" in roles
        assert "AIMessage" in roles
        # Last message must be the new question
        assert isinstance(msgs[-1], HumanMessage)
        assert msgs[-1].content == "Follow-up question?"

    def test_build_messages_caps_history_at_6(self):
        """Only last 6 history turns (3 exchanges) should be included."""
        from app.core.rag_pipeline import _build_messages

        long_history = [
            {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg {i}"}
            for i in range(20)
        ]
        msgs = _build_messages("System.", long_history, "New question")
        # 1 system + at most 6 history + 1 current = 8
        assert len(msgs) <= 8

    @pytest.mark.asyncio
    async def test_query_stream_yields_sse_events(self):
        """Streaming query should yield SSE-formatted data lines."""
        from app.core.rag_pipeline import query_stream

        mock_search_results = [
            {"document_id": "doc1", "document_name": "FAQ", "content": "Test content", "score": 0.85}
        ]

        async def fake_astream(_):
            for token in ["Hello", " world", "!"]:
                yield MagicMock(content=token)

        with patch("app.core.rag_pipeline.search_documents", return_value=mock_search_results), \
             patch("app.core.rag_pipeline._build_llm") as mock_llm_factory:

            mock_llm = MagicMock()
            mock_llm.astream = fake_astream
            mock_llm_factory.return_value = mock_llm

            events = []
            async for event in query_stream(
                org_id="test-org",
                question="What is your return policy?",
            ):
                events.append(event)

        assert len(events) > 0

        # First event must be the sources metadata
        first = json.loads(events[0].replace("data: ", "").strip())
        assert first["type"] == "sources"
        assert "sources" in first
        assert "confidence" in first

        # Subsequent events must be tokens
        token_events = [e for e in events[1:] if "[DONE]" not in e]
        for ev in token_events:
            parsed = json.loads(ev.replace("data: ", "").strip())
            if parsed.get("type") == "token":
                assert "content" in parsed

        # Last event must be [DONE]
        assert "[DONE]" in events[-1]


# ─── API route tests ───────────────────────────────────────────────────────────
class TestIngestRoute:
    def test_ingest_returns_422_on_empty_content(self):
        """Ingest endpoint should return 422 when no content can be extracted."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)

        with patch("app.routes.ingest.load_and_chunk", return_value=[]), \
             patch("app.routes.ingest.upsert_documents", return_value=0):

            response = client.post("/ingest", json={
                "org_id": "test-org",
                "document_id": "doc-1",
                "file_url": "https://example.com/empty.pdf",
                "document_type": "PDF",
                "document_name": "Empty.pdf",
            })

        assert response.status_code == 422

    def test_ingest_success(self):
        """Successful ingest should return chunk_count and collection_name."""
        from fastapi.testclient import TestClient
        from app.main import app
        from langchain_core.documents import Document

        client = TestClient(app)
        fake_chunks = [Document(page_content="Test chunk content that is long enough")]

        with patch("app.routes.ingest.load_and_chunk", return_value=fake_chunks), \
             patch("app.routes.ingest.upsert_documents", return_value=1):

            response = client.post("/ingest", json={
                "org_id": "test-org",
                "document_id": "doc-1",
                "file_url": "https://example.com/doc.pdf",
                "document_type": "PDF",
                "document_name": "Test Doc.pdf",
            })

        assert response.status_code == 200
        data = response.json()
        assert data["chunk_count"] == 1
        assert "supportiq_" in data["collection_name"]


class TestQueryRoute:
    def test_query_returns_answer(self):
        """Non-streaming query should return answer, sources, and confidence."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)

        fake_result = {
            "answer": "You can return items within 30 days.",
            "sources": [],
            "confidence": 0.87,
            "should_escalate": False,
        }

        with patch("app.routes.query.query", new=AsyncMock(return_value=fake_result)):
            response = client.post("/query", json={
                "org_id": "test-org",
                "question": "What is the return policy?",
            })

        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert data["confidence"] == 0.87
        assert data["should_escalate"] is False

    def test_health_check(self):
        """Health endpoint should return 200."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
