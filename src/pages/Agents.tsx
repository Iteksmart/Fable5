import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

const T = {
  navy: "#0A0F2C",
  darkNav: "#060A1A",
  card: "#141D3B",
  card2: "#1A2550",
  teal: "#00D4FF",
  green: "#00E5A0",
  gold: "#FFB800",
  red: "#FF4B4B",
  purple: "#A78BFA",
  white: "#FFFFFF",
  gray: "#8B9DC3",
  light: "#B8C5E0",
};

// ── Types ──────────────────────────────────────────────────────────────────

type AgentStatus = "online" | "degraded" | "healing" | "offline" | "busy" | string;

interface Agent {
  id: string;
  name: string;
  color?: string;
  status: AgentStatus;
  type?: string;
  provider?: string;
  tools?: string[];
  port?: number | null;
  // fields from /api/v1/agents/list
  endpoint?: string;
  description?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

interface Note {
  id: string;
  text: string;
  ts: string;
}

interface Task {
  id: string;
  text: string;
  done: boolean;
}

type PanelTab = "chat" | "notes" | "tasks";

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  online: T.green,
  degraded: T.gold,
  healing: T.gold,
  offline: T.red,
  busy: T.purple,
};

function statusColor(s: AgentStatus): string {
  return STATUS_COLOR[s] ?? T.gray;
}

function mergeAgents(primary: Agent[], registry: Agent[]): Agent[] {
  const seen = new Set<string>();
  const out: Agent[] = [];
  for (const a of primary) { seen.add(a.id); out.push(a); }
  for (const a of registry) { if (!seen.has(a.id)) { seen.add(a.id); out.push(a); } }
  return out;
}

const DEFAULT_AGENTS: Agent[] = [
  { id: "claude",   name: "Claude Sonnet 4.6",    color: "#CC785C", status: "online", type: "LLM",          provider: "Anthropic",  tools: ["reasoning", "code", "analysis", "summarize"], port: null },
  { id: "nemotron", name: "Nemotron Ultra 253B",   color: "#76B900", status: "online", type: "LLM",          provider: "NVIDIA NGC", tools: ["generation", "analysis", "draft"],            port: null },
  { id: "hermes",   name: "Hermes Army (98 agents)",color: "#00D4FF", status: "online", type: "Fleet",       provider: "iTechSmart", tools: ["dispatch", "orchestrate", "skill"],           port: 8089 },
  { id: "ag2",      name: "AG2 GroupChat",          color: "#FFB800", status: "online", type: "Group",       provider: "AutoGen2",   tools: ["multi-agent", "incident"],                    port: 8500 },
  { id: "octoai",   name: "OctoAI Loop",            color: "#FF6B35", status: "online", type: "Self-Improve",provider: "iTechSmart", tools: ["self-heal", "evolve"],                        port: 8100 },
  { id: "iself",    name: "iSELF Healer",           color: "#00E5A0", status: "healing",type: "Self-Healing",provider: "iTechSmart", tools: ["systemd", "health", "repair"],                port: 8215 },
  { id: "letta",    name: "Letta Memory",           color: "#A78BFA", status: "online", type: "Memory",      provider: "Letta",      tools: ["vector", "recall", "context"],                port: 8283 },
  { id: "ops-api",  name: "Ops API",                color: "#38BDF8", status: "online", type: "API",         provider: "iTechSmart", tools: ["receipts", "itsm", "sla"],                    port: 8210 },
];

function fmtTs(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch { return ts; }
}

let _noteId = 1;
let _taskId = 1;
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AgentStatus }) {
  const c = statusColor(status);
  return (
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: c,
        boxShadow: `0 0 6px ${c}`,
        flexShrink: 0,
      }}
    />
  );
}

function TypeBadge({ type }: { type: string | undefined }) {
  if (!type) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        background: `${T.purple}22`,
        color: T.purple,
        border: `1px solid ${T.purple}44`,
        textTransform: "uppercase",
        letterSpacing: "0.3px",
        whiteSpace: "nowrap",
      }}
    >
      {type}
    </span>
  );
}

function ToolPill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        background: `${T.teal}18`,
        color: T.teal,
        border: `1px solid ${T.teal}33`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function LoadingDots() {
  return (
    <span>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: T.teal,
            margin: "0 3px",
            animation: `pulse 1.2s ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

// ── Agent Detail Panel ─────────────────────────────────────────────────────

interface AgentPanelProps {
  agent: Agent;
  onClose: () => void;
}

function AgentPanel({ agent, onClose }: AgentPanelProps) {
  const navigate = useNavigate();
  const [panelTab, setPanelTab] = useState<PanelTab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg: Message = { role: "user", content: text, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/agentos/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agent.id,
          title: text.slice(0, 40),
          messages: [...messages, userMsg],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data.messages?.find((m: Message) => m.role === "assistant");
        if (reply) {
          setMessages(prev => [...prev, { ...reply, ts: new Date().toISOString() }]);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: `[${agent.name}] received: ${text}`, ts: new Date().toISOString() }]);
        }
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: `[${agent.name}] Error: server returned ${res.status}`, ts: new Date().toISOString() }]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `[${agent.name}] Error: ${e.message}`, ts: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  }

  const c = agent.color ?? T.teal;

  const panelTabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? `${c}22` : "transparent",
    color: active ? c : T.gray,
    border: `1px solid ${active ? c + "55" : "transparent"}`,
    borderRadius: 6,
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 400,
        height: "100vh",
        background: T.card,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        borderLeft: `1px solid ${T.card2}`,
        boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          borderBottom: `1px solid ${T.card2}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: `${c}22`,
              border: `2px solid ${c}66`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            🤖
          </span>
          <div>
            <div style={{ color: T.white, fontWeight: 700, fontSize: 14 }}>{agent.name}</div>
            <div style={{ color: T.gray, fontSize: 11 }}>{agent.provider ?? ""} · {agent.type ?? ""}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: T.gray, cursor: "pointer", padding: 4, fontSize: 18 }}
        >
          ✕
        </button>
      </div>

      {/* Panel tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 14px",
          borderBottom: `1px solid ${T.card2}`,
        }}
      >
        {(["chat", "notes", "tasks"] as PanelTab[]).map(t => (
          <button key={t} style={panelTabStyle(panelTab === t)} onClick={() => setPanelTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Panel body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* ── Chat ── */}
        {panelTab === "chat" && (
          <>
            <div
              ref={chatRef}
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 0,
                maxHeight: "calc(100vh - 280px)",
              }}
            >
              {messages.length === 0 && (
                <div style={{ color: T.gray, fontSize: 13, textAlign: "center", marginTop: 40 }}>
                  Start a conversation with {agent.name}
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: m.role === "user" ? `${c}22` : T.card2,
                    border: `1px solid ${m.role === "user" ? c + "44" : T.card2}`,
                    borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    padding: "9px 13px",
                  }}
                >
                  <div style={{ fontSize: 13, color: T.white, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </div>
                  {m.ts && (
                    <div style={{ fontSize: 10, color: T.gray, marginTop: 4, textAlign: "right" }}>
                      {fmtTs(m.ts)}
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div style={{ alignSelf: "flex-start" }}>
                  <div style={{ background: T.card2, borderRadius: "12px 12px 12px 2px", padding: "10px 14px" }}>
                    <LoadingDots />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
              <input
                style={{
                  flex: 1,
                  background: T.card2,
                  border: `1px solid ${T.gray}44`,
                  borderRadius: 8,
                  color: T.white,
                  padding: "9px 12px",
                  fontSize: 13,
                  outline: "none",
                }}
                placeholder={`Message ${agent.name}…`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                disabled={sending}
              />
              <button
                style={{
                  background: c,
                  border: "none",
                  borderRadius: 8,
                  color: T.navy,
                  padding: "9px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                  opacity: sending ? 0.5 : 1,
                }}
                onClick={sendMessage}
                disabled={sending}
              >
                Send
              </button>
            </div>
          </>
        )}

        {/* ── Notes ── */}
        {panelTab === "notes" && (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{
                  flex: 1,
                  background: T.card2,
                  border: `1px solid ${T.gray}44`,
                  borderRadius: 8,
                  color: T.white,
                  padding: "9px 12px",
                  fontSize: 13,
                  outline: "none",
                }}
                placeholder="Add a note…"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && noteInput.trim()) {
                    setNotes(prev => [{ id: uid(), text: noteInput.trim(), ts: new Date().toISOString() }, ...prev]);
                    setNoteInput("");
                  }
                }}
              />
              <button
                style={{
                  background: T.teal,
                  border: "none",
                  borderRadius: 8,
                  color: T.navy,
                  padding: "9px 14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onClick={() => {
                  if (noteInput.trim()) {
                    setNotes(prev => [{ id: uid(), text: noteInput.trim(), ts: new Date().toISOString() }, ...prev]);
                    setNoteInput("");
                  }
                }}
              >
                +
              </button>
            </div>
            {notes.length === 0 ? (
              <div style={{ color: T.gray, fontSize: 13, textAlign: "center", marginTop: 40 }}>
                No notes yet. Add one above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {notes.map(n => (
                  <div
                    key={n.id}
                    style={{
                      background: T.card2,
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, color: T.white }}>{n.text}</div>
                      <div style={{ fontSize: 11, color: T.gray, marginTop: 4 }}>{fmtTs(n.ts)}</div>
                    </div>
                    <button
                      style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 14, padding: "0 2px" }}
                      onClick={() => setNotes(prev => prev.filter(x => x.id !== n.id))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Tasks ── */}
        {panelTab === "tasks" && (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{
                  flex: 1,
                  background: T.card2,
                  border: `1px solid ${T.gray}44`,
                  borderRadius: 8,
                  color: T.white,
                  padding: "9px 12px",
                  fontSize: 13,
                  outline: "none",
                }}
                placeholder="Add a task…"
                value={taskInput}
                onChange={e => setTaskInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && taskInput.trim()) {
                    setTasks(prev => [{ id: uid(), text: taskInput.trim(), done: false }, ...prev]);
                    setTaskInput("");
                  }
                }}
              />
              <button
                style={{
                  background: T.green,
                  border: "none",
                  borderRadius: 8,
                  color: T.navy,
                  padding: "9px 14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                }}
                onClick={() => {
                  if (taskInput.trim()) {
                    setTasks(prev => [{ id: uid(), text: taskInput.trim(), done: false }, ...prev]);
                    setTaskInput("");
                  }
                }}
              >
                +
              </button>
            </div>
            {tasks.length === 0 ? (
              <div style={{ color: T.gray, fontSize: 13, textAlign: "center", marginTop: 40 }}>
                No tasks yet. Add one above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tasks.map(task => (
                  <div
                    key={task.id}
                    style={{
                      background: T.card2,
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))}
                      style={{ width: 15, height: 15, accentColor: T.green, cursor: "pointer", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: task.done ? T.gray : T.white,
                        textDecoration: task.done ? "line-through" : "none",
                      }}
                    >
                      {task.text}
                    </span>
                    <button
                      style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 14, padding: "0 2px" }}
                      onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Run Agent button */}
      <div
        style={{
          padding: "14px 16px",
          borderTop: `1px solid ${T.card2}`,
          display: "flex",
          gap: 8,
        }}
      >
        <button
          style={{
            flex: 1,
            background: c,
            border: "none",
            borderRadius: 8,
            color: T.navy,
            padding: "10px 0",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
          }}
          onClick={() => navigate(`/orchestrator?provider=${agent.id}`)}
        >
          Run Agent
        </button>
      </div>
    </div>
  );
}

// ── Agent Card ─────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: Agent;
  onOpen: (agent: Agent) => void;
}

function AgentCard({ agent, onOpen }: AgentCardProps) {
  const navigate = useNavigate();
  const c = agent.color ?? T.teal;
  const tools = agent.tools ?? [];
  const visibleTools = tools.slice(0, 4);
  const extraCount = tools.length - 4;

  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.card2}`,
        borderRadius: 12,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
        transition: "border-color 0.15s",
        position: "relative",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = `${c}66`)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = T.card2)}
      onClick={() => onOpen(agent)}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Agent icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: `${c}22`,
            border: `2px solid ${c}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          🤖
        </div>

        {/* Name + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <StatusDot status={agent.status} />
            <span style={{ fontSize: 15, fontWeight: 700, color: T.white }}>{agent.name}</span>
            <TypeBadge type={agent.type} />
            {agent.port != null && (
              <span style={{ fontSize: 11, color: T.gray, fontFamily: "monospace" }}>
                :{agent.port}
              </span>
            )}
          </div>
          {agent.provider && (
            <div style={{ fontSize: 12, color: T.gray, marginTop: 3 }}>{agent.provider}</div>
          )}
        </div>

        {/* Status indicator */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: statusColor(agent.status),
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            flexShrink: 0,
          }}
        >
          {agent.status}
        </span>
      </div>

      {/* Tools */}
      {tools.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {visibleTools.map(t => <ToolPill key={t} label={t} />)}
          {extraCount > 0 && (
            <span style={{ fontSize: 10, color: T.gray }}>+{extraCount} more</span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{ display: "flex", gap: 8 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          style={{
            flex: 1,
            background: `${c}22`,
            border: `1px solid ${c}55`,
            borderRadius: 8,
            color: c,
            padding: "8px 0",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 13,
          }}
          onClick={() => onOpen(agent)}
        >
          Open
        </button>
        <button
          style={{
            flex: 1,
            background: T.green,
            border: "none",
            borderRadius: 8,
            color: T.navy,
            padding: "8px 0",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 13,
          }}
          onClick={() => navigate(`/orchestrator?provider=${agent.id}`)}
        >
          Run Agent
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | AgentStatus>("all");

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both sources in parallel
      const [listRes, registryRes] = await Promise.allSettled([
        fetch("/api/v1/agents/list"),
        fetch("/api/agentos/agent-registry"),
      ]);

      let listAgents: Agent[] = [];
      let registryAgents: Agent[] = [];

      if (listRes.status === "fulfilled" && listRes.value.ok) {
        const data = await listRes.value.json();
        listAgents = Array.isArray(data) ? data : (data.agents ?? []);
      }

      if (registryRes.status === "fulfilled" && registryRes.value.ok) {
        const data = await registryRes.value.json();
        registryAgents = Array.isArray(data) ? data : (data.agents ?? []);
      }

      // Merge: use live agents if we got any, fall back to defaults only if both empty
      const primary = listAgents.length > 0 ? listAgents : DEFAULT_AGENTS;
      const merged = mergeAgents(primary, registryAgents);
      setAgents(merged.length > 0 ? merged : DEFAULT_AGENTS);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
      setAgents(DEFAULT_AGENTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const [integrations, setIntegrations] = React.useState<any>(null)
  useEffect(() => {
    fetch("/api/v1/integrations/all")
      .then(r => r.json())
      .then(setIntegrations)
      .catch(() => {})
  }, [])

  const [aiIntelData, setAiIntelData] = React.useState<any>(null);
  useEffect(() => {
    Promise.all([
      fetch('/api/integrations/langfuse/traces').then(r => r.json()).catch(() => null),
      fetch('/api/integrations/weaviate/meta').then(r => r.json()).catch(() => null),
      fetch('/api/integrations/ragflow/datasets').then(r => r.json()).catch(() => null),
    ]).then(([langfuse, weaviate, ragflow]) => {
      setAiIntelData({ langfuse, weaviate, ragflow });
    }).catch(() => {});
  }, []);

  const statuses = ["all", ...Array.from(new Set(agents.map(a => a.status)))];

  const filtered = agents.filter(a => {
    const matchSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.provider ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.type ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.tools ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.darkNav,
        padding: "32px 24px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: T.white,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: T.white, margin: 0, letterSpacing: "-0.5px" }}>
            Agent Registry
          </h1>
          <p style={{ fontSize: 14, color: T.gray, marginTop: 6, marginBottom: 0 }}>
            Live view of all agents in the iTechSmart UAIO platform.
          </p>
        </div>
        <button
          style={{
            background: "transparent",
            border: `1px solid ${T.teal}55`,
            borderRadius: 8,
            color: T.teal,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            textDecoration: "none",
          }}
          onClick={() => navigate("/policies")}
        >
          → View Policies
        </button>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{
            background: T.card2,
            border: `1px solid ${T.gray}44`,
            borderRadius: 8,
            color: T.white,
            padding: "9px 14px",
            fontSize: 14,
            outline: "none",
            flexGrow: 1,
            maxWidth: 320,
            minWidth: 180,
          }}
          placeholder="Search agents, tools, providers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          style={{
            background: T.card2,
            border: `1px solid ${T.gray}44`,
            borderRadius: 8,
            color: T.white,
            padding: "9px 14px",
            fontSize: 14,
            outline: "none",
            cursor: "pointer",
          }}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
        >
          {statuses.map(s => (
            <option key={s} value={s}>
              {s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button
          style={{
            background: T.card2,
            border: `1px solid ${T.gray}44`,
            borderRadius: 8,
            color: T.teal,
            padding: "9px 16px",
            fontSize: 16,
            cursor: "pointer",
            flexShrink: 0,
          }}
          onClick={fetchAgents}
          title="Refresh"
        >
          ↻
        </button>
        <span style={{ fontSize: 13, color: T.gray, marginLeft: 4 }}>
          {loading ? "Loading…" : `${filtered.length} agent${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: `${T.gold}18`,
            border: `1px solid ${T.gold}44`,
            borderRadius: 8,
            padding: "12px 16px",
            color: T.gold,
            fontSize: 14,
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠ {error} — showing defaults</span>
          <button
            style={{ background: "transparent", border: `1px solid ${T.gold}66`, color: T.gold, borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}
            onClick={fetchAgents}
          >
            Retry
          </button>
        </div>
      )}

      {/* Status overview pills */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {(["online", "degraded", "healing", "offline", "busy"] as AgentStatus[]).map(s => {
          const count = agents.filter(a => a.status === s).length;
          if (!count) return null;
          return (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: `${statusColor(s)}18`,
                border: `1px solid ${statusColor(s)}44`,
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 12,
                color: statusColor(s),
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: statusColor(s),
                  display: "inline-block",
                }}
              />
              {count} {s}
            </div>
          );
        })}
      </div>

      {/* Agent grid */}
      {loading && agents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: T.gray }}>
          <LoadingDots />
          <p style={{ marginTop: 12 }}>Loading agents…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: T.gray, fontSize: 15 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <p>No agents match your filters.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map(agent => (
            <AgentCard key={agent.id} agent={agent} onOpen={setSelectedAgent} />
          ))}
        </div>
      )}

      {/* Footer nav */}
      <div
        style={{
          marginTop: 40,
          paddingTop: 24,
          borderTop: `1px solid ${T.card2}`,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <button
          style={{
            color: T.teal,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            textDecoration: "underline",
            textDecorationColor: `${T.teal}55`,
          }}
          onClick={() => navigate("/agent-store")}
        >
          → Browse Agent Store
        </button>
        <button
          style={{
            color: T.teal,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            textDecoration: "underline",
            textDecorationColor: `${T.teal}55`,
          }}
          onClick={() => navigate("/audit")}
        >
          → View Audit receipts
        </button>
        <button
          style={{
            color: T.teal,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            textDecoration: "underline",
            textDecorationColor: `${T.teal}55`,
          }}
          onClick={() => navigate("/policies")}
        >
          → Agent guardrail policies
        </button>
      </div>

      {/* ── AI Intelligence Panels ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,margin:"24px 0"}}>
        {/* Langfuse */}
        <div style={{background:"#141D3B",borderRadius:16,padding:20,border:"1px solid #1A2550"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#00D4FF",marginBottom:12}}>Langfuse — AI Traces</div>
          {aiIntelData?.langfuse ? (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#94a3b8"}}>Traces</span>
                <span style={{color:"#e2e8f0",fontWeight:600}}>{aiIntelData.langfuse.total_traces ?? 0}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#94a3b8"}}>Avg Latency</span>
                <span style={{color:"#00E5A0",fontWeight:600}}>{aiIntelData.langfuse.avg_latency_ms ?? "—"}ms</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#94a3b8"}}>Total Tokens</span>
                <span style={{color:"#e2e8f0",fontWeight:600}}>{(aiIntelData.langfuse.total_tokens ?? 0).toLocaleString()}</span>
              </div>
              {aiIntelData.langfuse.models && aiIntelData.langfuse.models.length > 0 && (
                <div style={{fontSize:10,color:"#64748b",marginTop:4}}>Models: {aiIntelData.langfuse.models.join(", ")}</div>
              )}
            </div>
          ) : (
            <div style={{fontSize:11,color:"#475569"}}>Configure Langfuse API keys to view traces</div>
          )}
        </div>

        {/* Weaviate */}
        <div style={{background:"#141D3B",borderRadius:16,padding:20,border:"1px solid #1A2550"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#00D4FF",marginBottom:12}}>Weaviate Knowledge Graph</div>
          {aiIntelData?.weaviate ? (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#94a3b8"}}>Classes</span>
                <span style={{color:"#e2e8f0",fontWeight:600}}>{aiIntelData.weaviate.classCount ?? 0}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#94a3b8"}}>Objects</span>
                <span style={{color:"#e2e8f0",fontWeight:600}}>{(aiIntelData.weaviate.totalObjectCount ?? 0).toLocaleString()}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#94a3b8"}}>Status</span>
                <span style={{color:"#00E5A0",fontWeight:600}}>{aiIntelData.weaviate.status ?? "ready"}</span>
              </div>
            </div>
          ) : (
            <div style={{fontSize:11,color:"#475569"}}>Weaviate at :8383 — connecting…</div>
          )}
        </div>

        {/* RAGFlow */}
        <div style={{background:"#141D3B",borderRadius:16,padding:20,border:"1px solid #1A2550"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#00D4FF",marginBottom:12}}>RAGFlow Collections</div>
          {aiIntelData?.ragflow ? (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#94a3b8"}}>Collections</span>
                <span style={{color:"#e2e8f0",fontWeight:600}}>{aiIntelData.ragflow.total ?? 0}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:"#94a3b8"}}>Documents</span>
                <span style={{color:"#e2e8f0",fontWeight:600}}>{(aiIntelData.ragflow.total_documents ?? 0).toLocaleString()}</span>
              </div>
              {aiIntelData.ragflow.datasets && aiIntelData.ragflow.datasets.slice(0,3).map((ds: any, i: number) => (
                <div key={i} style={{fontSize:10,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ds.name}</div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:11,color:"#475569"}}>RAGFlow at :9380 — connecting…</div>
          )}
        </div>
      </div>

      {/* Agent detail panel */}
      {selectedAgent && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 49,
            }}
            onClick={() => setSelectedAgent(null)}
          />
          <AgentPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
        </>
      )}

    </div>
  );
}

