import { useEffect, useState } from "react";
import { AlertCircle, Mail, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { GlassCard, NeonButton, SectionTitle } from "../components/ui";

interface Campaign { id: string; name: string; status: string; contacts: number; replies: number; opens: number; reply_rate: number; }
interface PipelineData { campaigns: Campaign[]; total: number; unavailable?: boolean; reason?: string; error?: string; }

function replyColor(rate: number) {
  if (rate >= 5) return "text-emerald-300 bg-emerald-500/20";
  if (rate >= 2) return "text-amber-300 bg-amber-500/20";
  return "text-rose-300 bg-rose-500/20";
}

export default function Pipeline() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/pipeline").then((r) => r.json()).then(setData).catch(() => setData({ error: "fetch failed" } as PipelineData)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <GlassCard hover={false} className="p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-400">Apollo.io</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Sales <span className="text-gradient">Pipeline</span></h1>
            {data && !data.unavailable && !data.error && (
              <p className="mt-1 text-sm text-slate-400">{data.total} active sequences</p>
            )}
          </div>
          <NeonButton variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={clsx(loading && "animate-spin")} /> Refresh
          </NeonButton>
        </div>
      </GlassCard>

      {loading && <div className="py-12 text-center text-sm shimmer-text">Fetching Apollo sequences…</div>}

      {!loading && (data?.unavailable || data?.error) && (
        <GlassCard className="p-8 text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-amber-400" />
          <p className="text-slate-300">{data.reason || data.error}</p>
        </GlassCard>
      )}

      {!loading && data && !data.unavailable && !data.error && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <GlassCard className="p-4" delay={0}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Contacts</div>
              <div className="text-2xl font-extrabold text-white">{data.campaigns.reduce((s, c) => s + c.contacts, 0).toLocaleString()}</div>
            </GlassCard>
            <GlassCard className="p-4" delay={0.05}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Replies</div>
              <div className="text-2xl font-extrabold text-white">{data.campaigns.reduce((s, c) => s + c.replies, 0).toLocaleString()}</div>
            </GlassCard>
            <GlassCard className="p-4" delay={0.1}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Avg Reply Rate</div>
              <div className="text-2xl font-extrabold text-white">
                {data.campaigns.length > 0
                  ? (data.campaigns.reduce((s, c) => s + c.reply_rate, 0) / data.campaigns.length).toFixed(1)
                  : "0.0"}%
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-5" delay={0.15}>
            <SectionTitle>Sequences</SectionTitle>
            {data.campaigns.length === 0 && <div className="py-6 text-center text-sm text-slate-500">No sequences found</div>}
            <div className="space-y-3">
              {data.campaigns.map((c, i) => (
                <div key={c.id} className="glass rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-purple-300 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{c.status} · {c.contacts.toLocaleString()} contacts · {c.opens.toLocaleString()} opens</div>
                      </div>
                    </div>
                    <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", replyColor(c.reply_rate))}>
                      {c.reply_rate}% reply
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className={clsx("h-full rounded-full transition-all duration-700",
                      c.reply_rate >= 5 ? "bg-emerald-400" : c.reply_rate >= 2 ? "bg-amber-400" : "bg-rose-400"
                    )} style={{ width: `${Math.min(c.reply_rate * 5, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
