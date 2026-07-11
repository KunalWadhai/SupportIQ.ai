"use client";

import { useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Cell,
} from "recharts";
import { Loader2, TrendingUp, MessageSquare, CheckCircle2, AlertTriangle, Zap } from "lucide-react";

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    setLoading(true);
    analyticsApi.overview(period).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Failed to load analytics data. Please try again.
      </div>
    );
  }

  const pieData = [
    { name: "AI Resolved", value: data.resolvedByAI, color: "#22c55e" },
    { name: "Escalated", value: data.escalatedToHuman, color: "#f59e0b" },
    { name: "Open", value: data.openConversations, color: "#6366f1" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Support performance overview</p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-muted">
          {PERIOD_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                period === value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total conversations",
            value: data.totalConversations,
            icon: MessageSquare,
            color: "text-blue-500",
            bg: "bg-blue-50",
          },
          {
            label: "AI resolution rate",
            value: `${data.aiResolutionRate}%`,
            icon: CheckCircle2,
            color: "text-green-500",
            bg: "bg-green-50",
          },
          {
            label: "Escalation rate",
            value: `${data.escalationRate}%`,
            icon: AlertTriangle,
            color: "text-amber-500",
            bg: "bg-amber-50",
          },
          {
            label: "Avg confidence",
            value: `${Math.round(data.avgConfidence * 100)}%`,
            icon: Zap,
            color: "text-purple-500",
            bg: "bg-purple-50",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Conversations over time */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Conversations over time
        </h2>
        {data.conversationsByDay.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.conversationsByDay} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="Conversations"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resolution breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Resolution breakdown</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pieData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={90} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top questions */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Most asked questions</h2>
          {data.topQuestions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No data yet
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.topQuestions.slice(0, 8).map((q: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-medium text-muted-foreground text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(q.count / data.topQuestions[0].count) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{q.count}×</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{q.question}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
