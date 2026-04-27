// ─── Organisation & Auth ──────────────────────────────────────────────────────
export interface Organisation {
  id: string;
  name: string;
  slug: string;
  widgetColor: string;
  widgetGreeting: string;
  plan: "free" | "starter" | "pro" | "enterprise";
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  orgId: string;
  createdAt: Date;
}

// ─── Knowledge Base ────────────────────────────────────────────────────────────
export type DocumentStatus = "pending" | "processing" | "ready" | "failed";
export type DocumentType = "pdf" | "txt" | "url" | "docx" | "markdown";

export interface KnowledgeDocument {
  id: string;
  orgId: string;
  name: string;
  type: DocumentType;
  status: DocumentStatus;
  url?: string;
  fileSize?: number;
  chunkCount?: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Chat & Conversations ─────────────────────────────────────────────────────
export type MessageRole = "user" | "assistant" | "system";
export type ConversationStatus = "open" | "resolved" | "escalated";

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  sources?: Source[];
  confidence?: number;
  createdAt: Date;
}

export interface Source {
  documentId: string;
  documentName: string;
  excerpt: string;
  score: number;
}

export interface Conversation {
  id: string;
  orgId: string;
  sessionId: string;
  status: ConversationStatus;
  visitorEmail?: string;
  messages: Message[];
  escalatedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────
export interface ChatRequest {
  sessionId: string;
  orgId: string;
  message: string;
  conversationHistory?: Array<{ role: MessageRole; content: string }>;
}

export interface ChatResponse {
  messageId: string;
  content: string;
  sources: Source[];
  confidence: number;
  shouldEscalate: boolean;
}

export interface IngestRequest {
  orgId: string;
  documentId: string;
  fileUrl: string;
  documentType: DocumentType;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface AnalyticsOverview {
  totalConversations: number;
  resolvedByAI: number;
  escalatedToHuman: number;
  avgResponseTimeMs: number;
  topQuestions: Array<{ question: string; count: number }>;
  conversationsByDay: Array<{ date: string; count: number }>;
}

// ─── API Response wrappers ────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
