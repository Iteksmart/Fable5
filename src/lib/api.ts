// API client + shared types for Mission Control.

export interface Metrics {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  cpuModel: string;
  uptime: number;
  totalMem: number;
  freeMem: number;
  loadavg: number[];
  history: { t: number; cpu: number; mem: number; load: number }[];
  current?: { t: number; cpu: number; mem: number; load: number };
}

export interface ServiceProbe {
  id: string;
  name: string;
  url: string;
  internal?: boolean;
  up: boolean;
  status: number;
  ms: number;
  error?: string;
}

export interface TunnelInfo {
  id: string;
  service: string;
  active: boolean;
  state: string;
}

export interface Client {
  id: string;
  name: string;
  contact: string;
  email: string;
  plan: string;
  mrr: number;
  devices: number;
  sla: string;
  health: number;
  since: string;
}

export interface Ticket {
  id: string;
  subject: string;
  client: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  assignee: string;
  created: string;
  sla_due: string;
}

export interface Invoice {
  id: string;
  client: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue";
  issued: string;
  due: string;
}

export interface Activity {
  id: string;
  ts: string;
  kind: string;
  text: string;
}

export interface ProviderInfo {
  label: string;
  vendor: string;
  defaultModel: string;
  models: string[];
}

export type ProviderId = "claude" | "codex" | "gemini" | "nemotron" | "octoai" | "hermes";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  metrics: () => j<Metrics>("/api/metrics"),
  services: () => j<ServiceProbe[]>("/api/services"),
  tunnel: () => j<TunnelInfo>("/api/tunnel"),
  providers: () =>
    j<{ providers: Record<ProviderId, ProviderInfo>; keys: Record<ProviderId, boolean> }>(
      "/api/ai/providers"
    ),
  reloadSecrets: () =>
    j<{ keys: Record<ProviderId, boolean> }>("/api/ai/reload-secrets", { method: "POST" }),

  list: <T>(col: string) => j<T[]>(`/api/${col}`),
  createRec: <T>(col: string, body: Partial<T>) =>
    j<T>(`/api/${col}`, { method: "POST", body: JSON.stringify(body) }),
  updateRec: <T>(col: string, id: string, body: Partial<T>) =>
    j<T>(`/api/${col}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRec: (col: string, id: string) => j<{ deleted: boolean }>(`/api/${col}/${id}`, { method: "DELETE" }),
};

// Streams a chat completion; calls onDelta per text chunk.
export async function streamChat(
  opts: {
    provider: ProviderId;
    model?: string;
    system?: string;
    messages: ChatMessage[];
  },
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<{ ms?: number; error?: string }> {
  const r = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
    signal,
  });
  if (!r.body) return { error: "no response body" };
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: { ms?: number; error?: string } = {};
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      try {
        const msg = JSON.parse(t.slice(5));
        if (msg.delta) onDelta(msg.delta);
        if (msg.error) result.error = msg.error;
        if (msg.done) result.ms = msg.ms;
      } catch {
        /* ignore malformed frame */
      }
    }
  }
  return result;
}

export function fmtBytes(n: number): string {
  if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(1)} GB`;
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

export function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
