from pydantic import BaseModel, HttpUrl
from typing import Optional


class IngestRequest(BaseModel):
    org_id: str
    document_id: str
    file_url: str
    document_type: str  # PDF | TXT | URL | DOCX | MARKDOWN
    document_name: str


class DeleteVectorsRequest(BaseModel):
    org_id: str
    document_id: str


class QueryRequest(BaseModel):
    org_id: str
    question: str
    conversation_history: Optional[list[dict]] = []


class Source(BaseModel):
    document_id: str
    document_name: str
    excerpt: str
    score: float


class QueryResponse(BaseModel):
    answer: str
    sources: list[Source]
    confidence: float
    should_escalate: bool


class IngestResponse(BaseModel):
    chunk_count: int
    collection_name: str
    document_id: str
