"use client";

import { useState, useRef, useCallback } from "react";
import { knowledgeApi } from "@/lib/api";
import { formatBytes, cn } from "@/lib/utils";
import { Upload, Link2, X, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface DocumentUploaderProps {
  onDocumentAdded: () => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function DocumentUploader({ onDocumentAdded }: DocumentUploaderProps) {
  const [tab, setTab] = useState<"file" | "url">("file");
  const [dragOver, setDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");
  const [urlName, setUrlName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid = arr.filter((f) => {
      const ok = f.size <= 20 * 1024 * 1024;
      if (!ok) setUploadMessage(`${f.name} exceeds 20 MB limit`);
      return ok;
    });
    setPendingFiles((prev) => [...prev, ...valid]);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const uploadFiles = async () => {
    if (!pendingFiles.length) return;
    setUploadState("uploading");
    setUploadMessage("Uploading files...");

    try {
      for (const file of pendingFiles) {
        const res = await knowledgeApi.uploadFile(file);
        if (!res.success) throw new Error(res.error ?? "Upload failed");
      }
      setPendingFiles([]);
      setUploadState("success");
      setUploadMessage(`${pendingFiles.length} file(s) uploaded — processing in background`);
      onDocumentAdded();
      setTimeout(() => setUploadState("idle"), 3000);
    } catch (err: any) {
      setUploadState("error");
      setUploadMessage(err.message);
    }
  };

  const addUrl = async () => {
    if (!url) return;
    setUploadState("uploading");
    setUploadMessage("Adding URL source...");
    try {
      await knowledgeApi.addUrl(url, urlName || undefined);
      setUrl("");
      setUrlName("");
      setUploadState("success");
      setUploadMessage("URL added — crawling in background");
      onDocumentAdded();
      setTimeout(() => setUploadState("idle"), 3000);
    } catch (err: any) {
      setUploadState("error");
      setUploadMessage(err.message);
    }
  };

  const removeFile = (i: number) =>
    setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["file", "url"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "file" ? "Upload files" : "Add URL"}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "file" ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Drop files here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, TXT, DOCX, Markdown — up to 20 MB each
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.docx"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />

            {/* Pending files */}
            {pendingFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {pendingFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={uploadFiles}
                  disabled={uploadState === "uploading"}
                  className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors mt-1"
                >
                  {uploadState === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
                  Upload {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">URL to crawl</label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://docs.yoursite.com/faq"
                    className="w-full pl-9 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Name (optional)</label>
              <input
                type="text"
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                placeholder="FAQ Page"
                className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              onClick={addUrl}
              disabled={!url || uploadState === "uploading"}
              className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {uploadState === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
              Add URL source
            </button>
          </div>
        )}

        {/* Status */}
        {uploadState !== "idle" && uploadMessage && (
          <div
            className={cn(
              "mt-3 flex items-center gap-2 text-sm p-3 rounded-md",
              uploadState === "success" && "bg-green-50 text-green-700",
              uploadState === "error" && "bg-destructive/10 text-destructive",
              uploadState === "uploading" && "bg-muted text-muted-foreground"
            )}
          >
            {uploadState === "success" && <CheckCircle2 className="w-4 h-4" />}
            {uploadState === "error" && <AlertCircle className="w-4 h-4" />}
            {uploadState === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploadMessage}
          </div>
        )}
      </div>
    </div>
  );
}
