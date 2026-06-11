import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Cloud,
  Cpu,
  Globe,
  HardDrive,
  Network,
  Radar,
  RefreshCw,
  Server,
  Shield,
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
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    sweep();
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
