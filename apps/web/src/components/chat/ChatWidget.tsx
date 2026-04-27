"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useStream } from "@/hooks/useStream";
import { formatRelativeTime, cn } from "@/lib/utils";
import { Send, Bot, User, X, Minimize2, AlertTriangle, BookOpen, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  confidence?: number;
  shouldEscalate?: boolean;
  createdAt: Date;
  streaming?: boolean;
}

interface ChatWidgetProps {
  orgId: string;
  apiKey: string;
  widgetColor?: string;
  greeting?: string;
  orgName?: string;
}

export function ChatWidget({
  orgId,
  apiKey,
  widgetColor = "#6366f1",
  greeting = "Hi! How can I help you today?",
  orgName = "Support",
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: greeting,
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { sendMessage, isStreaming, streamContent, sources, confidence, shouldEscalate, error } =
    useStream({
      orgId,
      apiKey,
      onConversationId: setConversationId,
    });

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // Update the streaming message bubble with live content
  useEffect(() => {
    if (!streamingMsgId || !streamContent) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === streamingMsgId
          ? { ...m, content: streamContent }
          : m
      )
    );
  }, [streamContent, streamingMsgId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date(),
    };

    // Add placeholder assistant message
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreamingMsgId(assistantMsgId);

    await sendMessage({ message: text, conversationId });

    // Finalize assistant message with sources
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantMsgId
          ? { ...m, sources, confidence, shouldEscalate, streaming: false }
          : m
      )
    );
    setStreamingMsgId(null);
  }, [input, isStreaming, sendMessage, conversationId, sources, confidence, shouldEscalate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background font-sans">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ backgroundColor: widgetColor }}
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">{orgName}</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <p className="text-white/80 text-xs">AI-powered · Always online</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            {/* Avatar */}
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                msg.role === "user" ? "bg-muted" : ""
              )}
              style={msg.role === "assistant" ? { backgroundColor: widgetColor + "22" } : {}}
            >
              {msg.role === "user" ? (
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <Bot className="w-3.5 h-3.5" style={{ color: widgetColor }} />
              )}
            </div>

            <div className={cn("max-w-[78%] flex flex-col gap-1", msg.role === "user" && "items-end")}>
              {/* Bubble */}
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-muted text-foreground rounded-tr-sm"
                    : "text-white rounded-tl-sm"
                )}
                style={msg.role === "assistant" ? { backgroundColor: widgetColor } : {}}
              >
                {msg.content || (
                  msg.streaming ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : "..."
                )}
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && !msg.streaming && (
                <div className="flex flex-wrap gap-1 max-w-full">
                  {msg.sources.slice(0, 3).map((s, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                      style={{
                        borderColor: widgetColor + "40",
                        color: widgetColor,
                        backgroundColor: widgetColor + "10",
                      }}
                    >
                      <BookOpen className="w-2.5 h-2.5" />
                      {s.document_name}
                    </span>
                  ))}
                </div>
              )}

              {/* Escalation notice */}
              {msg.shouldEscalate && !msg.streaming && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  This question may need a human agent. We'll notify the team.
                </div>
              )}

              <span className="text-xs text-muted-foreground px-1">
                {formatRelativeTime(msg.createdAt)}
                {msg.confidence != null && !msg.streaming && (
                  <span className="ml-1">· {Math.round(msg.confidence * 100)}% confident</span>
                )}
              </span>
            </div>
          </div>
        ))}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border px-3 py-3">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{ backgroundColor: widgetColor }}
          >
            {isStreaming ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-1.5">
          Powered by <span className="font-medium">SupportIQ AI</span>
        </p>
      </div>
    </div>
  );
}
