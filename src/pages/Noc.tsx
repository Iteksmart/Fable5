import React, { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  Cloud,
  Cpu,
  Globe,
  HardDrive,
  Lock,
  Network,
  Radar,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
} from "lucide-react";
import clsx from "clsx";
import {
  AnimatedNumber,
  Badge,
  GlassCard,
  NeonButton,
  SectionTitle,
  StatusDot,
} from "../components/ui";
import {
  api,
  fmtUptime,
  type Metrics,
  type ServiceProbe,
  type TunnelInfo,
} from "../lib/api";

export default function Noc() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [services, setServices] = useState<ServiceProbe[]>([]);
  const [tunnel, setTunnel] = useState<TunnelInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSweep, setLastSweep] = useState<Date | null>(null);
  const [alerts, setAlerts] = useState<{wazuh:any[];itsm:any[];total:number;kill_switch:any}|null>(null);
  const [backup, setBackup] = useState<any>(null);
  const [certs, setCerts] = useState<{certs:any[];cached_at:string}|null>(null);
  const [shuffleData, setShuffleData] = useState<any>(null);
  const [nocAlertchain, setNocAlertchain] = useState<any>(null);

  const sweep = async () => {
    setRefreshing(true);
    try {
      const [m, s, t] = await Promise.all([
        api.metrics().catch(() => null),
        api.services().catch(() => []),
        api.tunnel().catch(() => null),
      ]);
      if (m) setMetrics(m);
      setServices(s);
      if (t) setTunnel(t);
      setLastSweep(new Date());
      fetch("/api/alerts").then((r)=>r.json()).then(setAlerts).catch(()=>{});
      fetch("/api/backup").then((r)=>r.json()).then(setBackup).catch(()=>{});
      fetch("/api/integrations/shuffle/workflows").then((r)=>r.json()).then(setShuffleData).catch(()=>{});
      fetch("/api/integrations/alertchain/decisions").then((r)=>r.json()).then(setNocAlertchain).catch(()=>{});
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    sweep();
    fetch("/api/certs").then((r)=>r.json()).then(setCerts).catch(()=>{});
    fetch("/api/v1/integrations/shuffle").then((r)=>r.json()).then(setShuffleData).catch(()=>{});
    fetch("/api/v1/integrations/alertchain").then((r)=>r.json()).then(setNocAlertchain).catch(()=>{});
    const t = setInterval(sweep, 15000);
    return () => clearInterval(t);
  }, []);

  const upCount = services.filter((s) => s.up).length;
  const memPct = metrics ? ((metrics.totalMem - metrics.freeMem) / metrics.totalMem) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <GlassCard hover={false} className="relative overflow-hidden p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 ring-1 ring-emerald-400/30">
              <Radar size={22} className="text-emerald-300" />
              <motion.span
                className="absolute inset-0 rounded-2xl ring-2 ring-emerald-400/40"
                animate={{ scale: [1, 1.25], opacity: [0.6, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Network Operations Center
              </h1>
              <p className="text-sm text-slate-400">
                {upCount}/{services.length} services healthy ·{" "}
                {lastSweep ? `last sweep ${lastSweep.toLocaleTimeString([], { hour12: false })}` : "sweeping…"}
              </p>
            </div>
          </div>
          <NeonButton variant="ghost" onClick={sweep} disabled={refreshing}>
            <RefreshCw size={14} className={clsx(refreshing && "animate-spin")} /> Sweep now
          </NeonButton>
        </div>
      </GlassCard>

      {/* gauges */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Gauge
          label="CPU"
          icon={<Cpu size={15} className="text-cyan-300" />}
          pct={metrics?.current?.cpu ?? 0}
          detail={`${metrics?.cpus ?? "—"} × ${metrics?.cpuModel?.split("@")[0]?.trim() ?? ""}`}
          color="#22d3ee"
          delay={0}
        />
        <Gauge
          label="Memory"
          icon={<HardDrive size={15} className="text-purple-300" />}
          pct={memPct}
          detail={
            metrics
              ? `${((metrics.totalMem - metrics.freeMem) / 2 ** 30).toFixed(1)} GB of ${(metrics.totalMem / 2 ** 30).toFixed(0)} GB`
              : "—"
          }
          color="#a855f7"
          delay={0.05}
        />
        <Gauge
          label="Load (1m)"
          icon={<Activity size={15} className="text-emerald-300" />}
          pct={metrics ? Math.min((metrics.loadavg[0] / metrics.cpus) * 100, 100) : 0}
          detail={metrics ? metrics.loadavg.map((l) => l.toFixed(2)).join(" · ") : "—"}
          color="#34d399"
          delay={0.1}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* edge / tunnel */}
        <GlassCard className="p-5" delay={0.1}>
          <SectionTitle>Edge & Access</SectionTitle>
          <div className="space-y-3">
            <EdgeRow
              icon={<Cloud size={15} className="text-cyan-300" />}
              name="Cloudflare Zero Trust tunnel"
              detail={`id ${tunnel?.id ?? "3525b90f"} · systemd ${tunnel?.state ?? "?"}`}
              up={tunnel?.active ?? false}
            />
            <EdgeRow
              icon={<Shield size={15} className="text-emerald-300" />}
              name="Direct port 22"
              detail="closed by policy — SSH only via tunnel"
              up
              tone="locked"
            />
            <EdgeRow
              icon={<Globe size={15} className="text-purple-300" />}
              name="ssh.itechsmart.dev"
              detail="public hostname → tunnel ingress"
              up={tunnel?.active ?? false}
            />
            <EdgeRow
              icon={<Server size={15} className="text-amber-300" />}
              name="OVH host"
              detail={metrics ? `${metrics.hostname} · up ${fmtUptime(metrics.uptime)}` : "—"}
              up={!!metrics}
            />
          </div>
        </GlassCard>

        {/* services board */}
        <GlassCard className="p-5 lg:col-span-2" delay={0.15}>
          <SectionTitle
            right={
              <Badge tone={upCount === services.length ? "emerald" : "rose"}>
                {upCount}/{services.length} up
              </Badge>
            }
          >
            <span className="inline-flex items-center gap-2">
              <Network size={13} /> Service Probes
            </span>
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={clsx(
                  "glass glass-hover rounded-xl p-4",
                  !s.up && "border-rose-400/30"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <StatusDot up={s.up} />
                  <span className="text-sm font-semibold text-slate-100">{s.name}</span>
                  {s.internal && <Badge tone="slate">internal</Badge>}
                  <span className="ml-auto font-mono text-xs text-slate-400 tabular-nums">
                    {s.up ? `${s.ms}ms` : `—`}
                  </span>
                </div>
                <div className="mt-2 truncate font-mono text-[11px] text-slate-500">{s.url}</div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge tone={s.up ? "emerald" : "rose"}>
                    {s.up ? `HTTP ${s.status}` : s.error?.slice(0, 32) || "unreachable"}
                  </Badge>
                </div>
              </motion.div>
            ))}
            {services.length === 0 && (
              <div className="col-span-2 py-8 text-center text-sm shimmer-text">
                sweeping service mesh…
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* M05 Alerts panel */}
      {alerts && (
        <GlassCard className="p-5" delay={0.3}>
          <SectionTitle right={<span className="text-[11px] text-slate-400">{alerts.total} active</span>}>
            <span className="inline-flex items-center gap-2"><Bell size={13} /> Active Alerts</span>
          </SectionTitle>
          {alerts.kill_switch && (
            <div className={alerts.kill_switch.engaged ? "mb-3 flex items-center gap-2 rounded-xl bg-rose-500/20 px-3 py-2 text-sm text-rose-300" : "mb-3 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300"}>
              <Lock size={14} />
              <span>Kill switch: {alerts.kill_switch.engaged ? "ENGAGED" : "disengaged"}</span>
            </div>
          )}
          {alerts.total === 0 && <div className="py-4 text-center text-sm text-slate-500">No active alerts</div>}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {[...alerts.wazuh, ...alerts.itsm].slice(0, 15).map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.03]">
                <AlertTriangle size={13} className={a.level === "critical" || a.level >= 12 ? "mt-0.5 shrink-0 text-rose-400" : "mt-0.5 shrink-0 text-amber-400"} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm leading-snug text-slate-200 truncate">{a.description}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{a.source} · {a.ref || a.agent || ""} · {new Date(a.ts).toLocaleString()}</div>
                </div>
                {a.sla === "breached" && <span className="shrink-0 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] text-rose-300">SLA BREACHED</span>}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* M07 Backup + M08 Certs */}
      <div className="grid gap-6 lg:grid-cols-2">
        {backup && (
          <GlassCard className="p-5" delay={0.35}>
            <SectionTitle right={backup.missing ? <span className="text-[11px] text-amber-400">no dir</span> : <span className={backup.healthy ? "text-[11px] text-emerald-400" : "text-[11px] text-rose-400"}>{backup.healthy ? "healthy" : "stale"}</span>}>
              <span className="inline-flex items-center gap-2"><Archive size={13} /> Backup / DR</span>
            </SectionTitle>
            {backup.missing
              ? <div className="mt-2 rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-300">{backup.message}</div>
              : (
                <div className="mt-2 space-y-1.5">
                  {(backup.files || []).slice(0, 8).map((f: any) => (
                    <div key={f.name} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.02]">
                      <span className={f.healthy ? "h-2 w-2 rounded-full bg-emerald-400 shrink-0" : "h-2 w-2 rounded-full bg-rose-400 shrink-0"} />
                      <span className="flex-1 truncate font-mono text-[11px] text-slate-200">{f.name}</span>
                      <span className="text-[11px] text-slate-400">{f.age_hours < 1 ? "<1h ago" : f.age_hours < 24 ? f.age_hours.toFixed(0) + "h ago" : (f.age_hours/24).toFixed(0) + "d ago"}</span>
                    </div>
                  ))}
                </div>
              )
            }
          </GlassCard>
        )}

        {certs && (
          <GlassCard className="p-5" delay={0.4}>
            <SectionTitle right={<span className="text-[10px] text-slate-500">cached {new Date(certs.cached_at).toLocaleTimeString()}</span>}>
              <span className="inline-flex items-center gap-2"><ShieldAlert size={13} /> TLS Cert Expiry</span>
            </SectionTitle>
            <div className="mt-2 space-y-1.5">
              {certs.certs.map((c: any) => (
                <div key={c.domain} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.02]">
                  <span className={c.status === "ok" ? "h-2 w-2 rounded-full bg-emerald-400 shrink-0" : c.status === "warning" ? "h-2 w-2 rounded-full bg-amber-400 shrink-0" : "h-2 w-2 rounded-full bg-rose-400 shrink-0"} />
                  <span className="flex-1 truncate text-sm text-slate-200">{c.domain}</span>
                  {c.daysLeft !== null
                    ? <span className={c.daysLeft < 14 ? "text-[11px] font-bold text-rose-300" : c.daysLeft < 30 ? "text-[11px] text-amber-300" : "text-[11px] text-emerald-300"}>{c.daysLeft}d</span>
                    : <span className="text-[11px] text-slate-500">?</span>
                  }
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>

      {/* Shuffle SOAR + AlertChain */}
      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-sm">Shuffle SOAR</span>
            <a href="http://localhost:5001" target="_blank" rel="noopener"
               className="text-xs text-cyan-400">Open</a>
          </div>
          <div className="flex gap-4 mb-3 text-sm">
            <span><b className="text-white">{shuffleData?.total ?? 0}</b> <span className="text-white/40">workflows</span></span>
            <span><b className="text-cyan-400">{shuffleData?.active ?? 0}</b> <span className="text-white/40">active</span></span>
          </div>
          <div className="space-y-1">
            {(shuffleData?.workflows ?? []).slice(0, 5).map((w: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-white/5">
                <span className={w.status === "running" ? "text-emerald-400" : "text-white/30"}>●</span>
                <span className="flex-1 truncate">{w.name}</span>
                <span className="text-white/30">{w.executions} runs</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-sm">Policy Gate (AlertChain)</span>
            <a href="https://alertchain.itechsmart.dev" target="_blank" rel="noopener"
               className="text-xs text-cyan-400">Open</a>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">{nocAlertchain?.allowed ?? 0}</div>
              <div className="text-xs text-white/40">Allowed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-red-400">{nocAlertchain?.denied ?? 0}</div>
              <div className="text-xs text-white/40">Blocked</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function Gauge({
  label,
  icon,
  pct,
  detail,
  color,
  delay,
}: {
  label: string;
  icon: React.ReactNode;
  pct: number;
  detail: string;
  color: string;
  delay: number;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(pct, 100));
  return (
    <GlassCard className="flex items-center gap-5 p-5" delay={delay}>
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <motion.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            animate={{ strokeDashoffset: c - (clamped / 100) * c }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white">
          <AnimatedNumber value={clamped} suffix="%" decimals={0} />
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {icon} {label}
        </div>
        <div className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</div>
      </div>
    </GlassCard>
  );
}

function EdgeRow({
  icon,
  name,
  detail,
  up,
  tone,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  up: boolean;
  tone?: "locked";
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-xl px-3 py-3">
      {icon}
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-100">{name}</div>
        <div className="truncate font-mono text-[10px] text-slate-500">{detail}</div>
      </div>
      <span className="ml-auto">
        {tone === "locked" ? <Badge tone="emerald">locked</Badge> : <StatusDot up={up} />}
      </span>
    </div>
  );
}
