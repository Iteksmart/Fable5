import { useEffect, useState, useRef } from "react";
import {
  FileText, Download, RefreshCw, Building2, Calendar,
  Shield, Activity, Monitor, Server, Cloud, DollarSign,
  ClipboardList, ShieldCheck, TrendingUp, Users, Wrench,
  BarChart3, Cpu, Heart, Target, CheckSquare, AlertTriangle,
  Zap, Eye, Brain, Play, Receipt, BookOpen, ChevronDown,
  ChevronRight, Loader2, CheckCircle2, XCircle,
} from "lucide-react";

interface ReportType { id: string; label: string; group: string; }
interface Tenant { id: string; name: string; slug: string; members_count: number; device_count: number; protected_count?: number; status?: string; }
interface GenEntry { id: string; reportType: string; label: string; tenant: string; ts: number; status: "ok" | "err"; }

const GROUP_ICONS: Record<string, typeof FileText> = {
  "MSP Standard": ClipboardList,
  "UAIO": Zap,
  "Platform": Cpu,
};

const REPORT_ICONS: Record<string, typeof FileText> = {
  "executive-summary": TrendingUp,
  "help-desk": Users,
  "security": Shield,
  "patch-management": Wrench,
  "backup-dr": Server,
  "asset-inventory": Monitor,
  "microsoft-365": Cloud,
  "cloud-usage": Cloud,
  "compliance": ShieldCheck,
  "qbr": BarChart3,
  "ticket": ClipboardList,
  "monitoring": Activity,
  "sla": CheckSquare,
  "uaio-detect": Eye,
  "uaio-simulate": Brain,
  "uaio-decide": Target,
  "uaio-execute": Play,
  "uaio-prooflink": Receipt,
  "uaio-learn": BookOpen,
  "infrastructure": Server,
  "health": Heart,
  "cost-savings": DollarSign,
};

const GROUP_COLOR: Record<string, string> = {
  "MSP Standard": "border-blue-500/30 bg-blue-500/5",
  "UAIO": "border-cyan-500/30 bg-cyan-500/5",
  "Platform": "border-purple-500/30 bg-purple-500/5",
};
const ICON_COLOR: Record<string, string> = {
  "MSP Standard": "text-blue-400",
  "UAIO": "text-cyan-400",
  "Platform": "text-purple-400",
};

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function Reports() {
  const [types, setTypes] = useState<ReportType[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [dateFrom, setDateFrom] = useState(formatDate(new Date(Date.now() - 30*24*60*60*1000)));
  const [dateTo, setDateTo] = useState(formatDate(new Date()));
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<GenEntry[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [tenantOpen, setTenantOpen] = useState(false);
  const tenantRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/reports/types").then(r => r.json()).then(d => {
      setTypes(d.types || []);
      setGroups(d.groups || []);
      const exp: Record<string, boolean> = {};
      (d.groups || []).forEach((g: string) => { exp[g] = true; });
      setExpandedGroups(exp);
    }).catch(() => {});
    fetch("/api/v1/tenants").then(r => r.json()).then((d: any) => {
      const ts = d.tenants || d; if (ts && ts.length) setTenants(ts);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (tenantRef.current && !tenantRef.current.contains(e.target as Node)) setTenantOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function generate() {
    if (!selectedReport || !selectedTenant) return;
    setGenerating(true);
    const entry: GenEntry = {
      id: Math.random().toString(36).slice(2),
      reportType: selectedReport.id,
      label: selectedReport.label,
      tenant: selectedTenant!.name,
      ts: Date.now(),
      status: "ok",
    };
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: selectedReport.id,
          tenantId: selectedTenant!.id,
          tenantName: selectedTenant!.name,
          tenantSlug: selectedTenant!.slug,
          from: new Date(dateFrom).toLocaleDateString("en-US"),
          to: new Date(dateTo).toLocaleDateString("en-US"),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `itechsmart-${selectedReport.id}-${selectedTenant.id}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      entry.status = "err";
    } finally {
      setGenerating(false);
      setHistory(h => [entry, ...h].slice(0, 20));
    }
  }

  const byGroup = groups.reduce<Record<string, ReportType[]>>((acc, g) => {
    acc[g] = types.filter(t => t.group === g);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <FileText className="text-cyan-400" size={24} />
          <h1 className="text-2xl font-bold text-white">Tenant Reports</h1>
        </div>
        <p className="text-slate-400 text-sm">Generate downloadable PDF reports for any tenant — MSP standard, UAIO loop, and platform intelligence reports.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Report Catalog */}
        <div className="xl:col-span-2 space-y-4">
          {groups.map(group => {
            const GroupIcon = GROUP_ICONS[group] || FileText;
            const isOpen = expandedGroups[group] !== false;
            return (
              <div key={group} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedGroups(e => ({ ...e, [group]: !isOpen }))}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GroupIcon size={16} className={ICON_COLOR[group] || "text-slate-400"} />
                    <span className="font-semibold text-white text-sm">{group}</span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                      {byGroup[group]?.length || 0} reports
                    </span>
                  </div>
                  {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(byGroup[group] || []).map(rt => {
                      const Icon = REPORT_ICONS[rt.id] || FileText;
                      const isSelected = selectedReport?.id === rt.id;
                      return (
                        <button
                          key={rt.id}
                          onClick={() => setSelectedReport(rt)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? "border-cyan-500 bg-cyan-500/10 text-white"
                              : `${GROUP_COLOR[group] || "border-slate-700 bg-slate-800/30"} text-slate-300 hover:border-slate-600 hover:bg-slate-800/60`
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${isSelected ? "bg-cyan-500/20" : "bg-slate-700/50"}`}>
                            <Icon size={14} className={isSelected ? "text-cyan-400" : ICON_COLOR[group] || "text-slate-400"} />
                          </div>
                          <span className="text-xs font-medium leading-tight">{rt.label}</span>
                          {isSelected && <CheckCircle2 size={12} className="text-cyan-400 ml-auto flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {types.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              Loading report catalog...
            </div>
          )}
        </div>

        {/* Right: Generator Panel */}
        <div className="space-y-4">
          {/* Selected Report */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Target size={14} className="text-cyan-400" />
              Generate Report
            </h2>

            {/* Report selection indicator */}
            <div className={`p-3 rounded-lg border mb-4 ${
              selectedReport ? "border-cyan-500/40 bg-cyan-500/5" : "border-slate-700 bg-slate-800/30"
            }`}>
              {selectedReport ? (
                <div>
                  <div className="text-xs text-cyan-400 mb-0.5">Selected Report</div>
                  <div className="text-sm font-semibold text-white">{selectedReport.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{selectedReport.group}</div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 text-center py-1">
                  Select a report from the catalog
                </div>
              )}
            </div>

            {/* Tenant Selector */}
            <div className="mb-4" ref={tenantRef}>
              <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                <Building2 size={11} />
                Client / Tenant
                <span className="ml-auto text-xs text-red-400 font-medium">required</span>
              </label>
              <div className="relative">
                <button
                  onClick={() => setTenantOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white hover:border-slate-600 transition-colors"
                >
                  <span className={`truncate ${!selectedTenant ? "text-slate-500" : "text-white"}`}>{selectedTenant ? selectedTenant.name : "Select a tenant..."}</span>
                  <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
                </button>
                {tenantOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                    {tenants.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTenant(t); setTenantOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2 ${
                          selectedTenant?.id === t.id ? "text-cyan-400" : "text-slate-300"
                        }`}
                      >
                        <Building2 size={12} className="flex-shrink-0" />
                        <span className="truncate">{t.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tenant Stats (shown when tenant selected) */}
            {selectedTenant && (
              <div className="mb-4 p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={12} className="text-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-400">{selectedTenant.name}</span>
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    selectedTenant.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                  }`}>{selectedTenant.status || 'active'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{selectedTenant.device_count}</div>
                    <div className="text-xs text-slate-500">Devices</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-400">{selectedTenant.protected_count ?? 0}</div>
                    <div className="text-xs text-slate-500">Protected</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-300">{selectedTenant.members_count}</div>
                    <div className="text-xs text-slate-500">Members</div>
                  </div>
                </div>
              </div>
            )}



            {/* Generate Button */}
            <button
              onClick={generate}
              disabled={!selectedReport || !selectedTenant || generating}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                !selectedReport || !selectedTenant
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  : generating
                  ? "bg-cyan-600/50 text-cyan-300 cursor-not-allowed"
                  : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30"
              }`}
            >
              {generating ? (
                <><Loader2 size={15} className="animate-spin" /> Generating PDF...</>
              ) : (
                <><Download size={15} /> Download PDF</>
              )}
            </button>

            {!selectedTenant && (
              <p className="text-xs text-yellow-500/70 text-center mt-2 flex items-center justify-center gap-1">
                <AlertTriangle size={11} /> Select a tenant to enable generation
              </p>
            )}
            {selectedReport && selectedTenant && !generating && (
              <p className="text-xs text-slate-500 text-center mt-2">
                PDF will download automatically when ready
              </p>
            )}
          </div>

          {/* Generation History */}
          {history.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <RefreshCw size={14} className="text-slate-400" />
                Recent Generations
              </h2>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                    h.status === "ok"
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-red-500/20 bg-red-500/5"
                  }`}>
                    {h.status === "ok"
                      ? <CheckCircle2 size={12} className="text-green-400 flex-shrink-0" />
                      : <XCircle size={12} className="text-red-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-300 font-medium truncate">{h.label}</div>
                      <div className="text-slate-500">{h.tenant} · {new Date(h.ts).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Report Catalog</h2>
            <div className="space-y-2">
              {groups.map(g => (
                <div key={g} className="flex items-center justify-between text-xs">
                  <span className={`${ICON_COLOR[g] || "text-slate-400"}`}>{g}</span>
                  <span className="text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{byGroup[g]?.length || 0}</span>
                </div>
              ))}
              <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Reports</span>
                <span className="text-cyan-400 font-bold">{types.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
