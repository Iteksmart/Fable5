import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download, FileText, Shield } from "lucide-react";
import clsx from "clsx";
import { GlassCard, SectionTitle } from "../components/ui";

interface CompData {
  nist: { score: number; max: number; label: string; status: string };
  hipaa: { score: number; max: number; label: string; status: string };
  soc2: { score: number; max: number; status: string; controls_total?: number; fully_evidenced?: number; partial?: number; gaps?: number; breakdown?: { id: string; category: string; state: string; gap: string }[] };
  cmmc: { level: number; deadline: string; days_remaining: number; controls_met: number; controls_total: number; status: string };
  receipts: number;
  evidence_packs: { name: string; filename: string }[];
  error?: string;
}

function ScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[11px] text-slate-400"><span>{score}/{max}</span><span>{pct}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Compliance() {
  const [data, setData] = useState<CompData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/compliance").then((r) => r.json()).then(setData).catch(() => setData({ error: "fetch failed" } as CompData)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center shimmer-text">Loading compliance posture…</div>;
  if (!data || data.error) return <div className="py-12 text-center text-rose-300">{data?.error || "Error"}</div>;

  const cmmcDays = data.cmmc.days_remaining;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <GlassCard hover={false} className="p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Compliance Posture</div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Security & <span className="text-gradient">Compliance</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">{data.receipts.toLocaleString()} immutable audit receipts in chain</p>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: data.nist.label, score: data.nist.score, max: data.nist.max, status: data.nist.status, color: "#22d3ee" },
          { label: data.hipaa.label, score: data.hipaa.score, max: data.hipaa.max, status: data.hipaa.status, color: "#34d399" },
          { label: "SOC 2 Type II", score: data.soc2.score, max: data.soc2.max, status: data.soc2.status, color: "#a855f7" },
          { label: `CMMC L${data.cmmc.level}`, score: data.cmmc.controls_met, max: data.cmmc.controls_total, status: data.cmmc.status, color: "#f59e0b" },
        ].map((f, i) => (
          <GlassCard key={f.label} className="p-4" delay={i * 0.05}>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-100">{f.label}</span>
            </div>
            <div className="text-2xl font-extrabold text-white mb-3">{f.score}<span className="text-sm text-slate-500">/{f.max}</span></div>
            <ScoreBar score={f.score} max={f.max} color={f.color} />
            <div className="mt-2 text-[10px] text-slate-500">{f.status.replace(/_/g, " ")}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* CMMC countdown */}
        <GlassCard className="p-5" delay={0.2}>
          <SectionTitle>CMMC Level 2 Roadmap</SectionTitle>
          <div className="mt-3 flex items-center gap-4">
            <div className={clsx("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ring-2",
              cmmcDays < 60 ? "bg-rose-500/20 ring-rose-400/40 text-rose-300" :
              cmmcDays < 120 ? "bg-amber-500/20 ring-amber-400/40 text-amber-300" :
              "bg-cyan-500/20 ring-cyan-400/40 text-cyan-300")}>
              <Clock size={24} />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-white">{cmmcDays} days</div>
              <div className="text-sm text-slate-400">until {data.cmmc.deadline}</div>
              <div className="mt-1 text-[11px] text-slate-500">{data.cmmc.controls_met}/{data.cmmc.controls_total} controls met</div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-700"
              style={{ width: `${Math.round((data.cmmc.controls_met / data.cmmc.controls_total) * 100)}%` }} />
          </div>
          <div className="mt-2 text-[11px] text-slate-500">{Math.round((data.cmmc.controls_met / data.cmmc.controls_total) * 100)}% controls satisfied</div>
        </GlassCard>

        {/* Evidence packs */}
        <GlassCard className="p-5" delay={0.25}>
          <SectionTitle>Evidence Packs</SectionTitle>
          <div className="mt-2 space-y-2">
            {data.evidence_packs.map((ep) => (
              <button key={ep.name} className="glass glass-hover flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left"
                onClick={() => alert("Evidence pack generation requires a scheduled audit run — contact compliance@itechsmart.dev")}>
                <FileText size={15} className="text-cyan-300 shrink-0" />
                <span className="text-sm text-slate-200">{ep.name}</span>
                <Download size={13} className="ml-auto text-slate-500" />
              </button>
            ))}
          </div>
        </GlassCard>
      </div>

      {data.soc2.breakdown && data.soc2.breakdown.length > 0 && (
        <GlassCard className="p-5" delay={0.3}>
          <SectionTitle right={<span className="text-[11px] text-slate-400">{data.soc2.fully_evidenced ?? 0} evidenced · {data.soc2.partial ?? 0} partial · {data.soc2.gaps ?? 0} gaps</span>}>
            SOC 2 Control Breakdown
          </SectionTitle>
          <div className="mt-2 space-y-1.5">
            {data.soc2.breakdown.slice(0, 12).map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.03]">
                {c.state === "full" ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" /> :
                 c.state === "partial" ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" /> :
                 <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-400" />}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-300">{c.id}</span>
                    <span className="text-[11px] text-slate-500">{c.category}</span>
                  </div>
                  {c.gap && <div className="mt-0.5 text-[11px] text-slate-500 truncate">{c.gap}</div>}
                </div>
                <span className={clsx("ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  c.state === "full" ? "bg-emerald-500/20 text-emerald-300" :
                  c.state === "partial" ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300")}>
                  {c.state}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
