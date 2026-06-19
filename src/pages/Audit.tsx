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

interface Receipt {
  hash_sha256?: string;
  hash?: string;
  id?: string;
  actor?: string;
  category?: string;
  action?: string;
  summary?: string;
  outcome?: string;
  timestamp?: string;
  ts?: string;
  chain_id?: string;
  metadata?: Record<string, unknown>;
}

interface Trace {
  id: string;
  agent: string;
  action: string;
  status: "completed" | "running" | "failed";
  duration_ms: number;
  ts: string;
  receipt_hash?: string;
  chain_id?: string;
}

interface TracesResponse {
  traces: Trace[];
  total: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function fmtTs(ts: string | undefined): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function hashShort(h: string | undefined): string {
  if (!h) return "—";
  return h.slice(0, 16) + "…";
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 9px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        textTransform: "uppercase",
        letterSpacing: "0.3px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: Trace["status"] }) {
  const colorMap: Record<Trace["status"], string> = {
    completed: T.green,
    running: T.gold,
    failed: T.red,
  };
  return <Badge label={status} color={colorMap[status] ?? T.gray} />;
}

function AgentDot({ name, color }: { name: string; color?: string }) {
  const hue = color ?? T.teal;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: hue,
          boxShadow: `0 0 6px ${hue}`,
          flexShrink: 0,
        }}
      />
      <span style={{ color: T.light, fontSize: 13 }}>{name}</span>
    </span>
  );
}

// Derive a colour for an agent name deterministically
function agentColor(name: string): string {
  const palette = [T.teal, T.green, T.gold, T.purple, "#FF6B35", "#38BDF8", "#F472B6"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

// ── Receipts Tab ────────────────────────────────────────────────────────────

interface ReceiptsTabProps {
  initialHash?: string;
}

function ReceiptsTab({ initialHash }: ReceiptsTabProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterHash, setFilterHash] = useState(initialHash ?? "");
  const [filterActor, setFilterActor] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 25;

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filterHash.trim()) params.set("hash", filterHash.trim());
      if (filterActor.trim()) params.set("actor", filterActor.trim());
      if (filterCat.trim()) params.set("category", filterCat.trim());

      const res = await fetch(`/api/audit/receipts?${params}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const list: Receipt[] = Array.isArray(data)
        ? data
        : data.receipts ?? data.entries ?? [];
      setReceipts(list);
      setTotal(data.total ?? list.length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load receipts");
    } finally {
      setLoading(false);
    }
  }, [page, filterHash, filterActor, filterCat]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  // When initialHash changes (from URL param), update filter
  useEffect(() => {
    if (initialHash) setFilterHash(initialHash);
  }, [initialHash]);

  const s = styles;

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <input
          style={s.input}
          placeholder="Filter by hash…"
          value={filterHash}
          onChange={e => { setFilterHash(e.target.value); setPage(0); }}
        />
        <input
          style={s.input}
          placeholder="Filter by actor…"
          value={filterActor}
          onChange={e => { setFilterActor(e.target.value); setPage(0); }}
        />
        <input
          style={s.input}
          placeholder="Filter by category…"
          value={filterCat}
          onChange={e => { setFilterCat(e.target.value); setPage(0); }}
        />
        <button style={s.refreshBtn} onClick={fetchReceipts} title="Refresh">
          ↻
        </button>
      </div>

      {error && (
        <div style={s.errorBanner}>
          {error}
          <button style={s.retryBtn} onClick={fetchReceipts}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={s.loadingWrap}>
          <LoadingDots />
          <p style={{ marginTop: 12, color: T.gray }}>Loading receipts…</p>
        </div>
      ) : receipts.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
          <p>No receipts found{filterHash || filterActor || filterCat ? " matching your filters" : ""}.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {receipts.map((r, i) => {
              const hash = r.hash_sha256 ?? r.hash ?? r.id ?? `r-${i}`;
              const ts = r.timestamp ?? r.ts;
              return (
                <div key={hash} style={s.receiptCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                        {r.actor && <Badge label={r.actor} color={T.teal} />}
                        {r.category && <Badge label={r.category} color={T.purple} />}
                        {r.outcome && (
                          <Badge
                            label={r.outcome}
                            color={r.outcome === "success" ? T.green : r.outcome === "failed" ? T.red : T.gold}
                          />
                        )}
                      </div>
                      {r.action && (
                        <p style={{ margin: "0 0 6px", color: T.white, fontSize: 14, fontWeight: 600 }}>
                          {r.action}
                        </p>
                      )}
                      {r.summary && (
                        <p style={{ margin: 0, color: T.gray, fontSize: 13, lineHeight: 1.5 }}>
                          {r.summary}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: T.gray, marginBottom: 4 }}>{fmtTs(ts)}</div>
                      {r.chain_id && (
                        <div style={{ fontSize: 11, color: T.purple }}>chain: {r.chain_id.slice(0, 8)}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: "8px 12px", background: T.card2, borderRadius: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: T.gray, fontFamily: "monospace" }}>SHA-256:</span>
                    <span style={{ fontSize: 11, color: T.teal, fontFamily: "monospace", wordBreak: "break-all" }}>{hash}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
            <span style={{ color: T.gray, fontSize: 13 }}>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ ...s.pageBtn, opacity: page === 0 ? 0.4 : 1 }}
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prev
              </button>
              <button
                style={{ ...s.pageBtn, opacity: (page + 1) * PAGE_SIZE >= total ? 0.4 : 1 }}
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Traces Tab ─────────────────────────────────────────────────────────────

function TracesTab() {
  const navigate = useNavigate();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);

  const fetchTraces = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      offset.current = 0;
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "25", offset: String(offset.current) });
      const res = await fetch(`/api/agentos/traces?${params}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: TracesResponse = await res.json();
      const list = data.traces ?? [];
      if (reset) {
        setTraces(list);
      } else {
        setTraces(prev => [...prev, ...list]);
      }
      setTotal(data.total ?? list.length);
      offset.current += list.length;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load traces");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchTraces(true); }, [fetchTraces]);

  const s = styles;

  const handleVerify = (hash: string) => {
    navigate(`/audit?hash=${encodeURIComponent(hash)}`);
  };

  return (
    <div>
      {/* Cross-link banner */}
      <div style={s.crossLinkBanner}>
        <span style={{ fontSize: 13, color: T.teal }}>
          Traces are sealed as ProofLink receipts →{" "}
          <button
            style={{ ...s.inlineLink, fontSize: 13 }}
            onClick={() => navigate("/audit")}
          >
            See all receipts in the Receipts tab
          </button>
        </span>
        <button style={s.refreshBtn} onClick={() => fetchTraces(true)} title="Refresh">↻</button>
      </div>

      {error && (
        <div style={s.errorBanner}>
          {error}
          <button style={s.retryBtn} onClick={() => fetchTraces(true)}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={s.loadingWrap}>
          <LoadingDots />
          <p style={{ marginTop: 12, color: T.gray }}>Loading traces…</p>
        </div>
      ) : traces.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <p>No execution traces found.</p>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div style={s.tableHeader}>
            <span style={{ flex: "0 0 160px" }}>Agent</span>
            <span style={{ flex: "0 0 140px" }}>Action</span>
            <span style={{ flex: "0 0 110px" }}>Status</span>
            <span style={{ flex: "0 0 80px" }}>Duration</span>
            <span style={{ flex: "0 0 160px" }}>Timestamp</span>
            <span style={{ flex: 1 }}>Receipt</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {traces.map((trace) => (
              <div key={trace.id} style={s.traceRow}>
                <span style={{ flex: "0 0 160px", minWidth: 0, overflow: "hidden" }}>
                  <AgentDot name={trace.agent} color={agentColor(trace.agent)} />
                </span>
                <span style={{ flex: "0 0 140px", minWidth: 0 }}>
                  <Badge label={trace.action} color={T.purple} />
                </span>
                <span style={{ flex: "0 0 110px" }}>
                  <StatusBadge status={trace.status} />
                </span>
                <span style={{ flex: "0 0 80px", color: T.light, fontSize: 13 }}>
                  {fmtDuration(trace.duration_ms)}
                </span>
                <span style={{ flex: "0 0 160px", color: T.gray, fontSize: 12 }}>
                  {fmtTs(trace.ts)}
                </span>
                <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                  {trace.receipt_hash ? (
                    <>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: T.teal }}>
                        {hashShort(trace.receipt_hash)}
                      </span>
                      <button
                        style={s.verifyLink}
                        onClick={() => handleVerify(trace.receipt_hash!)}
                      >
                        → Verify
                      </button>
                    </>
                  ) : (
                    <span style={{ color: T.gray, fontSize: 12 }}>no receipt</span>
                  )}
                  {trace.chain_id && (
                    <span style={{ fontSize: 11, color: T.purple, marginLeft: 6 }}>
                      chain: {trace.chain_id.slice(0, 8)}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Load More */}
          {traces.length < total && (
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button
                style={s.loadMoreBtn}
                onClick={() => fetchTraces(false)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : `Load More (${total - traces.length} remaining)`}
              </button>
            </div>
          )}
          <div style={{ marginTop: 12, color: T.gray, fontSize: 13, textAlign: "center" }}>
            Showing {traces.length} of {total} traces
          </div>
        </>
      )}
    </div>
  );
}

// ── Loading dots ────────────────────────────────────────────────────────────

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

// ── Shared styles ──────────────────────────────────────────────────────────

const styles = {
  input: {
    background: T.card2,
    border: `1px solid ${T.gray}44`,
    borderRadius: 6,
    color: T.white,
    padding: "9px 12px",
    fontSize: 14,
    outline: "none",
    minWidth: 160,
    flexGrow: 1,
    maxWidth: 280,
  } as React.CSSProperties,

  refreshBtn: {
    background: T.card2,
    border: `1px solid ${T.gray}44`,
    borderRadius: 6,
    color: T.teal,
    padding: "8px 14px",
    fontSize: 16,
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  errorBanner: {
    background: `${T.red}18`,
    border: `1px solid ${T.red}44`,
    borderRadius: 8,
    padding: "12px 16px",
    color: T.red,
    fontSize: 14,
    marginBottom: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  retryBtn: {
    background: "transparent",
    border: `1px solid ${T.red}66`,
    color: T.red,
    borderRadius: 6,
    padding: "5px 14px",
    fontSize: 12,
    cursor: "pointer",
  } as React.CSSProperties,

  loadingWrap: {
    textAlign: "center" as const,
    padding: "60px 20px",
    color: T.gray,
    fontSize: 14,
  } as React.CSSProperties,

  emptyState: {
    textAlign: "center" as const,
    padding: "60px 20px",
    color: T.gray,
    fontSize: 15,
  } as React.CSSProperties,

  receiptCard: {
    background: T.card,
    border: `1px solid ${T.card2}`,
    borderRadius: 10,
    padding: "16px 20px",
  } as React.CSSProperties,

  pageBtn: {
    background: T.card2,
    border: `1px solid ${T.gray}44`,
    borderRadius: 6,
    color: T.light,
    padding: "8px 16px",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
  } as React.CSSProperties,

  crossLinkBanner: {
    background: `${T.teal}12`,
    border: `1px solid ${T.teal}33`,
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  inlineLink: {
    background: "none",
    border: "none",
    color: T.teal,
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
    textDecorationColor: `${T.teal}55`,
    fontWeight: 600,
  } as React.CSSProperties,

  tableHeader: {
    display: "flex",
    gap: 8,
    padding: "8px 14px",
    background: T.card2,
    borderRadius: 8,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: 700,
    color: T.gray,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  } as React.CSSProperties,

  traceRow: {
    display: "flex",
    gap: 8,
    padding: "12px 14px",
    background: T.card,
    borderRadius: 8,
    alignItems: "center",
    border: `1px solid ${T.card2}`,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  verifyLink: {
    background: "none",
    border: `1px solid ${T.teal}55`,
    borderRadius: 4,
    color: T.teal,
    cursor: "pointer",
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,

  loadMoreBtn: {
    background: T.card2,
    border: `1px solid ${T.teal}44`,
    borderRadius: 8,
    color: T.teal,
    padding: "10px 28px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,
};

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AuditPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"receipts" | "traces">("receipts");

  // Support ?hash= query param to pre-filter receipts
  const [initialHash, setInitialHash] = useState<string | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const h = params.get("hash");
    if (h) {
      setInitialHash(h);
      setActiveTab("receipts");
    }
  }, []);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? T.teal : "transparent",
    color: active ? T.navy : T.gray,
    border: `1px solid ${active ? T.teal : T.gray + "44"}`,
    borderRadius: 8,
    padding: "8px 22px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s",
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
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: T.white,
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          Audit & Receipts
        </h1>
        <p style={{ fontSize: 14, color: T.gray, marginTop: 6, marginBottom: 0 }}>
          Immutable ProofLink receipts and execution traces from all agents.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <button style={tabStyle(activeTab === "receipts")} onClick={() => setActiveTab("receipts")}>
          Receipts
        </button>
        <button style={tabStyle(activeTab === "traces")} onClick={() => setActiveTab("traces")}>
          Execution Traces
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "receipts" ? (
        <ReceiptsTab key={initialHash ?? "none"} initialHash={initialHash} />
      ) : (
        <TracesTab />
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
          onClick={() => navigate("/approvals")}
        >
          → Review pending approvals
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
          → View agent guardrail policies
        </button>
      </div>
    </div>
  );
}
