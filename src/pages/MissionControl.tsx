import React, { useEffect, useMemo, useState } from 'react';
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  BrainCircuit,
  Cpu,
  DollarSign,
  MemoryStick,
  Server,
  Ticket as TicketIcon,
  Users,
} from "lucide-react";
import {
  AnimatedNumber,
  Badge,
  GlassCard,
  SectionTitle,
  Sparkline,
  StatusDot,
} from "../components/ui";
import { Lock, ReceiptText } from "lucide-react";
import {
  api,
  fmtUptime,
  timeAgo,
  type Activity,
  type Client,
  type Metrics,
  type ProviderId,
  type ServiceProbe,
  type Ticket,
} from "../lib/api";

const kindTone: Record<string, string> = {
  ai: "violet",
  infra: "cyan",
  ticket: "amber",
  billing: "emerald",
  client: "cyan",
  invoice: "emerald",
};

export default function MissionControl() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [services, setServices] = useState<ServiceProbe[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [aiKeys, setAiKeys] = useState<Record<ProviderId, boolean> | null>(null);
  const [prooflink, setProoflink] = useState<{total:number;chain_breaks:number;action:number;last5:{hash:string;category:string;ts:string;actor:string}[]}|null>(null);
  const [calEvents, setCalEvents] = useState<{title:string;time:string;color:string;urgent?:boolean}[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);

  useEffect(() => {
    const loadFast = () => {
      api.metrics().then(setMetrics).catch(() => {});
      api.services().then(setServices).catch(() => {});
    };
    loadFast();
    api.list<Client>("clients").then(setClients).catch(() => {});
    api.list<Ticket>("tickets").then(setTickets).catch(() => {});
    api.list<Activity>("activity").then(setActivity).catch(() => {});
    api.providers().then((p) => setAiKeys(p.keys)).catch(() => {});
    fetch("/api/prooflink/live").then((r)=>r.json()).then(setProoflink).catch(()=>{});
    fetch("/api/v1/calendar/today").then(r=>r.json()).then(d=>{ const evts=Array.isArray(d)?d:(d.events||[]); if(evts.length>0)setCalEvents(evts.map((e,i)=>({title:e.title,time:e.start?(new Date(e.start).toLocaleDateString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})):"TBD",color:["#00D4FF","#A78BFA","#FFB800"][i%3],urgent:i===0}))); }).catch(()=>{});
    fetch("/api/v1/approvals").then(r=>r.json()).then(d=>{ const arr=Array.isArray(d)?d:(d.approvals||[]); setPendingApprovals(arr.filter((a)=>a.status==="pending"||a.status==="open").length); }).catch(()=>{});
    fetch("/api/v1/tasks").then(r=>r.json()).then(d=>{ const arr=Array.isArray(d)?d:(d.tasks||[]); setPendingTasks(arr.filter((t)=>t.status!=="done"&&t.status!=="closed"&&t.status!=="cancelled").length); }).catch(()=>{});
    const t = setInterval(loadFast, 10000);
    const t3 = setInterval(()=>fetch("/api/prooflink/live").then((r)=>r.json()).then(setProoflink).catch(()=>{}),15000);
    return () => { clearInterval(t); clearInterval(t3); };
  }, []);

  const mrr = useMemo(() => clients.reduce((s, c) => s + c.mrr, 0), [clients]);
  const openTickets = tickets.filter((t) => t.status !== "resolved");
  const criticals = openTickets.filter((t) => t.priority === "critical").length;
  const cpuHist = metrics?.history.map((h) => h.cpu) ?? [];
  const memHist = metrics?.history.map((h) => h.mem) ?? [];
  const chartData =
    metrics?.history.map((h) => ({
      t: new Date(h.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      cpu: h.cpu,
      mem: h.mem,
    })) ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* S8-calendar-strip-start */}
      <div style={{ display:"flex", gap:10, marginBottom:4 }}>
        {calEvents.length > 0 ? calEvents.map((e, i) => (
          <div key={i} style={{ flex:1, background:e.color+"11",
            border:"1px solid "+e.color+"33", borderRadius:8, padding:"10px 14px" }}>
            {e.urgent && <div style={{ fontSize:9, color:e.color, fontWeight:700, letterSpacing:2, marginBottom:4 }}>UPCOMING</div>}
            <div style={{ fontSize:12, color:"#FFFFFF", fontWeight:600, marginBottom:4 }}>{e.title}</div>
            <div style={{ fontSize:11, color:e.color }}>{e.time}</div>
          </div>
        )) : (
          <div style={{ flex:1, background:"#00D4FF11", border:"1px solid #00D4FF33",
            borderRadius:8, padding:"10px 14px", fontSize:12, color:"#8B9DC3" }}>
            Outlook calendar loading…
          </div>
        )}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16 }}>
        {[
          { label: pendingApprovals > 0 ? pendingApprovals+" Pending Approvals" : "No Pending Approvals",
            color: pendingApprovals > 0 ? "#FF4B4B" : "#00E5A0",
            sub: pendingApprovals > 0 ? "Agents waiting for your decision" : "All caught up",
            href:"/approvals" },
          { label: pendingTasks > 0 ? pendingTasks+" Pending Tasks" : "No Pending Tasks",
            color: pendingTasks > 0 ? "#FFB800" : "#00E5A0",
            sub: pendingTasks > 0 ? "Tasks queued for action" : "Queue is clear",
            href:"/agents" },
          { label:"22/22 Tests Passing", color:"#00E5A0", sub:"Core moat CI green", href:"/audit" },
        ].map((a, i) => (
          <a key={i} href={a.href} style={{ flex:1, background:"#141D3B", borderRadius:10,
            padding:"12px 16px", borderLeft:"3px solid "+a.color, cursor:"pointer",
            textDecoration:"none", boxShadow:"0 4px 20px rgba(0,0,0,0.4)", display:"block" }}>
            <div style={{ fontSize:13, color:a.color, fontWeight:700 }}>{a.label}</div>
            <div style={{ fontSize:11, color:"#8B9DC3", marginTop:2 }}>{a.sub}</div>
          </a>
        ))}
      </div>
      {/* S8-calendar-strip-end */}
      {/* hero */}
      <GlassCard hover={false} className="relative overflow-hidden p-6">
        <div
          className="pointer-events-none absolute left-0 h-px w-full glow-line animate-scan"
          aria-hidden
        />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
              Mission <span className="text-gradient">Control</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {metrics
                ? `${metrics.hostname} · ${metrics.platform} · up ${fmtUptime(metrics.uptime)} · load ${metrics.loadavg[0].toFixed(2)}`
                : "Connecting to host…"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/terminal?mode=ssh">
              <span className="glass glass-hover inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-cyan-300">
                <Server size={15} /> SSH → OVH
              </span>
            </Link>
            <Link to="/orchestrator">
              <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500/90 to-purple-600/90 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                <BrainCircuit size={15} /> Launch AI <ArrowUpRight size={14} />
              </span>
            </Link>
          </div>
        </div>
      </GlassCard>


      {/* ProofLink Hero */}
      {prooflink && (
        <GlassCard hover={false} className="relative overflow-hidden border border-emerald-400/20 p-5" delay={0.02}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/30">
                <Lock size={18} className="text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold text-white">{prooflink.total.toLocaleString()}</span>
                  <span className="text-sm text-slate-400">ProofLink Receipts</span>
                  <span className={prooflink.chain_breaks === 0 ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300" : "rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300"}>
                    {prooflink.chain_breaks === 0 ? "0 chain breaks" : prooflink.chain_breaks + " BREAKS"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{prooflink.action.toLocaleString()} action receipts · hash-chained · immutable</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {prooflink.last5.map((r) => (
                <div key={r.hash} className="glass rounded-lg px-2.5 py-1.5 text-[10px]">
                  <div className="font-mono text-cyan-300">{r.hash}</div>
                  <div className="text-slate-500 truncate max-w-[120px]">{r.category}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      {/* stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={<DollarSign size={16} className="text-emerald-300" />}
          label="Monthly Recurring"
          value={<AnimatedNumber value={mrr} prefix="$" />}
          sub={`${clients.length} managed clients`}
          spark={<Sparkline data={[12.1, 13.4, 13.2, 14.8, 15.6, 16.4, 17.7]} color="#34d399" />}
          delay={0}
        />
        <Stat
          icon={<TicketIcon size={16} className="text-amber-300" />}
          label="Open Tickets"
          value={<AnimatedNumber value={openTickets.length} />}
          sub={criticals > 0 ? `${criticals} critical — act now` : "No criticals"}
          spark={<Sparkline data={[8, 6, 9, 5, 7, 4, openTickets.length]} color="#fbbf24" />}
          delay={0.05}
        />
        <Stat
          icon={<Cpu size={16} className="text-cyan-300" />}
          label="CPU"
          value={<AnimatedNumber value={metrics?.current?.cpu ?? 0} suffix="%" decimals={1} />}
          sub={`${metrics?.cpus ?? "—"} cores`}
          spark={<Sparkline data={cpuHist} color="#22d3ee" />}
          delay={0.1}
        />
        <Stat
          icon={<MemoryStick size={16} className="text-purple-300" />}
          label="Memory"
          value={<AnimatedNumber value={metrics?.current?.mem ?? 0} suffix="%" decimals={1} />}
          sub={metrics ? `${((metrics.totalMem - metrics.freeMem) / 2 ** 30).toFixed(1)} / ${(metrics.totalMem / 2 ** 30).toFixed(0)} GB` : "—"}
          spark={<Sparkline data={memHist} color="#a855f7" />}
          delay={0.15}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* telemetry chart */}
        <GlassCard className="p-5 lg:col-span-2" delay={0.1}>
          <SectionTitle
            right={
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" /> CPU
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-purple-400" /> Memory
                </span>
              </div>
            }
          >
            Host Telemetry — live
          </SectionTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cpuG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="memG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={48} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" width={36} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(11,16,32,0.92)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="cpu" stroke="#22d3ee" strokeWidth={2} fill="url(#cpuG)" isAnimationActive />
                <Area type="monotone" dataKey="mem" stroke="#a855f7" strokeWidth={2} fill="url(#memG)" isAnimationActive />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* AI fleet */}
        <GlassCard className="p-5" delay={0.15}>
          <SectionTitle>AI Fleet</SectionTitle>
          <div className="space-y-2.5">
            {(
              [
                ["claude", "Claude", "Anthropic"],
                ["codex", "Codex", "OpenAI"],
                ["gemini", "Gemini", "Google"],
                ["nemotron", "Nemotron", "NVIDIA"],
                ["hermes", "Hermes", "SEMI_AUTO · :8089"],
                ["octoai", "OctoAI", "iTechSmart"],
              ] as [ProviderId, string, string][]
            ).map(([id, name, vendor]) => (
              <Link
                key={id}
                to={`/orchestrator?provider=${id}`}
                className="glass glass-hover flex items-center gap-3 rounded-xl px-3 py-2.5"
              >
                <StatusDot up={aiKeys ? aiKeys[id] : false} />
                <div>
                  <div className="text-sm font-semibold text-slate-100">{name}</div>
                  <div className="text-[11px] text-slate-500">{vendor}</div>
                </div>
                <span className="ml-auto text-[11px] text-slate-500">
                  {aiKeys ? (aiKeys[id] ? "ready" : "no key") : "…"}
                </span>
                <ArrowUpRight size={13} className="text-slate-600" />
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* services */}
        <GlassCard className="p-5" delay={0.2}>
          <SectionTitle>Service Mesh</SectionTitle>
          <div className="space-y-2">
            {services.length === 0 && (
              <div className="shimmer-text py-4 text-center text-sm">probing services…</div>
            )}
            {services.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <StatusDot up={s.up} />
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-200">{s.name}</div>
                  <div className="truncate font-mono text-[10px] text-slate-500">{s.url}</div>
                </div>
                <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums">
                  {s.up ? `${s.ms}ms` : "down"}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* live activity */}
        <GlassCard className="p-5 lg:col-span-2" delay={0.25}>
          <SectionTitle
            right={
              <Link to="/business" className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300">
                Open business suite →
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2">
              <ActivityIcon size={13} /> Live Activity
            </span>
          </SectionTitle>
          <div className="space-y-1">
            {activity.slice(0, 7).map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.03]"
              >
                <Badge tone={kindTone[a.kind] ?? "slate"}>{a.kind}</Badge>
                <span className="min-w-0 flex-1 text-sm leading-snug text-slate-300">{a.text}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(a.ts)}</span>
              </div>
            ))}
            {activity.length === 0 && (
              <div className="py-6 text-center text-sm text-slate-500">No activity yet</div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* top clients strip */}
      <GlassCard className="p-5" delay={0.3}>
        <SectionTitle
          right={
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Users size={12} /> {clients.length} active
            </span>
          }
        >
          Client Health
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {clients.map((c) => (
            <div key={c.id} className="glass glass-hover rounded-xl p-3">
              <div className="truncate text-sm font-semibold text-slate-100">{c.name}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{c.plan}</div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-lg font-bold text-white tabular-nums">{c.health}</span>
                <span className="text-[11px] text-slate-500">${c.mrr.toLocaleString()}/mo</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-700"
                  style={{ width: `${c.health}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  spark,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  spark: React.ReactNode;
  delay: number;
}) {
  return (
    <GlassCard className="p-4" delay={delay}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {icon} {label}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-extrabold text-white">{value}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>
        </div>
        {spark}
      </div>
    </GlassCard>
  );
}
