"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { widgetApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Copy, RefreshCw, Check, Palette, MessageSquare, Code2, KeyRound, Loader2,
} from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6b7280",
];

export default function SettingsPage() {
  const { org, refreshUser } = useAuth();
  const [color, setColor] = useState(org?.widgetColor ?? "#6366f1");
  const [greeting, setGreeting] = useState(org?.widgetGreeting ?? "Hi! How can I help you today?");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await widgetApi.updateSettings({ widgetColor: color, widgetGreeting: greeting });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!confirm("Regenerate API key? Your existing embed will stop working immediately.")) return;
    setRegenerating(true);
    try {
      await widgetApi.regenerateKey();
      await refreshUser();
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const embedCode = `<!-- SupportIQ AI Widget -->
<script>
  window.SupportIQConfig = {
    apiKey: "${org?.apiKey}",
    orgId: "${org?.id}",
  };
</script>
<script src="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/widget.js" async></script>`;

  const iframeEmbed = `<iframe
  src="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/widget/${org?.id}?key=${org?.apiKey}"
  width="400"
  height="600"
  frameborder="0"
  allow="clipboard-write"
></iframe>`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Customise your AI support widget and manage API access.</p>
      </div>

      {/* Widget customisation */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Widget appearance</h2>
        </div>

        {/* Color picker */}
        <div>
          <label className="text-sm font-medium block mb-2">Brand colour</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-8 h-8 rounded-lg transition-all",
                  color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-input cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-28 h-10 rounded-md border border-input bg-background px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* Greeting message */}
        <div>
          <label className="text-sm font-medium block mb-1.5">
            <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />
            Opening greeting
          </label>
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            rows={2}
            maxLength={300}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">{greeting.length}/300</p>
        </div>

        {/* Widget preview */}
        <div>
          <p className="text-sm font-medium mb-2">Preview</p>
          <div
            className="w-64 rounded-2xl shadow-xl overflow-hidden border border-border"
          >
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ backgroundColor: color }}
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Support</p>
                <p className="text-white/70 text-xs">AI-powered</p>
              </div>
            </div>
            <div className="bg-background p-3">
              <div
                className="rounded-xl rounded-tl-none px-3 py-2 text-sm text-white max-w-[85%]"
                style={{ backgroundColor: color }}
              >
                {greeting || "Hi! How can I help?"}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? "Saved!" : "Save changes"}
        </button>
      </section>

      {/* API Key */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">API key</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This key authenticates your widget. Keep it private — it's embedded in your frontend.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate">
            {org?.apiKey}
          </code>
          <button
            onClick={() => copyToClipboard(org?.apiKey ?? "", "apikey")}
            className="flex-shrink-0 p-2 rounded-md border border-border hover:bg-muted transition-colors"
          >
            {copied === "apikey" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleRegenerateKey}
            disabled={regenerating}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm hover:bg-muted text-destructive transition-colors"
          >
            {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Regenerate
          </button>
        </div>
      </section>

      {/* Embed code */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Embed your widget</h2>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-medium">Script embed (recommended)</p>
            <button
              onClick={() => copyToClipboard(embedCode, "embed")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied === "embed" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
              Copy
            </button>
          </div>
          <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto font-mono text-muted-foreground">
{embedCode}
          </pre>
          <p className="text-xs text-muted-foreground mt-1">
            Paste before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-medium">iframe embed</p>
            <button
              onClick={() => copyToClipboard(iframeEmbed, "iframe")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied === "iframe" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
              Copy
            </button>
          </div>
          <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto font-mono text-muted-foreground">
{iframeEmbed}
          </pre>
        </div>
      </section>
    </div>
  );
}
