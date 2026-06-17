import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Server, Monitor, Globe, ExternalLink, RefreshCw,
  Wifi, Building2, ChevronRight, Clock, Lock, FileText,
} from "lucide-react";

const API = "https://api.itechsmart.dev";

interface ShieldStats {
  threat_score: number;
  threats_blocked: number;
  policies_active: number;
  compliance_score: number;
  devices_protected: number;
  last_scan: string;
  firewall_rules: number;
  encryption_status: string;
}

interface ComplianceItem {
  framework: string;
  score: number;
  status: string;
  controls: number;
  passing: number;
}

interface Device {
  device_id: string;
  hostname: string;
  type: string;
  shield_version: string;
  status: string;
  last_seen: string;
  threats_blocked: number;
  ip_address?: string;
  mac_address?: string;
  tenant_id?: string;
  agent_name?: string;
  internal?: boolean;
}

interface Tenant {
  id: string;
  name: string;
  device_count: number;
  protected_count: number;
  status: string;
  logo_url?: string;
}

const TYPE_ICON: Record<string, typeof Server> = {
  server: Server, desktop: Monitor, "browser-extension": Globe, network: Wifi,
};

const STATUS_CLS: Record<string, string> = {
  protected: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  pending:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  offline:   "bg-slate-500/15 text-slate-400 border-slate-500/25",
  no_devices:"bg-slate-500/15 text-slate-400 border-slate-500/25",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
};

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 90 ? "#22d3ee" : score >= 70 ? "#a78bfa" : "#f87171";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}/>
    </svg>
  );
}

export default function ShieldPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ShieldStats | null>(null);
  const [compliance, setCompliance] = useState<ComplianceItem[]>([]);
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function fetchAll() {
    setLoading(true);
    try {
      const [s, c, d, t] = await Promise.all([
        fetch(`${API}/v1/shield/stats`).then(r => r.json()),
        fetch(`${API}/v1/shield/compliance`).then(r => r.json()),
        fetch(`${API}/v1/shield/devices`).then(r => r.json()),
        fetch(`${API}/v1/tenants`).then(r => r.json()),
      ]);
      setStats(s);
      setCompliance(Array.isArray(c) ? c : []);
      setAllDevices(Array.isArray(d) ? d : []);
      setTenants(t.tenants || []);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  const visibleDevices = selectedTenant === "all"
    ? allDevices
    : allDevices.filter(d => d.tenant_id === selectedTenant);

  const tenantStats = !stats ? null : selectedTenant === "all" ? stats : {
    ...stats,
    devices_protected: visibleDevices.filter(d => d.status === "protected").length,
    threats_blocked: visibleDevices.reduce((a, d) => a + (d.threats_blocked || 0), 0),
  };

  const avgCompliance = compliance.length
    ? Math.round(compliance.reduce((a, c) => a + c.score, 0) / compliance.length) : 0;

  const selectedTenantObj = tenants.find(t => t.id === selectedTenant);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield size={20} className="text-cyan-400" />
            iTechSmart Shield
            {selectedTenantObj && (
              <span className="text-sm font-normal text-cyan-300 ml-1">
                — {selectedTenantObj.name}
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Security posture · Last scan {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
            <Building2 size={12} className="text-slate-400 shrink-0"/>
            <select
              value={selectedTenant}
              onChange={e => setSelectedTenant(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer pr-1"
            >
              <option value="all">All Tenants</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <a href="https://shield.itechsmart.dev" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20 transition-colors">
            <ExternalLink size={12}/>Open Shield Dashboard
          </a>
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""}/>Refresh
          </button>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Threat Score", value: tenantStats?.threat_score ?? 0, ring: true, color: "text-cyan-400" },
          { label: "Threats Blocked", value: tenantStats?.threats_blocked ?? 0, color: "text-rose-400" },
          { label: "Devices Protected", value: tenantStats?.devices_protected ?? 0, color: "text-emerald-400" },
          { label: "Avg Compliance", value: avgCompliance, suffix: "%", color: "text-purple-400" },
        ].map(({ label, value, ring, suffix, color }) => (
          <div key={label} className="glass rounded-2xl p-4">
            <div className="text-xs font-medium text-slate-400 mb-3">{label}</div>
            {ring ? (
              <div className="relative flex items-center justify-center">
                <ScoreRing score={value as number}/>
                <div className="absolute">
                  <div className={`text-lg font-bold text-center ${color}`}>{value}</div>
                </div>
              </div>
            ) : (
              <div className={`text-3xl font-bold tabular-nums ${color}`}>
                {typeof value === "number" ? value.toLocaleString() : value}{suffix || ""}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* device table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Monitor size={14} className="text-cyan-400"/>
            Devices
            <span className="text-xs text-slate-500 font-normal">({visibleDevices.length})</span>
          </h2>
          <button
            onClick={() => navigate(selectedTenant === "all" ? "/devices" : "/tenants")}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            Manage <ChevronRight size={12}/>
          </button>
        </div>
        {visibleDevices.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            {loading ? "Loading devices…" : "No devices found for this tenant"}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {visibleDevices.map(device => {
              const Icon = TYPE_ICON[device.type] ?? Monitor;
              const statusCls = STATUS_CLS[device.status] ?? STATUS_CLS.offline;
              const tenant = tenants.find(t => t.id === device.tenant_id);
              return (
                <button
                  key={device.device_id}
                  onClick={() => navigate(`/devices/${device.device_id}`)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left group"
                >
                  <div className="p-2 rounded-lg bg-white/5 text-slate-400 group-hover:text-cyan-400 transition-colors shrink-0">
                    <Icon size={14}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{device.hostname}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${statusCls}`}>
                        {device.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="capitalize">{device.type.replace("-", " ")}</span>
                      {device.ip_address && <span className="font-mono">{device.ip_address}</span>}
                      {tenant && selectedTenant === "all" && (
                        <span className="text-cyan-500/70">{tenant.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="text-xs font-semibold text-rose-400 tabular-nums">
                      {device.threats_blocked > 0 ? `${device.threats_blocked} blocked` : "—"}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1">
                      <Clock size={10}/>
                      {timeSince(device.last_seen)}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0"/>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* compliance + security + tenant strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText size={14} className="text-purple-400"/>Compliance Frameworks
            </h2>
            <a href="https://shield.itechsmart.dev/compliance" target="_blank" rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              Details <ExternalLink size={10}/>
            </a>
          </div>
          <div className="space-y-3">
            {compliance.map(f => (
              <div key={f.framework} className="flex items-center gap-3">
                <div className="w-28 text-xs text-slate-400 truncate">{f.framework}</div>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${f.score}%`, background: f.score >= 90 ? "#22d3ee" : f.score >= 70 ? "#a78bfa" : "#f87171" }}/>
                </div>
                <div className="w-10 text-right text-xs font-semibold text-white tabular-nums">{f.score}%</div>
                <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  f.status === "compliant" ? "bg-emerald-500/15 text-emerald-300" : "bg-yellow-500/15 text-yellow-300"
                }`}>{f.status === "compliant" ? "PASS" : "IN PROG"}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Lock size={14} className="text-cyan-400"/>Security Overview
            </h2>
            <div className="space-y-2.5 text-sm">
              {[
                { label: "Active Policies", value: stats?.policies_active ?? 0, color: "text-cyan-400" },
                { label: "Firewall Rules", value: stats?.firewall_rules ?? 0, color: "text-purple-400" },
                { label: "Encryption", value: stats?.encryption_status ?? "—", color: "text-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-slate-400">{label}</span>
                  <span className={`font-semibold ${color} capitalize`}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Building2 size={14} className="text-cyan-400"/>Tenants
              <span className="text-xs text-slate-500 font-normal">({tenants.length})</span>
            </h2>
            <div className="space-y-2">
              {tenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTenant(t.id === selectedTenant ? "all" : t.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 transition-colors text-left ${
                    selectedTenant === t.id
                      ? "bg-cyan-500/10 border border-cyan-500/20"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{t.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {t.device_count} device{t.device_count !== 1 ? "s" : ""} · {t.protected_count} protected
                    </div>
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_CLS[t.status] ?? STATUS_CLS.offline}`}>
                    {t.status.replace("_", " ")}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
