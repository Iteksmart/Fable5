import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { Server, Monitor, Globe, Shield, CheckCircle2, Clock, AlertTriangle, RefreshCw, Wifi, WifiOff, UserPlus } from "lucide-react";

const API = "https://api.itechsmart.dev";

interface Device {
  device_id: string;
  hostname: string;
  type: string;
  shield_version: string;
  status: string;
  last_seen: string;
  threats_blocked: number;
  agent_name?: string;
  browser?: string;
  metadata?: Record<string, unknown>;
  tenant_id?: string;
}

const TYPE_ICON: Record<string, typeof Server> = {
  server: Server,
  desktop: Monitor,
  "browser-extension": Globe,
};

const STATUS_STYLE: Record<string, string> = {
  protected: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  offline: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

function timeSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tacticalData, setTacticalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [tenants, setTenants] = useState<{id: string; name: string}[]>([]);
  const [assigningDevice, setAssigningDevice] = useState<string | null>(null);
  const [assignTenantId, setAssignTenantId] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);
  const [enrollTenantId, setEnrollTenantId] = useState("");
  const [activeOs, setActiveOs] = useState<"Windows" | "macOS" | "Linux">("Windows");
  const navigate = useNavigate();

  async function fetchDevices() {
    setLoading(true);
    try {
      const d = await fetch(`${API}/v1/shield/devices?internal=true`).then(r => r.json());
      setDevices(d);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchDevices();
    fetch(`${API}/v1/tenants`).then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : (data.tenants || []);
      setTenants(list.map((t: any) => ({ id: t.id, name: t.name })));
    }).catch(() => {});
  }, []);

  const [integrations, setIntegrations] = React.useState<any>(null)
  useEffect(() => {
    fetch('/api/v1/integrations/all')
      .then(r => r.json())
      .then(setIntegrations)
      .catch(() => {})
  }, [])

  async function assignDeviceTenant(deviceId: string, tenantId: string) {
    setSavingAssign(true);
    try {
      await fetch(`${API}/v1/devices/${deviceId}/assign-tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      setAssigningDevice(null);
      setAssignTenantId("");
      await fetchDevices();
    } catch (e) {
      console.error(e);
    }
    setSavingAssign(false);
  }

  async function registerDesktop() {
    setEnrolling(true);
    try {
      if (enrollTenantId) {
        await fetch(`${API}/v1/devices/enroll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostname: "DJuane-Desktop", type: "desktop", tenant_id: enrollTenantId }),
        });
      } else {
        await fetch(`${API}/v1/shield/devices/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: "djuane-desktop",
            hostname: "DJuane-Desktop",
            type: "desktop",
            shield_version: "1.0",
            threats_blocked: 0,
          }),
        });
      }
      await fetchDevices();
    } catch (e) {
      console.error(e);
    }
    setEnrolling(false);
  }

  const token = "shld_reg_ItKHm3P9x7qVnZ2wL5sA8rJd";

  useEffect(() => {
    fetch("/api/integrations/tactical/agents").then(r=>r.ok?r.json():null).then(setTacticalData).catch(()=>{});
  }, []);

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Server size={20} className="text-cyan-400" />
            Protected Devices
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {devices.length} device{devices.length !== 1 ? "s" : ""} enrolled in Shield
          </p>
        </div>
        <button
          onClick={fetchDevices}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* device grid */}
      {loading ? (
        <div className="glass rounded-2xl p-8 text-center text-slate-400 text-sm">Loading devices…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((dev) => {
            const Icon = TYPE_ICON[dev.type] ?? Monitor;
            const statusCls = STATUS_STYLE[dev.status] ?? STATUS_STYLE.offline;
            return (
              <div key={dev.device_id} className="glass rounded-2xl p-5 space-y-4 cursor-pointer hover:border hover:border-cyan-400/20 transition-all" onClick={() => navigate(`/devices/${dev.device_id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-400/20">
                      <Icon size={18} className="text-cyan-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{dev.hostname}</div>
                      <div className="text-[10px] text-slate-500 capitalize">{dev.type.replace("-", " ")}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCls} capitalize`}>
                    {dev.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last seen</span>
                    <span className="text-slate-300 font-mono">{timeSince(dev.last_seen)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Threats blocked</span>
                    <span className="text-rose-400 font-semibold">{dev.threats_blocked.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Shield v{dev.shield_version}</span>
                    {dev.browser && <span className="text-slate-400">{dev.browser}</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {dev.status === "protected" ? (
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    ) : (
                      <AlertTriangle size={12} className="text-yellow-400" />
                    )}
                    <span className="text-[10px] text-slate-400">
                      {dev.status === "protected" ? "Shield active" : "Awaiting shield agent"}
                    </span>
                  </div>
                  {!dev.tenant_id && (
                    <button
                      onClick={e => { e.stopPropagation(); setAssigningDevice(dev.device_id); setAssignTenantId(""); }}
                      className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <UserPlus size={10} />
                      Assign
                    </button>
                  )}
                </div>
                {assigningDevice === dev.device_id && (
                  <div className="mt-2 flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                    <select
                      value={assignTenantId}
                      onChange={e => setAssignTenantId(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value="">Select tenant</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button
                      onClick={() => assignDeviceTenant(dev.device_id, assignTenantId)}
                      disabled={!assignTenantId || savingAssign}
                      className="rounded-lg bg-cyan-500/10 border border-cyan-400/25 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40"
                    >
                      {savingAssign ? "..." : "Save"}
                    </button>
                    <button onClick={() => setAssigningDevice(null)} className="text-[10px] text-slate-500 hover:text-white">x</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* placeholder: enroll desktop */}
          <div className="glass rounded-2xl p-5 border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 min-h-[160px]">
            <Monitor size={24} className="text-slate-600" />
            <div className="text-center">
              <div className="text-sm font-medium text-slate-400">Enroll Desktop</div>
              <div className="text-xs text-slate-600 mt-0.5">DJuane-Desktop</div>
            </div>
            <select
              value={enrollTenantId}
              onChange={e => setEnrollTenantId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
            >
              <option value="">No tenant (internal)</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button
              onClick={registerDesktop}
              disabled={enrolling}
              className="rounded-lg bg-cyan-500/10 border border-cyan-400/25 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
            >
              {enrolling ? "Enrolling..." : "Quick Enroll"}
            </button>
          </div>
        </div>
      )}

      {/* enrollment token + multi-OS install */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Agent Installation</h2>
          <div className="flex gap-1">
            {(["Windows","macOS","Linux"] as const).map(os => (
              <button
                key={os}
                onClick={() => setActiveOs(os)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${activeOs === os ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" : "text-slate-500 hover:text-slate-300"}`}
              >{os}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Registration token — devices get an automatic pulse scan on first connect.
        </p>
        <div className="flex items-center gap-2 bg-black/30 rounded-xl px-4 py-2.5 mb-4">
          <code className="flex-1 font-mono text-xs text-emerald-300 select-all">{token}</code>
          <button onClick={() => navigator.clipboard.writeText(token)} className="text-[10px] text-slate-400 hover:text-white transition-colors">Copy</button>
        </div>
        <div className="space-y-2">
          <div className="text-[10px] text-slate-500 mb-1 font-semibold uppercase tracking-wide">
            {activeOs === "Windows" ? "Windows (Command Prompt / PowerShell)" : activeOs === "macOS" ? "macOS (Terminal)" : "Linux (Bash)"}
          </div>
          {activeOs === "Windows" && (
            <>
              <div className="rounded-lg bg-black/30 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">Step 1</span>
                <code className="flex-1 font-mono text-xs text-sky-300 select-all">{`curl -o shield-agent.py https://api.itechsmart.dev/v1/devices/agent/download`}</code>
                <button onClick={() => navigator.clipboard.writeText("curl -o shield-agent.py https://api.itechsmart.dev/v1/devices/agent/download")} className="text-[10px] text-slate-400 hover:text-white transition-colors shrink-0">Copy</button>
              </div>
              <div className="rounded-lg bg-black/30 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">Step 2</span>
                <code className="flex-1 font-mono text-xs text-emerald-300 select-all">{`python shield-agent.py --token ${token}`}</code>
                <button onClick={() => navigator.clipboard.writeText(`python shield-agent.py --token ${token}`)} className="text-[10px] text-slate-400 hover:text-white transition-colors shrink-0">Copy</button>
              </div>
              <div className="rounded-lg bg-black/30 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">Service</span>
                <code className="flex-1 font-mono text-xs text-purple-300 select-all">{`schtasks /create /tn iTechSmartShield /tr "python shield-agent.py --token ${token}" /sc MINUTE /mo 1 /f`}</code>
                <button onClick={() => navigator.clipboard.writeText(`schtasks /create /tn iTechSmartShield /tr "python shield-agent.py --token ${token}" /sc MINUTE /mo 1 /f`)} className="text-[10px] text-slate-400 hover:text-white transition-colors shrink-0">Copy</button>
              </div>
            </>
          )}
          {activeOs === "macOS" && (
            <>
              <div className="rounded-lg bg-black/30 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">Step 1</span>
                <code className="flex-1 font-mono text-xs text-sky-300 select-all">{`curl -o ~/shield-agent.py https://api.itechsmart.dev/v1/devices/agent/download`}</code>
                <button onClick={() => navigator.clipboard.writeText("curl -o ~/shield-agent.py https://api.itechsmart.dev/v1/devices/agent/download")} className="text-[10px] text-slate-400 hover:text-white transition-colors shrink-0">Copy</button>
              </div>
              <div className="rounded-lg bg-black/30 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">Step 2</span>
                <code className="flex-1 font-mono text-xs text-emerald-300 select-all">{`python3 ~/shield-agent.py --token ${token}`}</code>
                <button onClick={() => navigator.clipboard.writeText(`python3 ~/shield-agent.py --token ${token}`)} className="text-[10px] text-slate-400 hover:text-white transition-colors shrink-0">Copy</button>
              </div>
              <div className="rounded-lg bg-black/30 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">LaunchD</span>
                <code className="flex-1 font-mono text-xs text-purple-300 select-all">{`python3 ~/shield-agent.py --token ${token} --interval 60`}</code>
                <button onClick={() => navigator.clipboard.writeText(`python3 ~/shield-agent.py --token ${token} --interval 60`)} className="text-[10px] text-slate-400 hover:text-white transition-colors shrink-0">Copy</button>
              </div>
            </>
          )}
          {activeOs === "Linux" && (
            <>
              <div className="rounded-lg bg-black/30 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">Step 1</span>
                <code className="flex-1 font-mono text-xs text-sky-300 select-all">{`sudo curl -o /opt/shield-agent.py https://api.itechsmart.dev/v1/devices/agent/download`}</code>
                <button onClick={() => navigator.clipboard.writeText("sudo curl -o /opt/shield-agent.py https://api.itechsmart.dev/v1/devices/agent/download")} className="text-[10px] text-slate-400 hover:text-white transition-colors shrink-0">Copy</button>
              </div>
              <div className="rounded-lg bg-black/30 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">Step 2</span>
                <code className="flex-1 font-mono text-xs text-emerald-300 select-all">{`python3 /opt/shield-agent.py --token ${token}`}</code>
                <button onClick={() => navigator.clipboard.writeText(`python3 /opt/shield-agent.py --token ${token}`)} className="text-[10px] text-slate-400 hover:text-white transition-colors shrink-0">Copy</button>
              </div>
              <div className="rounded-lg bg-black/30 px-4 py-2.5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-12 shrink-0">systemd</span>
                <code className="flex-1 font-mono text-xs text-purple-300 select-all">{`python3 /opt/shield-agent.py --token ${token} --once && sudo systemctl enable --now itechsmart-shield`}</code>
                <button onClick={() => navigator.clipboard.writeText(`python3 /opt/shield-agent.py --token ${token} --once && sudo systemctl enable --now itechsmart-shield`)} className="text-[10px] text-slate-400 hover:text-white transition-colors shrink-0">Copy</button>
              </div>
            </>
          )}
        </div>
      </div>
    
        {/* -- TacticalRMM Managed Endpoints ------------------------------------------------ */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold">TacticalRMM — Managed Endpoints</span>
            <a href="https://tactical.itechsmart.dev" target="_blank" rel="noopener"
               className="text-xs text-cyan-400 hover:underline">Open RMM →</a>
          </div>
          <div className="flex gap-8 mb-4">
            <div className="text-center">
              <div className="text-3xl font-black">{integrations?.tactical?.total ?? 0}</div>
              <div className="text-xs text-white/40">Total agents</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-emerald-400">{integrations?.tactical?.online ?? 0}</div>
              <div className="text-xs text-white/40">Online</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-red-400">{integrations?.tactical?.offline ?? 0}</div>
              <div className="text-xs text-white/40">Offline</div>
            </div>
          </div>
          {(integrations?.tactical?.agents ?? []).length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-white/30">
                  <th className="pb-2">Hostname</th><th className="pb-2">OS</th>
                  <th className="pb-2">Status</th><th className="pb-2">Patches</th><th className="pb-2">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {integrations.tactical.agents.map((a: any, i: number) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-1.5 font-mono">{a.hostname}</td>
                    <td className="py-1.5 text-white/50">{a.os?.slice(0,20)}</td>
                    <td className="py-1.5">
                      <span className={a.status === "online" ? "text-emerald-400" : "text-red-400"}>● {a.status}</span>
                    </td>
                    <td className="py-1.5">
                      {a.patches_pending > 0
                        ? <span className="text-amber-400">{a.patches_pending} pending</span>
                        : <span className="text-emerald-400">✓ current</span>}
                    </td>
                    <td className="py-1.5 text-white/30">
                      {a.last_seen ? new Date(a.last_seen).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!integrations?.tactical?.agents?.length && (
            <p className="text-xs text-white/30">
              {integrations?.tactical?.error ?? "Configure TACTICAL_API_KEY to see enrolled devices"}
            </p>
          )}
        </div>
</div>
  );
}
