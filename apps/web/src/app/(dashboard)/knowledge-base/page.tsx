"use client";

import { useEffect, useState, useCallback } from "react";
import { knowledgeApi, analyticsApi } from "@/lib/api";
import { DocumentUploader } from "@/components/knowledge/DocumentUploader";
import { formatBytes, formatRelativeTime, cn } from "@/lib/utils";
import {
  FileText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Database,
  BookOpen,
} from "lucide-react";

const STATUS_CONFIG = {
  READY: { label: "Ready", icon: CheckCircle2, class: "text-green-600 bg-green-50" },
  PROCESSING: { label: "Processing", icon: Loader2, class: "text-blue-600 bg-blue-50", spin: true },
  PENDING: { label: "Queued", icon: Clock, class: "text-amber-600 bg-amber-50" },
  FAILED: { label: "Failed", icon: AlertCircle, class: "text-red-600 bg-red-50" },
};

export default function KnowledgeBasePage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [knowledgeStats, setKnowledgeStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    const [docsResult, statsResult] = await Promise.allSettled([
      knowledgeApi.list(),
      analyticsApi.knowledge(),
    ]);

    if (docsResult.status === "fulfilled") {
      setDocs(docsResult.value);
    } else {
      console.error("Failed to fetch documents:", docsResult.reason);
    }

    if (statsResult.status === "fulfilled") {
      setKnowledgeStats(statsResult.value);
    } else {
      console.error("Failed to fetch knowledge stats:", statsResult.reason);
    }

    if (docsResult.status === "rejected") {
      setDocs([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDocs();
    // Poll every 5s while anything is processing.
    // Read current docs via functional updater so `docs` is NOT a dependency.
    // Having `docs` in deps caused the interval to reset on every fetch → infinite loop.
    const interval = setInterval(() => {
      setDocs((currentDocs) => {
        if (currentDocs.some((d) => d.status === "PROCESSING" || d.status === "PENDING")) {
          fetchDocs();
        }
        return currentDocs;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDocs]); // fetchDocs is stable (useCallback with no deps)

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document and all its vectors?")) return;
    setDeleting(id);
    try {
      await knowledgeApi.deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      // Refresh stats so "Total documents" card updates
      await fetchDocs();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);

    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Upload documents and URLs that power your AI support bot.
          </p>
        </div>
        <button
          onClick={fetchDocs}
          className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats row */}
      {knowledgeStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total documents", value: knowledgeStats.totalDocuments, icon: BookOpen },
            { label: "Ready", value: knowledgeStats.readyDocuments, icon: CheckCircle2 },
            { label: "Processing", value: knowledgeStats.processingDocuments, icon: Loader2 },
            { label: "Total chunks", value: knowledgeStats.totalChunks.toLocaleString(), icon: Database },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-lg p-4">
              <Icon className="w-4 h-4 text-muted-foreground mb-2" />
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Uploader */}
      <DocumentUploader onDocumentAdded={fetchDocs} />

      {/* Document list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Documents ({docs.length})</h2>
        </div>

        {docs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload files or add URLs above to power your AI bot.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {docs.map((doc) => {
              const statusCfg = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING;
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground uppercase">
                        {doc.type}
                      </span>
                      {doc.fileSize && (
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(doc.fileSize)}
                        </span>
                      )}
                      {doc.chunkCount && (
                        <span className="text-xs text-muted-foreground">
                          {doc.chunkCount} chunks
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(doc.createdAt)}
                      </span>
                    </div>
                    {doc.errorMessage && (
                      <p className="text-xs text-destructive mt-0.5 truncate">{doc.errorMessage}</p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
                      statusCfg.class
                    )}
                  >
                    <StatusIcon
                      className={cn("w-3 h-3", (statusCfg as any).spin && "animate-spin")}
                    />
                    {statusCfg.label}
                  </span>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleting === doc.id}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    {deleting === doc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
