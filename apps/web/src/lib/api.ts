const API_URL =
  typeof window === "undefined"
    ? process.env.API_INTERNAL_URL || "http://localhost:2026"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:2026";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("supportiq_token");
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data.data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: { name: string; email: string; password: string; orgName: string }) =>
    apiFetch<{ token: string; user: any; org: any }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    apiFetch<{ token: string; user: any; org: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => apiFetch<{ user: any; org: any }>("/api/auth/me"),
};

// ─── Knowledge Base ────────────────────────────────────────────────────────────
export const knowledgeApi = {
  list: () => apiFetch<any[]>("/api/knowledge"),

  uploadFile: (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_URL}/api/knowledge/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }).then((r) => r.json());
  },

  addUrl: (url: string, name?: string) =>
    apiFetch<any>("/api/knowledge/url", {
      method: "POST",
      body: JSON.stringify({ url, name }),
    }),

  deleteDocument: (id: string) =>
    apiFetch<{ id: string }>(`/api/knowledge/${id}`, { method: "DELETE" }),

  getStatus: (id: string) =>
    apiFetch<any>(`/api/knowledge/${id}/status`),
};

// ─── Conversations ─────────────────────────────────────────────────────────────
export const conversationsApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.status) qs.set("status", params.status);
    return apiFetch<{ conversations: any[]; total: number; page: number; totalPages: number }>(
      `/api/chat/conversations?${qs}`
    );
  },

  get: (id: string) => apiFetch<any>(`/api/chat/conversations/${id}`),

  resolve: (id: string) =>
    apiFetch<any>(`/api/chat/conversations/${id}/resolve`, { method: "PATCH" }),

  testChat: (message: string) =>
    apiFetch<any>("/api/chat/test", { method: "POST", body: JSON.stringify({ message }) }),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: (days = 30) => apiFetch<any>(`/api/analytics/overview?days=${days}`),
  knowledge: () => apiFetch<any>("/api/analytics/knowledge"),
};

// ─── Widget settings ──────────────────────────────────────────────────────────
export const widgetApi = {
  getConfig: (orgId: string) =>
    apiFetch<any>(`/api/widget/${orgId}/config`),

  updateSettings: (body: { widgetColor?: string; widgetGreeting?: string; name?: string }) =>
    apiFetch<any>("/api/widget/settings", { method: "PATCH", body: JSON.stringify(body) }),

  regenerateKey: () =>
    apiFetch<{ apiKey: string }>("/api/widget/regenerate-key", { method: "POST" }),
};
