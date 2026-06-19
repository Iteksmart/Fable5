import React, { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, AlertCircle, Download } from "lucide-react";
import clsx from "clsx";
import { AnimatedNumber, GlassCard, NeonButton, SectionTitle } from "../components/ui";

interface RevData {
  mrr: number; arr: number; ar_total: number; sub_count: number;
  ar: { id: string; customer: string; amount: number; due: string | null; days_overdue: number }[];
  unavailable?: boolean; reason?: string; error?: string;
}

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

export default function Revenue() {
  const [data, setData] = useState<RevData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/revenue").then((r) => r.json()).then(setData).catch(() => setData({ error: "fetch failed" } as RevData)).finally(() => setLoading(false));
  }, []);

  const overdue = data?.ar?.filter((r) => r.days_overdue > 0) ?? [];
  const current = data?.ar?.filter((r) => r.days_overdue === 0) ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <GlassCard hover={false} className="relative overflow-hidden p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Revenue Command</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
              Stripe <span className="text-gradient">Revenue</span>
            </h1>
          </div>
          {data && !data.unavailable && (
            <a href="/api/audit/csv" className="glass glass-hover inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-cyan-300">
              <Download size={14} /> Export
            </a>
          )}
        </div>
      </GlassCard>

      {loading && <div className="py-12 text-center text-sm shimmer-text">Fetching Stripe data…</div>}

      {!loading && data?.unavailable && (
        <GlassCard className="p-8 text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-amber-400" />
          <p className="text-slate-300">{data.reason}</p>
        </GlassCard>
      )}

      {!loading && data?.error && (
        <GlassCard className="p-8 text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-rose-400" />
          <p className="font-mono text-sm text-rose-300">{data.error}</p>
        </GlassCard>
      )}

      {!loading && data && !data.unavailable && !data.error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={<DollarSign size={16} className="text-emerald-300" />} label="MRR" value={<AnimatedNumber value={data.mrr} prefix="$" />} sub="Monthly recurring" delay={0} />
            <KpiCard icon={<TrendingUp size={16} className="text-cyan-300" />} label="ARR" value={<AnimatedNumber value={data.arr} prefix="$" />} sub="Annual recurring" delay={0.05} />
            <KpiCard icon={<AlertCircle size={16} className="text-amber-300" />} label="AR Outstanding" value={<AnimatedNumber value={data.ar_total} prefix="$" />} sub={`${data.ar.length} open invoices`} delay={0.1} />
            <KpiCard icon={<DollarSign size={16} className="text-purple-300" />} label="Active Subs" value={<AnimatedNumber value={data.sub_count} />} sub="Stripe subscriptions" delay={0.15} />
          </div>

          {data.ar.length > 0 && (
            <GlassCard className="p-5" delay={0.2}>
              <SectionTitle right={<span className="text-[11px] text-rose-400">{overdue.length} overdue</span>}>
                AR Aging
              </SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="pb-2 pr-4">Customer</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2 pr-4">Due</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.ar.map((inv) => (
                      <tr key={inv.id} className="hover:bg-white/[0.02]">
                        <td className="py-2 pr-4 text-slate-200">{inv.customer}</td>
                        <td className="py-2 pr-4 font-mono font-semibold text-white">${fmt(inv.amount)}</td>
                        <td className="py-2 pr-4 font-mono text-[11px] text-slate-400">{inv.due ? new Date(inv.due).toLocaleDateString() : "—"}</td>
                        <td className="py-2">
                          <span className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            inv.days_overdue === 0 ? "bg-emerald-500/20 text-emerald-300" :
                            inv.days_overdue < 30 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"
                          )}>
                            {inv.days_overdue === 0 ? "current" : `${inv.days_overdue}d overdue`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {data.ar.length === 0 && (
            <GlassCard className="p-8 text-center">
              <p className="text-sm text-slate-400">No open invoices — all caught up.</p>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, delay }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; delay: number }) {
  return (
    <GlassCard className="p-4" delay={delay}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{icon} {label}</div>
      <div className="mt-2 text-2xl font-extrabold text-white">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>
    </GlassCard>
  );
}
