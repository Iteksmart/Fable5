import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Download, Filter, Hash, Search, XCircle } from "lucide-react";
import clsx from "clsx";
import { GlassCard, NeonButton, SectionTitle } from "../components/ui";

interface Receipt { hash: string; category: string; ts: string; actor: string; chain_id: string; }
interface VerifyResult { found: boolean; entry: { hash: string; category: string; ts: string; actor: string; chain_id: string; prev_hash: string } | null; }

const CATEGORIES = ["", "gitops_deploy", "observability_loki_deployed", "observability_tempo_deployed", "e3_core_db", "gitops_deploy", "gitops_wave1_labeled", "docker_hub_images_pushed", "github_actions_workflows_deployed"];

export default function Audit() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    fetch(`/api/audit/receipts?${params}`)
      .then((r) => r.json())
      .then((d) => { setReceipts(d.entries || []); setTotal(d.total || 0); })
      .finally(() => setLoading(false));
  }, [category, q, offset]);

  useEffect(() => { load(); }, [load]);

  async function verifyHash(hash: string) {
    setVerifying(true);
    try {
      const d = await fetch(`/api/audit/verify/${hash}`).then((r) => r.json());
      setVerify(d);
    } finally { setVerifying(false); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <GlassCard hover={false} className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">ProofLink Ledger</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
              Receipt <span className="text-gradient">Audit</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">{total.toLocaleString()} receipts · hash-chained · 0 breaks</p>
          </div>
          <a href="/api/audit/csv" className="glass glass-hover inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-cyan-300">
            <Download size={14} /> Export CSV
          </a>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="glass flex items-center gap-2 rounded-xl px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Search hash / actor…" className="bg-transparent text-sm text-white outline-none placeholder:text-slate-500 w-48" />
          </div>
          <div className="glass flex items-center gap-2 rounded-xl px-3 py-2">
            <Filter size={14} className="text-slate-400" />
            <select value={category} onChange={(e) => { setCategory(e.target.value); setOffset(0); }} className="bg-transparent text-sm text-white outline-none cursor-pointer">
              <option value="">All categories</option>
              {CATEGORIES.filter(Boolean).filter((c, i, a) => a.indexOf(c) === i).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-3 flex items-center justify-between">
          <SectionTitle>Receipts</SectionTitle>
          {loading && <span className="text-[11px] shimmer-text">loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Hash (16)</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {receipts.map((r) => (
                <tr key={r.hash} className="hover:bg-white/[0.03] cursor-pointer" onClick={() => { setSelected(r); setVerify(null); verifyHash(r.hash); }}>
                  <td className="px-5 py-2.5 font-mono text-[11px] text-cyan-300">{r.hash?.slice(0, 16)}</td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-300">{r.category}</span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-300">{r.actor}</td>
                  <td className="px-5 py-2.5 font-mono text-[11px] text-slate-400">{new Date(r.ts).toLocaleString()}</td>
                  <td className="px-5 py-2.5">
                    <Hash size={12} className="text-slate-600 hover:text-cyan-400" />
                  </td>
                </tr>
              ))}
              {!loading && receipts.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">No receipts found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
            <span className="text-[11px] text-slate-400">{offset + 1}–{Math.min(offset + LIMIT, total)} of {total.toLocaleString()}</span>
            <div className="flex gap-2">
              <NeonButton variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>← Prev</NeonButton>
              <NeonButton variant="ghost" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>Next →</NeonButton>
            </div>
          </div>
        )}
      </GlassCard>

      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="glass w-[560px] rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-base font-bold text-white">Receipt Verification</div>
                <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white"><XCircle size={18} /></button>
              </div>
              <div className="space-y-2 font-mono text-xs">
                {verifying && <div className="shimmer-text py-4 text-center">Verifying on-chain…</div>}
                {!verifying && verify && (
                  <>
                    <div className={clsx("flex items-center gap-2 rounded-xl px-3 py-2.5", verify.found ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
                      {verify.found ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      <span className="font-semibold">{verify.found ? "Verified — receipt found in chain" : "NOT FOUND — receipt absent from ledger"}</span>
                    </div>
                    {verify.entry && (
                      <div className="mt-3 space-y-1.5 rounded-xl bg-white/[0.03] p-4">
                        {Object.entries(verify.entry).map(([k, v]) => (
                          <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
                            <span className="text-slate-500">{k}</span>
                            <span className="break-all text-slate-200">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
