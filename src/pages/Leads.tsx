import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, CheckCircle2, XCircle, Clock, TrendingUp, Play,
  RefreshCw, AlertCircle, ExternalLink, ChevronDown, ChevronUp,
  Zap, Mail, Building2, MapPin, Activity, BarChart3,
} from "lucide-react";
import clsx from "clsx";
import { GlassCard, NeonButton, SectionTitle } from "../components/ui";

/* ─── types ────────────────────────────────────────────────────── */
interface Lead {
  contact_id: string;
  email: string;
  first_name: string;
  last_name: string;
  title: string;
  company: string;
  website: string;
  employees: number;
  industry: string;
  city: string;
  state: string;
  score: number;
  score_reason: string;
  pain_point: string;
  email_subject: string;
  email_body: string;
  status: string;
  apollo_enroll_ok: boolean;
  apollo_sequence_id: string;
  created_at: string;
}

interface Stats {
  total: number;
  enrolled: number;
  rejected: number;
  pending_enroll: number;
  avg_score: number;
  last_run: string | null;
}

interface Execution {
  id: number;
  status: string;
  startedAt: string;
  stoppedAt: string;
  duration_s: number | null;
}

/* ─── helpers ──────────────────────────────────────────────────── */
function scoreColor(s: number) {
  if (s >= 85) return "text-emerald-300 bg-emerald-500/20 border-emerald-500/30";
  if (s >= 75) return "text-amber-300 bg-amber-500/20 border-amber-500/30";
  return "text-rose-300 bg-rose-500/20 border-rose-500/30";
}

function statusBadge(status: string, enroll_ok: boolean) {
  if (status === "enrolled" && enroll_ok)
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (status === "enrolled")
    return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  if (status === "pending_enroll")
    return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  return "bg-rose-500/20 text-rose-300 border-rose-500/30";
}

function statusLabel(status: string, enroll_ok: boolean) {
  if (status === "enrolled" && enroll_ok) return "Enrolled ✓";
  if (status === "enrolled") return "Enrolled (pending)";
  if (status === "pending_enroll") return "Pending Enroll";
  return "Rejected";
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function fmtDur(s: number | null) {
  if (s === null) return "—";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/* ─── stat card ─────────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <GlassCard className="p-4" hover={false}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
          <div className={clsx("mt-1 text-2xl font-extrabold", color)}>{value}</div>
          {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
        </div>
        <div className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", color.replace("text-", "bg-").replace("300", "500/15"))}>
          <Icon size={16} className={color} />
        </div>
      </div>
    </GlassCard>
  );
}

/* ─── expandable lead row ───────────────────────────────────────── */
function LeadRow({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
      >
        <td className="px-4 py-3">
          <span className={clsx("inline-block rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold", scoreColor(lead.score))}>
            {lead.score}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm font-semibold text-slate-100">{lead.company || "—"}</div>
          <div className="text-[11px] text-slate-500">{lead.employees ? `${lead.employees} emp` : ""} {lead.industry || ""}</div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 text-xs text-slate-300">
            <Mail size={11} className="text-purple-400 shrink-0" />
            {lead.email}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">{lead.title || ""}</div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin size={10} /> {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", statusBadge(lead.status, lead.apollo_enroll_ok))}>
            {statusLabel(lead.status, lead.apollo_enroll_ok)}
          </span>
        </td>
        <td className="px-4 py-3 text-[11px] text-slate-500">{fmtDate(lead.created_at)}</td>
        <td className="px-4 py-3 text-slate-500">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-white/[0.04]">
          <td colSpan={7} className="bg-white/[0.02] px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Score Reason</div>
                <p className="text-sm text-slate-300">{lead.score_reason || "—"}</p>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-3">Pain Point</div>
                <p className="text-sm text-slate-300">{lead.pain_point || "—"}</p>
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline">
                    <ExternalLink size={11} /> {lead.website}
                  </a>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email Draft</div>
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <div className="text-[11px] font-semibold text-purple-300 mb-1">Subject: {lead.email_subject || "—"}</div>
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{lead.email_body || "—"}</p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Pipeline tab ──────────────────────────────────────────────── */
function PipelineTab() {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<null | { ok: boolean; enrolled: number; rejected: number; leads_found: number; results: Array<{ email: string; company: string; score: number; status: string; enroll_ok: boolean }> }>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [exLoading, setExLoading] = useState(true);
  const [proxyOk, setProxyOk] = useState<boolean | null>(null);

  const loadExecutions = useCallback(() => {
    setExLoading(true);
    fetch("/api/leads/executions")
      .then((r) => r.json())
      .then(setExecutions)
      .catch(() => setExecutions([]))
      .finally(() => setExLoading(false));
  }, []);

  useEffect(() => {
    loadExecutions();
    fetch("/api/leads/proxy-health").then((r) => r.ok ? r.json() : null).then((d) => setProxyOk(!!(d?.status === "ok"))).catch(() => setProxyOk(false));
  }, [loadExecutions]);

  const runPipeline = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const r = await fetch("/api/leads/run-pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ per_page: 10, score_threshold: 75 }) });
      const d = await r.json();
      setRunResult(d);
      loadExecutions();
    } catch {
      setRunResult({ ok: false, enrolled: 0, rejected: 0, leads_found: 0, results: [] });
    }
    setRunning(false);
  };

  return (
    <div className="space-y-5">
      {/* pipeline architecture */}
      <GlassCard className="p-5" hover={false}>
        <SectionTitle>How the Pipeline Works</SectionTitle>
        <div className="mt-4 flex flex-wrap gap-3 items-center text-sm">
          {[
            { step: "1", label: "Apollo Search", desc: "Mixed people API — MSP owners, US, 1–100 emp" },
            { step: "2", label: "Bulk Reveal", desc: "Work emails via people/bulk_match" },
            { step: "3", label: "AI Score", desc: "Nemotron first → Claude Haiku fallback, 0–100 ICP fit" },
            { step: "4", label: "Enroll ≥75", desc: "Add to Apollo sequence via djuane@itechsmart.dev" },
            { step: "5", label: "Log to DB", desc: "Upsert into outbound_leads Postgres table" },
          ].map((s, i, arr) => (
            <div key={s.step} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-600/20 border border-cyan-400/20 text-xs font-bold text-cyan-300">
                  {s.step}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">{s.label}</div>
                <div className="text-[10px] text-slate-500">{s.desc}</div>
              </div>
              {i < arr.length - 1 && <div className="text-slate-600 mx-1">→</div>}
            </div>
          ))}
        </div>
        <div className="mt-4 grid sm:grid-cols-3 gap-3 text-[11px]">
          <div className="glass rounded-lg p-3">
            <div className="font-semibold text-slate-400 mb-1">Schedule</div>
            <div className="text-slate-300">Daily 9AM ET (Mon–Fri) via n8n cron</div>
          </div>
          <div className="glass rounded-lg p-3">
            <div className="font-semibold text-slate-400 mb-1">Sequence</div>
            <div className="text-slate-300">MSP Pilot Outreach — National (2026) · 5 steps · 17 days</div>
          </div>
          <div className="glass rounded-lg p-3">
            <div className="font-semibold text-slate-400 mb-1">Proxy Status</div>
            <div className={clsx("flex items-center gap-1", proxyOk === null ? "text-slate-500" : proxyOk ? "text-emerald-300" : "text-rose-300")}>
              {proxyOk === null ? "checking…" : proxyOk ? "● apollo-proxy v5 healthy" : "● proxy unreachable"}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* manual run */}
      <GlassCard className="p-5" hover={false}>
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Manual Run</SectionTitle>
            <p className="mt-1 text-xs text-slate-500">Pull 10 fresh MSP leads, score, enroll ≥75 in Apollo sequence</p>
          </div>
          <NeonButton onClick={runPipeline} disabled={running}>
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? "Running… (~6 min)" : "Run Pipeline Now"}
          </NeonButton>
        </div>

        {runResult && (
          <div className={clsx("mt-4 rounded-xl border p-4", runResult.ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10")}>
            {runResult.ok ? (
              <>
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <CheckCircle2 size={16} /> Pipeline completed — {runResult.leads_found} leads, {runResult.enrolled} enrolled, {runResult.rejected} rejected
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {runResult.results?.map((r) => (
                    <div key={r.email} className="glass rounded-lg p-2 text-[11px]">
                      <div className={clsx("inline-block rounded-full px-1.5 py-0.5 font-bold mb-1", scoreColor(r.score))}>{r.score}</div>
                      <div className="font-semibold text-slate-200 truncate">{r.company}</div>
                      <div className="text-slate-500 truncate">{r.email}</div>
                      <div className={clsx("mt-0.5 font-semibold", r.status === "enrolled" && r.enroll_ok ? "text-emerald-300" : r.status === "enrolled" ? "text-amber-300" : "text-rose-400")}>
                        {r.status === "enrolled" && r.enroll_ok ? "Enrolled ✓" : r.status === "enrolled" ? "Enrolled (pending)" : "Rejected"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-rose-300">
                <AlertCircle size={16} /> Pipeline error
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* execution history */}
      <GlassCard className="p-5" hover={false}>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>n8n Execution History</SectionTitle>
          <NeonButton variant="ghost" onClick={loadExecutions} disabled={exLoading}>
            <RefreshCw size={13} className={clsx(exLoading && "animate-spin")} /> Refresh
          </NeonButton>
        </div>
        {exLoading ? (
          <div className="py-6 text-center text-sm text-slate-500 shimmer-text">Loading…</div>
        ) : executions.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">No executions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Started</th>
                  <th className="px-3 py-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-slate-400">#{e.id}</td>
                    <td className="px-3 py-2">
                      <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border",
                        e.status === "success" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                          : e.status === "running" ? "bg-blue-500/15 text-blue-300 border-blue-500/25"
                          : "bg-rose-500/15 text-rose-300 border-rose-500/25"
                      )}>
                        {e.status === "success" ? <CheckCircle2 size={10} /> : e.status === "running" ? <Activity size={10} className="animate-pulse" /> : <XCircle size={10} />}
                        {e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-400">{fmtDate(e.startedAt)}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{fmtDur(e.duration_s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────────────── */
const TABS = ["Leads", "Pipeline"] as const;
type Tab = typeof TABS[number];
const FILTERS = ["all", "enrolled", "rejected", "pending_enroll"] as const;
type Filter = typeof FILTERS[number];

export default function LeadsPage() {
  const [tab, setTab] = useState<Tab>("Leads");
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const loadLeads = useCallback((f: Filter) => {
    setLoading(true);
    const params = f !== "all" ? `?status=${f}` : "";
    Promise.all([
      fetch(`/api/leads${params}`).then((r) => r.json()),
      fetch("/api/leads/stats").then((r) => r.json()),
    ])
      .then(([ld, st]) => {
        setLeads(ld.leads || []);
        setStats(st);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadLeads(filter); }, [filter, loadLeads]);

  const sorted = [...leads].sort((a, b) =>
    sortDir === "desc" ? b.score - a.score : a.score - b.score
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* header */}
      <GlassCard hover={false} className="p-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-400">Apollo.io · MSP Outbound</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
              Leads &amp; <span className="text-gradient">Pipeline</span>
            </h1>
            {stats?.last_run && (
              <p className="mt-1 text-sm text-slate-400">Last run {fmtDate(stats.last_run)}</p>
            )}
          </div>
          <NeonButton variant="ghost" onClick={() => loadLeads(filter)} disabled={loading}>
            <RefreshCw size={14} className={clsx(loading && "animate-spin")} /> Refresh
          </NeonButton>
        </div>

        {/* tabs */}
        <div className="mt-5 flex gap-1 border-b border-white/[0.08]">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx("px-4 py-2 text-sm font-semibold transition-colors rounded-t-lg",
                tab === t ? "text-cyan-300 border-b-2 border-cyan-400 -mb-px" : "text-slate-500 hover:text-slate-300"
              )}>
              {t}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* stats row */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Leads" value={stats.total} icon={Users} color="text-slate-300" />
          <StatCard label="Enrolled in Apollo" value={stats.enrolled} sub="emails firing" icon={CheckCircle2} color="text-emerald-300" />
          <StatCard label="Avg ICP Score" value={stats.avg_score ?? "—"} sub="out of 100" icon={TrendingUp} color="text-cyan-300" />
          <StatCard label="Pending Enroll" value={stats.pending_enroll} sub="retry next run" icon={Clock} color="text-amber-300" />
        </div>
      )}

      {/* tab content */}
      {tab === "Leads" && (
        <GlassCard className="p-5" hover={false}>
          {/* filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SectionTitle>
              {filter === "all" ? "All Leads" : filter === "enrolled" ? "Enrolled" : filter === "rejected" ? "Rejected" : "Pending Enroll"}
            </SectionTitle>
            <div className="ml-auto flex gap-1.5">
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={clsx("rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                    filter === f ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" : "text-slate-500 border border-white/10 hover:text-slate-300"
                  )}>
                  {f === "all" ? "All" : f === "enrolled" ? "Enrolled" : f === "rejected" ? "Rejected" : "Pending"}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="py-12 text-center text-sm shimmer-text">Loading leads…</div>}

          {!loading && leads.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              <BarChart3 size={32} className="mx-auto mb-3 opacity-30" />
              No leads found
            </div>
          )}

          {!loading && leads.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2 text-left cursor-pointer hover:text-slate-300 select-none"
                      onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}>
                      Score {sortDir === "desc" ? "↓" : "↑"}
                    </th>
                    <th className="px-4 py-2 text-left">Company</th>
                    <th className="px-4 py-2 text-left">Contact</th>
                    <th className="px-4 py-2 text-left">Location</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Added</th>
                    <th className="px-4 py-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((lead) => <LeadRow key={lead.email} lead={lead} />)}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}

      {tab === "Pipeline" && <PipelineTab />}
    </div>
  );
}
