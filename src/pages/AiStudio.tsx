import React, { useEffect, useRef, useState } from 'react';
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

const API = "/api/v1";

const STUDIO_AGENTS = [
  { id: "claude",   name: "Claude",        color: "#CC785C", status: "online", type: "LLM",   endpoint: "claude",   tools: ["chat", "summarize", "reason", "code-review"] },
  { id: "nemotron", name: "Nemotron Ultra", color: "#76B900", status: "online", type: "LLM",   endpoint: "nemotron", tools: ["chat", "analyze", "draft", "translate"] },
  { id: "octoai",   name: "OctoAI",        color: "#FF6B35", status: "online", type: "Loop",  endpoint: "nemotron", tools: ["self-improve", "loop", "benchmark"] },
  { id: "codex",    name: "Codex",         color: "#A78BFA", status: "busy",   type: "Coder", endpoint: "claude",   tools: ["write-code", "debug", "refactor", "test-gen"] },
  { id: "hermes",   name: "Hermes Army",   color: "#00D4FF", status: "online", type: "Fleet", endpoint: "hermes",   tools: ["dispatch", "sweep", "report", "coordinate"] },
  { id: "ag2",      name: "AG2 GroupChat", color: "#FFB800", status: "online", type: "Group", endpoint: "hermes",   tools: ["groupchat", "it-ops", "escalate", "resolve"] },
];

const MEMORY: Record<string, string[]> = {
  claude: [
    "Knows full iTechSmart platform context",
    "Reviewed Gartner deck (Jun 2026)",
    "UAIO positioning locked",
    "Gartner briefing Jun 25, 5:15 PM ET",
    "Sprint 8 deployed successfully",
  ],
  nemotron: [
    "Running via NGC API (Nemotron Ultra 253B)",
    "Fallback model: Llama-3.1 70B",
    "Zero cost from NVIDIA Inception credits",
  ],
  hermes: [
    "185 agents live across 99 profiles",
    "Last dispatch: security audit sweep",
    "SEMI_AUTO mode at :8089",
    "3,428+ receipts sealed",
  ],
};

/* ─── Session types ─── */
interface Session {
  id: string;
  agent_id: string;
  title: string;
  messages: any[];
  created_at: string;
  updated_at?: string;
}

/* ─── Utility components ─── */
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: T.card,
        borderRadius: 10,
        padding: "16px 18px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}`,
        flexShrink: 0,
      }}
    />
  );
}

/* ─── Sessions Sidebar ─── */
interface SessionsSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  activeAgent: string;
  agents: typeof STUDIO_AGENTS;
  onSelect: (session: Session) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

function SessionsSidebar({
  sessions,
  activeSessionId,
  activeAgent,
  agents,
  onSelect,
  onCreate,
  onDelete,
}: SessionsSidebarProps) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Card style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 12px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: T.teal,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Sessions
          </span>
          <button
            onClick={onCreate}
            title="New session"
            style={{
              background: T.teal + "22",
              border: `1px solid ${T.teal}44`,
              borderRadius: 6,
              width: 22,
              height: 22,
              color: T.teal,
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            +
          </button>
        </div>

        {/* Session list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {sessions.length === 0 && (
            <p style={{ fontSize: 11, color: T.gray, margin: "8px 0", textAlign: "center" }}>
              No sessions yet.
              <br />
              Press + to start.
            </p>
          )}
          {sessions.map((s) => {
            const agent = agents.find((a) => a.id === s.agent_id) || agents[0];
            const isActive = s.id === activeSessionId;
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s)}
                style={{
                  background: isActive ? T.card2 : "transparent",
                  border: `1px solid ${isActive ? T.teal + "66" : "transparent"}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <Dot color={agent.color} size={6} />
                  <span
                    style={{
                      fontSize: 11,
                      color: isActive ? T.white : T.light,
                      fontWeight: isActive ? 700 : 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {s.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: T.gray,
                      cursor: "pointer",
                      fontSize: 12,
                      lineHeight: 1,
                      padding: "0 2px",
                      flexShrink: 0,
                      opacity: 0.6,
                    }}
                    title="Delete session"
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: 9, color: T.gray }}>
                  {agent.name} ·{" "}
                  {new Date(s.updated_at || s.created_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cross-link */}
        <div style={{ paddingTop: 10, borderTop: `1px solid ${T.card2}`, marginTop: 8 }}>
          <button
            onClick={() => navigate("/agents")}
            style={{
              background: "transparent",
              border: "none",
              color: T.teal,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 0",
              width: "100%",
              textAlign: "left",
            }}
          >
            → View in Agents
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ─── Memory + Tools Panel ─── */
interface MemoryToolsPanelProps {
  agent: typeof STUDIO_AGENTS[0];
  thread: any[];
  agentTools: string[];
}

function MemoryToolsPanel({ agent, thread, agentTools }: MemoryToolsPanelProps) {
  const mem = MEMORY[agent.id];
  return (
    <div style={{ width: 220, flexShrink: 0 }}>
      <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Session Tools section */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 10,
              color: T.purple,
              letterSpacing: 2,
              marginBottom: 8,
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Session Tools
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {agentTools.map((tool) => (
              <span
                key={tool}
                style={{
                  background: T.purple + "22",
                  border: `1px solid ${T.purple}44`,
                  borderRadius: 20,
                  padding: "3px 9px",
                  fontSize: 10,
                  color: T.purple,
                  fontWeight: 600,
                }}
              >
                {tool}
              </span>
            ))}
            {agentTools.length === 0 && (
              <span style={{ fontSize: 11, color: T.gray }}>No tools registered</span>
            )}
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${T.card2}`,
            paddingTop: 12,
            marginBottom: 12,
          }}
        />

        {/* Memory section */}
        <div
          style={{
            fontSize: 10,
            color: T.teal,
            letterSpacing: 2,
            marginBottom: 12,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {agent.name.toUpperCase()} MEMORY
        </div>
        {mem ? (
          <div style={{ fontSize: 12, color: T.light, lineHeight: 1.6, flex: 1 }}>
            {mem.map((item, i) => (
              <p key={i} style={{ margin: "0 0 8px" }}>
                • {item}
              </p>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: T.gray, margin: 0, flex: 1 }}>
            Memory panel loads from Letta :8283 on first interaction with this agent.
          </p>
        )}

        <div
          style={{
            marginTop: "auto",
            paddingTop: 12,
            borderTop: `1px solid ${T.card2}`,
            fontSize: 10,
            color: T.gray,
          }}
        >
          {agent.id}: {thread.length} messages this session
        </div>
      </Card>
    </div>
  );
}

/* ─── Main AI Studio Page ─── */
export default function AiStudioPage() {
  const navigate = useNavigate();

  // Agent + mode state
  const [activeAgent, setActiveAgent] = useState("claude");
  const [mode, setMode] = useState<"chat" | "task" | "train">("chat");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastError, setLastError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  // Local messages (keyed by agent id for non-session fallback)
  const [localMessages, setLocalMessages] = useState<Record<string, any[]>>({
    claude: [{ role: "assistant", content: "Claude ready. I have full context on iTechSmart — platform, strategy, positioning, and Sprint 8. What do you need?", time: "Now" }],
    nemotron: [{ role: "assistant", content: "Nemotron Ultra 253B online. Zero token cost via NVIDIA Inception. Ready for your query.", time: "Now" }],
    hermes: [{ role: "assistant", content: "Hermes Army dispatcher online. 185 agents ready. Send a mission.", time: "Now" }],
    ag2: [{ role: "assistant", content: "AG2 GroupChat ready. 6-agent IT-ops coalition at your service.", time: "Now" }],
  });

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Agent registry tools (fetched)
  const [registryTools, setRegistryTools] = useState<Record<string, string[]>>({});

  // Auto-save debounce ref
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agent = STUDIO_AGENTS.find((a) => a.id === activeAgent) || STUDIO_AGENTS[0];

  // Derive current thread: from session if active, else from localMessages
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const thread: any[] = activeSession ? activeSession.messages : (localMessages[activeAgent] || []);

  // Compute current agent tools: registry > STUDIO_AGENTS > []
  const currentTools: string[] =
    registryTools[activeAgent] || agent.tools || [];

  /* ── Fetch sessions on mount ── */
  useEffect(() => {
    fetch("/api/agentos/sessions")
      .then((r) => r.json())
      .then((data: Session[]) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch("/api/agentos/agent-registry")
      .then((r) => r.json())
      .then((data: any) => {
        if (data && typeof data === "object") {
          const map: Record<string, string[]> = {};
          Object.entries(data).forEach(([id, info]: [string, any]) => {
            if (Array.isArray(info?.tools)) map[id] = info.tools;
          });
          setRegistryTools(map);
        }
      })
      .catch(() => {});
  }, []);

  /* ── Auto-save session when messages change ── */
  useEffect(() => {
    if (!activeSessionId || !activeSession) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      fetch(`/api/agentos/sessions/${activeSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: activeSession.messages }),
      }).catch(() => {});
    }, 800);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [activeSession?.messages, activeSessionId]);

  /* ── Session helpers ── */
  function setSessionMessages(id: string, msgs: any[]) {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, messages: msgs, updated_at: new Date().toISOString() } : s
      )
    );
  }

  async function createSession() {
    const title = `${agent.name} · ${new Date().toLocaleDateString()}`;
    try {
      const res = await fetch("/api/agentos/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: activeAgent, title }),
      });
      const newSession: Session = await res.json();
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    } catch {
      // Fallback: create a local-only session
      const local: Session = {
        id: `local-${Date.now()}`,
        agent_id: activeAgent,
        title,
        messages: [],
        created_at: new Date().toISOString(),
      };
      setSessions((prev) => [local, ...prev]);
      setActiveSessionId(local.id);
    }
  }

  function selectSession(session: Session) {
    setActiveSessionId(session.id);
    setActiveAgent(session.agent_id);
    setTimeout(() => {
      if (threadRef.current)
        threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }, 50);
  }

  async function deleteSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
    fetch(`/api/agentos/sessions/${id}`, { method: "DELETE" }).catch(() => {});
  }

  /* ── Send message ── */
  async function send() {
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    setSending(true);
    setLastError("");
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const newUserMsg = { role: "user", content: text, time };

    // Add to correct thread
    let history: any[];
    if (activeSessionId && activeSession) {
      history = [...activeSession.messages];
      setSessionMessages(activeSessionId, [...history, newUserMsg]);
    } else {
      history = localMessages[activeAgent] || [];
      setLocalMessages((m) => ({ ...m, [activeAgent]: [...history, newUserMsg] }));
    }

    const systemPrompts: Record<string, string> = {
      claude:   "You are Claude, AI assistant for iTechSmart — a UAIO (Unified Autonomous IT Operations) platform. CEO DJuane Jackson is your operator. Be concise, strategic, and CEO-level helpful.",
      nemotron: "You are Nemotron Ultra, NVIDIA's most capable model. You assist the CEO of iTechSmart with strategic and technical analysis.",
      hermes:   "You are the Hermes Army dispatcher at iTechSmart. Report on agent status, dispatch tasks, and coordinate the 185-agent fleet.",
      codex:    "You are Codex, iTechSmart's code assistant. Help with engineering, architecture, and code review.",
      octoai:   "You are OctoAI, iTechSmart's self-improving loop agent. Analyze and improve.",
      ag2:      "You are the AG2 GroupChat coordinator at iTechSmart. Facilitate multi-agent collaboration.",
    };

    const apiMessages = [...history, { role: "user", content: text }]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const endpoint = `${API}/ai/${agent.endpoint}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          system: systemPrompts[activeAgent] || systemPrompts.claude,
          max_tokens: 1024,
        }),
      });
      const data = await res.json();
      if (data.content) {
        const reply = {
          role: "assistant",
          content: data.content,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          provider: data.provider,
        };
        if (activeSessionId && activeSession) {
          setSessionMessages(activeSessionId, [...activeSession.messages, newUserMsg, reply]);
        } else {
          setLocalMessages((m) => ({
            ...m,
            [activeAgent]: [...(m[activeAgent] || []), reply],
          }));
        }
      } else if (data.detail || data.error) {
        const errMsg = data.detail || data.error;
        setLastError(String(errMsg));
        const errReply = {
          role: "assistant",
          content: `⚠ ${errMsg}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        if (activeSessionId && activeSession) {
          setSessionMessages(activeSessionId, [...activeSession.messages, newUserMsg, errReply]);
        } else {
          setLocalMessages((m) => ({
            ...m,
            [activeAgent]: [...(m[activeAgent] || []), errReply],
          }));
        }
      }
    } catch (e: any) {
      setLastError(e.message || "Network error");
      const errReply = {
        role: "assistant",
        content: `⚠ Could not reach ${agent.name}. Check API key or service status.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      if (activeSessionId && activeSession) {
        setSessionMessages(activeSessionId, [...activeSession.messages, newUserMsg, errReply]);
      } else {
        setLocalMessages((m) => ({
          ...m,
          [activeAgent]: [...(m[activeAgent] || []), errReply],
        }));
      }
    } finally {
      setSending(false);
      setTimeout(() => {
        if (threadRef.current)
          threadRef.current.scrollTop = threadRef.current.scrollHeight;
      }, 50);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, height: "calc(100vh - 120px)" }}>
      {/* ── LEFT: Sessions sidebar ── */}
      <SessionsSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        activeAgent={activeAgent}
        agents={STUDIO_AGENTS}
        onSelect={selectSession}
        onCreate={createSession}
        onDelete={deleteSession}
      />

      {/* ── CENTER: Chat ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Agent selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {STUDIO_AGENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setActiveAgent(a.id);
                setActiveSessionId(null); // deselect session when switching agent
              }}
              style={{
                background: activeAgent === a.id ? a.color + "33" : "transparent",
                border: `1.5px solid ${activeAgent === a.id ? a.color : T.card2}`,
                borderRadius: 8,
                padding: "7px 14px",
                color: activeAgent === a.id ? a.color : T.gray,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Dot color={activeAgent === a.id ? a.color : T.gray} size={7} />
              {a.name}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 12,
            background: T.card,
            borderRadius: 8,
            padding: 4,
            width: "fit-content",
          }}
        >
          {(["chat", "task", "train"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? T.teal : "transparent",
                border: "none",
                borderRadius: 6,
                padding: "6px 16px",
                color: mode === m ? T.navy : T.gray,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Session label */}
        {activeSession && (
          <div
            style={{
              marginBottom: 8,
              padding: "6px 12px",
              background: T.teal + "11",
              border: `1px solid ${T.teal}33`,
              borderRadius: 6,
              fontSize: 11,
              color: T.teal,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>📋</span>
            <span style={{ fontWeight: 600 }}>{activeSession.title}</span>
            <button
              onClick={() => setActiveSessionId(null)}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: T.gray,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              ✕ close
            </button>
          </div>
        )}

        {/* Conversation thread */}
        <Card style={{ flex: 1, marginBottom: 12 }}>
          <div
            ref={threadRef}
            style={{
              height: "100%",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {thread.map((m: any, i: number) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    background: m.role === "user" ? T.teal + "22" : T.card2,
                    border: `1px solid ${m.role === "user" ? T.teal + "33" : "transparent"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: T.white,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </div>
                  {m.provider && (
                    <div style={{ fontSize: 9, color: T.gray, marginTop: 4 }}>
                      via {m.provider}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: T.gray, marginTop: 3 }}>{m.time}</div>
              </div>
            ))}
            {thread.length === 0 && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.gray,
                  fontSize: 13,
                }}
              >
                {activeSession
                  ? "Session started — send your first message."
                  : `Chat with ${agent.name}…`}
              </div>
            )}
            {sending && (
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div
                  style={{ background: T.card2, borderRadius: 10, padding: "10px 14px" }}
                >
                  <div style={{ fontSize: 13, color: T.gray }}>● ● ●</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Error bar */}
        {lastError && (
          <div
            style={{
              marginBottom: 8,
              padding: "8px 12px",
              background: T.red + "11",
              border: `1px solid ${T.red}33`,
              borderRadius: 6,
              fontSize: 11,
              color: T.red,
            }}
          >
            ⚠ {lastError}
          </div>
        )}

        {/* Input row */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={
              mode === "chat"
                ? `Chat with ${agent.name}…`
                : mode === "task"
                ? `Assign a task to ${agent.name}…`
                : `Feedback for ${agent.name}…`
            }
            style={{
              flex: 1,
              background: T.card2,
              border: `1px solid ${agent.color}33`,
              borderRadius: 8,
              padding: "10px 14px",
              color: T.white,
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={send}
            disabled={sending}
            style={{
              background: sending ? T.gray : agent.color,
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              color: T.navy,
              fontWeight: 700,
              cursor: sending ? "wait" : "pointer",
            }}
          >
            {mode === "chat" ? (sending ? "…" : "Send") : mode === "task" ? "Dispatch" : "Save"}
          </button>
        </div>
      </div>

      {/* ── RIGHT: Memory + Tools panel ── */}
      <MemoryToolsPanel agent={agent} thread={thread} agentTools={currentTools} />
    </div>
  );
}
