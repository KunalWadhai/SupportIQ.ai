"use client";

import { useState, useCallback, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface StreamMessage {
  type: "token" | "sources" | "meta" | "done" | "error";
  content?: string;
  sources?: any[];
  confidence?: number;
  shouldEscalate?: boolean;
  conversationId?: string;
  messageId?: string;
  error?: string;
}

interface UseStreamOptions {
  orgId: string;
  apiKey: string;
  onConversationId?: (id: string) => void;
}

export function useStream({ orgId, apiKey, onConversationId }: UseStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [confidence, setConfidence] = useState<number>(1);
  const [shouldEscalate, setShouldEscalate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (params: {
      message: string;
      conversationId?: string;
      visitorEmail?: string;
    }) => {
      if (isStreaming) return;

      abortRef.current = new AbortController();
      setIsStreaming(true);
      setStreamContent("");
      setSources([]);
      setError(null);

      try {
        const res = await fetch(`${API_URL}/api/chat/widget`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            ...params,
            orgId,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("Stream request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") break;

            try {
              const msg: StreamMessage = JSON.parse(raw);

              if (msg.type === "meta" && msg.conversationId) {
                onConversationId?.(msg.conversationId);
              } else if (msg.type === "sources") {
                setSources(msg.sources ?? []);
                setConfidence(msg.confidence ?? 1);
                setShouldEscalate(msg.shouldEscalate ?? false);
              } else if (msg.type === "token" && msg.content) {
                fullContent += msg.content;
                setStreamContent(fullContent);
              } else if (msg.type === "error") {
                setError(msg.error ?? "Something went wrong");
              }
            } catch {
              // Malformed SSE line, skip
            }
          }
        }

        return { content: fullContent, sources, confidence, shouldEscalate };
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message ?? "Stream failed");
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, apiKey, orgId, onConversationId, sources, confidence, shouldEscalate]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { sendMessage, isStreaming, streamContent, sources, confidence, shouldEscalate, error, abort };
}
