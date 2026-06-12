import { useEffect, useState, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronRight, Shield, TrendingUp, Cpu, ReceiptText } from "lucide-react";
import { AnimatedNumber, GlassCard, SectionTitle } from "../components/ui";

interface FundData {
  mrr: number; arr: number; sub_count: number;
  containers: number; receipts: number; chain_breaks: number;
  nist_score: number; hipaa_score: number;
  use_of_funds: { label: string; pct: number; color: string }[];
  quotes: { text: string; author: string }[];
  error?: string;
}

export default function Fundraise() {
  const [data, setData] = useState<FundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    fetch("/api/fundraise").then((r) => r.json()).then(setData).catch(() => setData({ error: "fetch failed" } as FundData)).finally(() => setLoading(false));
    const t = setInterval(() => setQuoteIdx((i) => (i + 1) % 3), 6000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="py-12 text-center shimmer-text">Loading investor snapshot…</div>;
  if (!data || data.error) return <div className="py-12 text-center text-rose-300">{data?.error || "Error"}</div>;

  const quotes = data.quotes;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <GlassCard hover={false} className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute left-0 h-px w-full glow-line animate-scan" aria-hidden />
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-400">Investor Room</div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
          Fundraise <span className="text-gradient">Dashboard</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">Live platform snapshot · Confidential · CF Access protected</p>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-4" delay={0}>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><TrendingUp size={14} className="text-emerald-300" /> ARR</div>
          <div className="mt-2 text-2xl font-extrabold text-white"><AnimatedNumber value={data.arr} prefix="$" /></div>
          <div className="mt-0.5 text-[11px] text-slate-500">{data.sub_count} subscribers</div>
        </GlassCard>
        <GlassCard className="p-4" delay={0.05}>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Cpu size={14} className="text-cyan-300" /> Containers</div>
          <div className="mt-2 text-2xl font-extrabold text-white"><AnimatedNumber value={data.containers} /></div>
          <div className="mt-0.5 text-[11px] text-slate-500">production workloads</div>
        </GlassCard>
        <GlassCard className="p-4" delay={0.1}>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><ReceiptText size={14} className="text-purple-300" /> Receipts</div>
          <div className="mt-2 text-2xl font-extrabold text-white"><AnimatedNumber value={data.receipts} /></div>
          <div className="mt-0.5 text-[11px] text-slate-500">{data.chain_breaks} chain breaks</div>
        </GlassCard>
        <GlassCard className="p-4" delay={0.15}>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Shield size={14} className="text-emerald-300" /> Compliance</div>
          <div className="mt-2 text-2xl font-extrabold text-white">NIST {data.nist_score}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">HIPAA {data.hipaa_score}/100</div>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5" delay={0.2}>
          <SectionTitle>Use of Funds</SectionTitle>
          <div className="flex items-center gap-6">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.use_of_funds} dataKey="pct" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                    {data.use_of_funds.map((e) => <Cell key={e.label} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "rgba(11,16,32,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              {data.use_of_funds.map((e) => (
                <div key={e.label} className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ background: e.color }} />
                  <div>
                    <div className="text-sm font-medium text-slate-200">{e.label}</div>
                    <div className="text-[11px] text-slate-500">{e.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5" delay={0.25}>
          <SectionTitle>Analyst Notes</SectionTitle>
          {quotes.length > 0 && (
            <div className="relative mt-2">
              <div className="min-h-[100px] rounded-xl bg-white/[0.03] p-5">
                <p className="text-sm leading-relaxed text-slate-200 italic">"{quotes[quoteIdx % quotes.length].text}"</p>
                <p className="mt-3 text-[11px] font-semibold text-cyan-400">— {quotes[quoteIdx % quotes.length].author}</p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => setQuoteIdx((i) => (i - 1 + quotes.length) % quotes.length)} className="glass rounded-lg p-1.5 text-slate-400 hover:text-white"><ChevronLeft size={14} /></button>
                <div className="flex flex-1 justify-center gap-1.5">
                  {quotes.map((_, i) => <div key={i} className={`h-1.5 w-1.5 rounded-full transition-colors ${i === quoteIdx % quotes.length ? "bg-cyan-400" : "bg-white/20"}`} />)}
                </div>
                <button onClick={() => setQuoteIdx((i) => (i + 1) % quotes.length)} className="glass rounded-lg p-1.5 text-slate-400 hover:text-white"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
