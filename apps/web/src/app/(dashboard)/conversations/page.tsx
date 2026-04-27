"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { conversationsApi } from "@/lib/api";
import { formatRelativeTime, truncate, cn } from "@/lib/utils";
import {
  MessageSquare, CheckCircle2, Search, Loader2, User, Bot,
} from "lucide-react";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ESCALATED", label: "Escalated" },
];

const STATUS_BADGES: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  ESCALATED: "bg-amber-100 text-amber-700",
};

function ConversationsInner() {
  const searchParams = useSearchParams();
  const initId = searchParams.get("id");

  const [conversations, setConversations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initId);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page] = useState(1);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await conversationsApi.list({ page, limit: 20, status: status || undefined });
      setConversations(data.conversations);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    if (!selectedId) { setSelectedConv(null); return; }
    setLoadingDetail(true);
    conversationsApi.get(selectedId).then(setSelectedConv).finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const handleResolve = async () => {
    if (!selectedConv) return;
    await conversationsApi.resolve(selectedConv.id);
    setSelectedConv((prev: any) => ({ ...prev, status: "RESOLVED" }));
    fetchList();
  };

  const filtered = conversations.filter((c) =>
    search ? c.messages[0]?.content?.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground">{total} total conversations</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4" style={{ height: "calc(100vh - 160px)" }}>
        {/* List panel */}
        <div className="flex flex-col lg:w-80 xl:w-96 bg-card border border-border rounded-xl overflow-hidden flex-shrink-0">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-1">
              {STATUS_TABS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "flex-1 py-1 text-xs rounded-md font-medium transition-colors",
                    status === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground">
                <MessageSquare className="w-6 h-6 mb-2 opacity-40" />
                No conversations found
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                    selectedId === conv.id && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", STATUS_BADGES[conv.status])}>
                      {conv.status}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatRelativeTime(conv.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm truncate">
                    {conv.messages[0]?.content ? truncate(conv.messages[0].content, 55) : "No messages"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{conv._count.messages} messages</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col min-w-0">
          {!selectedConv && !loadingDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Select a conversation to view details</p>
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_BADGES[selectedConv.status])}>
                      {selectedConv.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(selectedConv.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Session: {selectedConv.sessionId}
                    {selectedConv.visitorEmail && ` · ${selectedConv.visitorEmail}`}
                  </p>
                </div>
                {(selectedConv.status === "OPEN" || selectedConv.status === "ESCALATED") && (
                  <button
                    onClick={handleResolve}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark resolved
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedConv.messages.map((msg: any) => (
                  <div key={msg.id} className={cn("flex gap-3", msg.role === "USER" ? "flex-row" : "flex-row-reverse")}>
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", msg.role === "USER" ? "bg-muted" : "bg-primary/10")}>
                      {msg.role === "USER"
                        ? <User className="w-3.5 h-3.5 text-muted-foreground" />
                        : <Bot className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <div className={cn("max-w-[75%]", msg.role !== "USER" && "items-end flex flex-col")}>
                      <div className={cn("rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap", msg.role === "USER" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground")}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(msg.createdAt)}</span>
                        {msg.confidence != null && (
                          <span className="text-xs text-muted-foreground">· {Math.round(msg.confidence * 100)}% confidence</span>
                        )}
                      </div>
                      {msg.sources?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {msg.sources.map((s: any, i: number) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              {s.document_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
      <ConversationsInner />
    </Suspense>
  );
}

const STATUS_BADGES: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  ESCALATED: "bg-amber-100 text-amber-700",
};

export default function ConversationsPage() {
  const searchParams = useSearchParams();
  const initId = searchParams.get("id");

  const [conversations, setConversations] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initId);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await conversationsApi.list({ page, limit: 20, status: status || undefined });
      setConversations(data.conversations);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    if (!selectedId) { setSelectedConv(null); return; }
    setLoadingDetail(true);
    conversationsApi.get(selectedId)
      .then(setSelectedConv)
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const handleResolve = async () => {
    if (!selectedConv) return;
    await conversationsApi.resolve(selectedConv.id);
    setSelectedConv((prev: any) => ({ ...prev, status: "RESOLVED" }));
    fetchList();
  };

  const filtered = conversations.filter((c) =>
    search
      ? c.messages[0]?.content?.toLowerCase().includes(search.toLowerCase()) ||
        c.sessionId?.includes(search)
      : true
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground">{total} total conversations</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-160px)]">
        {/* List panel */}
        <div className="flex flex-col lg:w-80 xl:w-96 bg-card border border-border rounded-xl overflow-hidden flex-shrink-0">
          {/* Filters */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-1">
              {STATUS_TABS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { setStatus(value); setPage(1); }}
                  className={cn(
                    "flex-1 py-1 text-xs rounded-md font-medium transition-colors",
                    status === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground">
                <MessageSquare className="w-6 h-6 mb-2 opacity-40" />
                No conversations found
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                    selectedId === conv.id && "bg-primary/5 border-l-2 border-primary"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", STATUS_BADGES[conv.status])}>
                      {conv.status}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatRelativeTime(conv.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm truncate text-foreground">
                    {conv.messages[0]?.content
                      ? truncate(conv.messages[0].content, 55)
                      : "No messages"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {conv._count.messages} messages
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col min-w-0">
          {!selectedConv && !loadingDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Select a conversation to view details</p>
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Conv header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_BADGES[selectedConv.status])}>
                      {selectedConv.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(selectedConv.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Session: {selectedConv.sessionId}
                    {selectedConv.visitorEmail && ` · ${selectedConv.visitorEmail}`}
                  </p>
                </div>
                {selectedConv.status === "OPEN" || selectedConv.status === "ESCALATED" ? (
                  <button
                    onClick={handleResolve}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark resolved
                  </button>
                ) : null}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedConv.messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={cn("flex gap-3", msg.role === "USER" ? "flex-row" : "flex-row-reverse")}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                        msg.role === "USER" ? "bg-muted" : "bg-primary/10"
                      )}
                    >
                      {msg.role === "USER" ? (
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-primary" />
                      )}
                    </div>
                    <div className={cn("max-w-[75%]", msg.role !== "USER" && "items-end flex flex-col")}>
                      <div
                        className={cn(
                          "rounded-xl px-4 py-2.5 text-sm",
                          msg.role === "USER"
                            ? "bg-muted text-foreground"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                        {msg.confidence != null && (
                          <span className="text-xs text-muted-foreground">
                            · {Math.round(msg.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                      {/* Sources */}
                      {msg.sources?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {msg.sources.map((s: any, i: number) => (
                            <span
                              key={i}
                              className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                            >
                              {s.document_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
