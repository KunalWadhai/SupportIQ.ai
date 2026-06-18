import { config } from "../config";
import type { Source } from "@supportiq/shared-types";

const AI_URL = config.aiService.url;

export interface RAGQueryResult {
  answer: string;
  sources: Source[];
  confidence: number;
  shouldEscalate: boolean;
}

export interface IngestResult {
  chunkCount: number;
  collectionName: string;
}

// ─── RAG Query (non-streaming) ─────────────────────────────────────────────────
export async function queryRAG(params: {
  orgId: string;
  question: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<RAGQueryResult> {
  const res = await fetch(`${AI_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI service error: ${err}`);
  }

  return (await res.json()) as RAGQueryResult;
}

// ─── Streaming RAG Query ───────────────────────────────────────────────────────
// Returns the raw ReadableStream from the AI service so Express can pipe it
export async function queryRAGStream(params: {
  orgId: string;
  question: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<Response> {
  const res = await fetch(`${AI_URL}/query/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(`AI service streaming error: ${res.status}`);
  }

  return res;
}

// ─── Document Ingestion ────────────────────────────────────────────────────────
export async function ingestDocument(params: {
  orgId: string;
  documentId: string;
  fileUrl: string;
  documentType: string;
  documentName: string;
}): Promise<IngestResult> {
  const res = await fetch(`${AI_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ingestion error: ${err}`);
  }

  return (await res.json()) as IngestResult;
}

// ─── Delete document vectors ───────────────────────────────────────────────────
export async function deleteDocumentVectors(params: {
  orgId: string;
  documentId: string;
}): Promise<void> {
  const res = await fetch(`${AI_URL}/ingest/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(`Delete vectors error: ${res.status}`);
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────
export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AI_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
