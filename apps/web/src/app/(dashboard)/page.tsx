"use client";

import { useEffect, useState } from "react";
import { analyticsApi, conversationsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTime, truncate } from "@/lib/utils";
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  Bot,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}

export default function DashboardPage() {
  const { org } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [recentConvs, setRecentConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.overview(7),
      conversationsApi.list({ limit: 5 }),
    ])
      .then(([ov, convs]) => {
        setOverview(ov);
        setRecentConvs(convs.conversations);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const stats: StatCard[] = [
    {
      label: "Total conversations",
      value: overview?.totalConversations ?? 0,
      sub: "Last 7 days",
      icon: <MessageSquare className="w-5 h-5" />,
      color: "text-blue-500 bg-blue-50",
    },
    {
      label: "AI resolved",
      value: `${overview?.aiResolutionRate ?? 0}%`,
      sub: `${overview?.resolvedByAI ?? 0} tickets`,
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: "text-green-500 bg-green-50",
    },
    {
      label: "Escalated to human",
      value: overview?.escalatedToHuman ?? 0,
      sub: `${overview?.escalationRate ?? 0}% rate`,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: "text-amber-500 bg-amber-50",
    },
    {
      label: "Avg confidence",
      value: `${Math.round((overview?.avgConfidence ?? 0) * 100)}%`,
      sub: "RAG accuracy",
      icon: <Zap className="w-5 h-5" />,
      color: "text-purple-500 bg-purple-50",
    },
  ];

  const statusColors: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700",
    RESOLVED: "bg-green-100 text-green-700",
    ESCALATED: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening with your support.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, sub, icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                {icon}
              </div>
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm font-medium mt-0.5">{label}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Top questions */}
      {overview?.topQuestions?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Top questions this week</h2>
          </div>
          <div className="space-y-2">
            {overview.topQuestions.slice(0, 6).map((q: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5 text-right">{q.count}×</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${(q.count / overview.topQuestions[0].count) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-muted-foreground truncate max-w-xs">
                  {truncate(q.question, 60)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent conversations */}
      <div className="bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Recent conversations</h2>
          </div>
          <Link
            href="/conversations"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recentConvs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No conversations yet. Embed your widget to get started.
            </div>
          ) : (
            recentConvs.map((conv) => (
              <Link
                key={conv.id}
                href={`/conversations?id=${conv.id}`}
                className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        statusColors[conv.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {conv.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {conv._count.messages} messages
                    </span>
                  </div>
                  <p className="text-sm truncate">
                    {conv.messages[0]?.content
                      ? truncate(conv.messages[0].content, 80)
                      : "Empty conversation"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatRelativeTime(conv.createdAt)}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
