import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import {
  Building2, Monitor, Server, Globe, Shield, CheckCircle2, Plus,
  AlertTriangle, RefreshCw, Users, Wifi, WifiOff,
  ChevronRight, Search, Cpu, HardDrive, Activity, Terminal,
  Scan, Send, Upload, Download, Folder, File, Trash2,
} from "lucide-react";

const API = "https://api.itechsmart.dev";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  members_count: number;
  created_at: number;
  device_count: number;
  protected_count: number;
  status: string;
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
  metadata?: Record<string, unknown>;
}

interface Resources {
  live: boolean;
  cpu_percent?: number;
  memory?: { total_gb: number; used_gb: number; percent: number };
  disk?: { total_gb: number; used_gb: number; percent: number };
  uptime_hours?: number;
  note?: string;
}

interface DiscoveredHost {
  ip: string;
  mac: string;
  vendor: string;
  hostname: string;
  os_guess: string;
  type: string;
  open_ports: { port: number; protocol: string; service: string }[];
}

const TYPE_ICON: Record<string, typeof Server> = {
  server: Server,
  desktop: Monitor,
  "browser-extension": Globe,
  network: Wifi,
};

const STATUS_STYLE: Record<string, string> = {
  protected: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  pending:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  offline:   "bg-slate-500/15 text-slate-400 border-slate-500/25",
  no_devices:"bg-slate-500/15 text-slate-400 border-slate-500/25",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
};

function timeSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function MiniBar({ pct, color = "bg-cyan-400" }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-400 w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Device detail panel ───────────────────────────────────────────────────────

function DevicePanel({
  device,
  onClose,
}: {
  device: Device;
  onClose: () => void;
}) {
  const [resources, setResources] = useState<Resources | null>(null);
  const [loadingRes, setLoadingRes] = useState(true);
  const [cmd, setCmd] = useState("");
  const [cmdResult, setCmdResult] = useState<string | null>(null);
  const [cmdSending, setCmdSending] = useState(false);

  const Icon = TYPE_ICON[device.type] ?? Monitor;

  useEffect(() => {
    fetch(`${API}/v1/devices/${device.device_id}/resources`)
      .then((r) => r.json())
      .then(setResources)
      .catch(() => setResources(null))
      .finally(() => setLoadingRes(false));
  }, [device.device_id]);

  async function sendCommand() {
    if (!cmd.trim()) return;
    setCmdSending(true);
    try {
      const r = await fetch(`${API}/v1/devices/${device.device_id}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await r.json();
      setCmdResult(data.message || "Command queued");
      setCmd("");
    } catch (e) {
      setCmdResult("Failed to queue command");
    }
    setCmdSending(false);
  }

  const statusCls = STATUS_STYLE[device.status] ?? STATUS_STYLE.offline;

  return (
    <div className="glass rounded-2xl p-5 space-y-4 border border-cyan-400/10">
      {/* header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-400/20">
            <Icon size={18} className="text-cyan-400" />
          </div>
          <div>
            <div className="font-semibold text-white">{device.hostname}</div>
            <div className="text-[10px] text-slate-500 capitalize">{device.type.replace("-", " ")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCls} capitalize`}>
            {device.status}
          </span>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xs px-2">✕</button>
        </div>
      </div>

      {/* metadata */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-slate-500">IP</span><span className="ml-2 font-mono text-slate-300">{device.ip_address || "—"}</span></div>
        <div><span className="text-slate-500">MAC</span><span className="ml-2 font-mono text-slate-300">{device.mac_address || "—"}</span></div>
        <div><span className="text-slate-500">Last seen</span><span className="ml-2 text-slate-300">{timeSince(device.last_seen)}</span></div>
        <div><span className="text-slate-500">Shield</span><span className="ml-2 text-slate-300">v{device.shield_version}</span></div>
        <div><span className="text-slate-500">Threats blocked</span><span className="ml-2 text-rose-400 font-semibold">{device.threats_blocked}</span></div>
      </div>

      {/* resources */}
      <div className="space-y-2">
        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide flex items-center gap-1">
          <Activity size={10} /> System Resources
        </div>
        {loadingRes ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : resources?.live ? (
          <div className="space-y-1.5">
            <div>
              <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><Cpu size={10} /> CPU</div>
              <MiniBar pct={resources.cpu_percent ?? 0} color={resources.cpu_percent! > 80 ? "bg-rose-400" : "bg-cyan-400"} />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-0.5">Memory {resources.memory?.used_gb}GB / {resources.memory?.total_gb}GB</div>
              <MiniBar pct={resources.memory?.percent ?? 0} color={resources.memory!.percent > 80 ? "bg-orange-400" : "bg-violet-400"} />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 mb-0.5"><HardDrive size={10} className="inline mr-1" />Disk {resources.disk?.used_gb}GB / {resources.disk?.total_gb}GB</div>
              <MiniBar pct={resources.disk?.percent ?? 0} color="bg-emerald-400" />
            </div>
            <div className="text-[10px] text-slate-500">Uptime: {resources.uptime_hours?.toFixed(1)}h</div>
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 italic">{resources?.note ?? "Resources unavailable"}</div>
        )}
      </div>

      {/* command push */}
      <div className="space-y-2">
        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide flex items-center gap-1">
          <Terminal size={10} /> Push Command
        </div>
        <div className="flex gap-2">
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendCommand()}
            placeholder="e.g. pulse-scan, restart-agent, get-status"
            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400/40"
          />
          <button
            onClick={sendCommand}
            disabled={cmdSending || !cmd.trim()}
            className="flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-400/25 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40"
          >
            <Send size={10} />
            {cmdSending ? "…" : "Send"}
          </button>
        </div>
        {cmdResult && (
          <div className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded px-2 py-1">{cmdResult}</div>
        )}
      </div>
    </div>
  );
}

// ── Discover panel ────────────────────────────────────────────────────────────

function DiscoverPanel({ tenantId }: { tenantId: string }) {
  const [subnet, setSubnet] = useState("192.168.1.0/24");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<DiscoveredHost[]>([]);
  const [msg, setMsg] = useState("");
  const [enrolling, setEnrolling] = useState<string | null>(null);

  async function runScan() {
    setScanning(true);
    setResults([]);
    setMsg("");
    try {
      const r = await fetch(`${API}/v1/devices/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subnet, scan_ports: true }),
      });
      const data = await r.json();
      setResults(data.discovered || []);
      setMsg(data.message || `Found ${data.total ?? 0} device(s)`);
    } catch (e) {
      setMsg("Scan failed");
    }
    setScanning(false);
  }

  async function enrollHost(host: DiscoveredHost) {
    setEnrolling(host.ip);
    try {
      const r = await fetch(`${API}/v1/devices/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: host.hostname || host.ip,
          type: host.type,
          tenant_id: tenantId,
          ip_address: host.ip,
          mac_address: host.mac,
        }),
      });
      const data = await r.json();
      alert(`Enrolled! Install cmd:\n${data.install_cmd}`);
    } catch (e) {
      alert("Enrollment failed");
    }
    setEnrolling(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={subnet}
          onChange={(e) => setSubnet(e.target.value)}
          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400/40"
          placeholder="192.168.1.0/24"
        />
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-1.5 rounded-lg bg-violet-500/10 border border-violet-400/25 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/20 disabled:opacity-40"
        >
          <Scan size={12} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scanning…" : "Scan Network"}
        </button>
      </div>

      {msg && <div className="text-[10px] text-slate-400">{msg}</div>}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((host) => {
            const Icon = TYPE_ICON[host.type] ?? Monitor;
            return (
              <div key={host.ip} className="flex items-center gap-3 rounded-xl bg-white/3 border border-white/5 px-3 py-2">
                <Icon size={14} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{host.hostname}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{host.ip} {host.mac && `· ${host.mac}`}</div>
                  {host.os_guess && <div className="text-[10px] text-slate-600">{host.os_guess}</div>}
                </div>
                <div className="text-[10px] text-slate-500">
                  {host.open_ports.slice(0, 3).map((p) => p.port).join(", ")}
                </div>
                <button
                  onClick={() => enrollHost(host)}
                  disabled={enrolling === host.ip}
                  className="shrink-0 rounded-lg bg-cyan-500/10 border border-cyan-400/25 px-2 py-1 text-[10px] text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40"
                >
                  {enrolling === host.ip ? "…" : "Enroll"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────




// ── Tenant Docs Panel ──────────────────────────────────────────────────────

interface TenantDoc {
  filename: string;
  size: number;
  modified: number;
}

function fmtDocSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function TenantDocsPanel({ tenantId }: { tenantId: string }) {
  const [docs, setDocs] = useState<TenantDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = () => {
    setLoading(true);
    fetch(`/api/tenant-docs/${tenantId}/files`)
      .then(r => r.json())
      .then(d => setDocs(d.files || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch(`/api/tenant-docs/${tenantId}/init`, { method: "POST" }).catch(() => {});
    fetchDocs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = await file.arrayBuffer();
      await fetch(`/api/tenant-docs/${tenantId}/upload`, {
        method: "POST",
        headers: { "X-Filename": file.name, "Content-Type": file.type || "application/octet-stream" },
        body,
      });
      fetchDocs();
    } catch {}
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function deleteDoc(filename: string) {
    setDeleting(filename);
    try {
      await fetch(`/api/tenant-docs/${tenantId}/${encodeURIComponent(filename)}`, { method: "DELETE" });
      setDocs(prev => prev.filter(d => d.filename !== filename));
    } catch {}
    setDeleting(null);
  }

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Folder size={14} className="text-orange-400" />
          Tenant Documents
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDocs}
            disabled={loading}
            className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <label className="cursor-pointer flex items-center gap-1.5 rounded-lg bg-orange-500/10 border border-orange-400/25 px-3 py-1.5 text-[10px] text-orange-300 hover:bg-orange-500/20 transition-colors">
            <Upload size={10} />
            {uploading ? "Uploading…" : "Upload File"}
            <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500 py-3 text-center">Loading files…</div>
      ) : docs.length === 0 ? (
        <div className="py-5 text-center text-slate-600 text-xs">No files yet. Upload SOPs, reports, or policies.</div>
      ) : (
        <div className="space-y-1.5">
          {docs.map(doc => (
            <div key={doc.filename} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2">
              <File size={13} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-200 truncate">{doc.filename}</div>
                <div className="text-[10px] text-slate-500">{fmtDocSize(doc.size)}</div>
              </div>
              <a
                href={`/api/tenant-docs/${tenantId}/download/${encodeURIComponent(doc.filename)}`}
                download
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[10px] shrink-0"
              >
                <Download size={10} />Download
              </a>
              <button
                onClick={() => deleteDoc(doc.filename)}
                disabled={deleting === doc.filename}
                className="text-slate-600 hover:text-rose-400 transition-colors shrink-0 ml-1"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [tenantDevices, setTenantDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showNewTenant, setShowNewTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showDiscover, setShowDiscover] = useState(false);
  const [enrollForm, setEnrollForm] = useState(false);
  const [enrollData, setEnrollData] = useState({ hostname: "", type: "desktop" });
  const [enrolling, setEnrolling] = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ token: string; cmd: string } | null>(null);
  const navigate = useNavigate();

  async function fetchTenants() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/v1/tenants`);
      const data = await r.json();
      setTenants(data.tenants || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function fetchTenantDevices(orgId: string) {
    setLoadingDevices(true);
    setSelectedDevice(null);
    setShowDiscover(false);
    setEnrollForm(false);
    setEnrollResult(null);
    try {
      const r = await fetch(`${API}/v1/tenants/${orgId}/devices`);
      const data = await r.json();
      setTenantDevices(data.devices || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingDevices(false);
  }

  useEffect(() => { fetchTenants(); }, []);

  function selectTenant(t: Tenant) {
    setSelected(t);
    fetchTenantDevices(t.id);
  }

  async function enrollNewDevice() {
    if (!selected || !enrollData.hostname) return;
    setEnrolling(true);
    try {
      const r = await fetch(`${API}/v1/devices/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: enrollData.hostname,
          type: enrollData.type,
          tenant_id: selected.id,
        }),
      });
      const data = await r.json();
      setEnrollResult({ token: data.enrollment_token, cmd: data.install_cmd });
      setEnrollData({ hostname: "", type: "desktop" });
      await fetchTenantDevices(selected.id);
    } catch (e) {
      console.error(e);
    }
    setEnrolling(false);
  }

  const filtered = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  async function createTenant() {
    if (!newTenantName.trim()) return;
    setCreatingTenant(true);
    setCreateError("");
    try {
      const r = await fetch(`${API}/v1/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTenantName.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setCreateError(JSON.stringify(data.detail || data)); }
      else {
        setShowNewTenant(false);
        setNewTenantName("");
        await fetchTenants();
      }
    } catch (e: any) { setCreateError(e.message); }
    setCreatingTenant(false);
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 size={20} className="text-violet-400" />
            Tenant Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {tenants.length} organization{tenants.length !== 1 ? "s" : ""} in iTechSmart
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowNewTenant(true); setNewTenantName(""); setCreateError(""); }}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/25 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            <Plus size={12} />
            New Tenant
          </button>
          <button
            onClick={fetchTenants}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Sync from Clerk
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* tenant list */}
        <div className="lg:col-span-2 space-y-3">
          {/* search */}
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants…"
              className="w-full bg-black/20 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-400/40"
            />
          </div>

          {loading ? (
            <div className="glass rounded-2xl p-6 text-center text-slate-500 text-xs">Loading tenants…</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => {
                const statusCls = STATUS_STYLE[t.status] ?? STATUS_STYLE.offline;
                const isSelected = selected?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTenant(t)}
                    className={`w-full text-left glass rounded-2xl p-4 space-y-2 transition-all border ${
                      isSelected ? "border-violet-400/30" : "border-transparent hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-400/20">
                          <Building2 size={14} className="text-violet-400" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{t.name}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Users size={8} /> {t.members_count} member{t.members_count !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={14} className={`text-slate-600 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCls} capitalize`}>
                        {t.status === "no_devices" ? "No devices" : t.status}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {t.device_count} device{t.device_count !== 1 ? "s" : ""}
                        {t.protected_count > 0 && ` · ${t.protected_count} protected`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* right panel */}
        <div className="lg:col-span-3 space-y-4">
          {!selected ? (
            <div className="glass rounded-2xl p-8 text-center text-slate-500 text-sm">
              <Building2 size={32} className="mx-auto mb-3 text-slate-700" />
              Select a tenant to manage their devices
            </div>
          ) : (
            <>
              {/* tenant header */}
              <div className="glass rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{selected.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{selected.id}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDiscover(!showDiscover); setEnrollForm(false); setEnrollResult(null); }}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-500/10 border border-violet-400/25 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/20"
                  >
                    <Scan size={12} /> Discover
                  </button>
                  <button
                    onClick={() => { setEnrollForm(!enrollForm); setShowDiscover(false); setEnrollResult(null); }}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/25 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20"
                  >
                    <Plus size={12} /> Enroll Device
                  </button>
                </div>
              </div>

              {/* discover panel */}
              {showDiscover && (
                <div className="glass rounded-2xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Scan size={14} className="text-violet-400" /> Network Discovery
                  </div>
                  <DiscoverPanel tenantId={selected.id} />
                </div>
              )}

              {/* enroll form */}
              {enrollForm && (
                <div className="glass rounded-2xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Plus size={14} className="text-cyan-400" /> Enroll New Device
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={enrollData.hostname}
                      onChange={(e) => setEnrollData({ ...enrollData, hostname: e.target.value })}
                      placeholder="Hostname (e.g. acme-workstation-01)"
                      className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400/40"
                    />
                    <select
                      value={enrollData.type}
                      onChange={(e) => setEnrollData({ ...enrollData, type: e.target.value })}
                      className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="desktop">Desktop</option>
                      <option value="server">Server</option>
                      <option value="browser-extension">Browser Extension</option>
                    </select>
                    <button
                      onClick={enrollNewDevice}
                      disabled={enrolling || !enrollData.hostname}
                      className="rounded-lg bg-cyan-500/10 border border-cyan-400/25 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40"
                    >
                      {enrolling ? "…" : "Enroll"}
                    </button>
                  </div>

                  {enrollResult && (
                    <div className="space-y-2 bg-black/20 rounded-xl p-3">
                      <div className="text-[10px] text-emerald-400 font-semibold">Device pre-enrolled. Run this on the target machine:</div>
                      <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                        <code className="flex-1 font-mono text-[10px] text-sky-300 break-all">{enrollResult.cmd}</code>
                        <button
                          onClick={() => navigator.clipboard.writeText(enrollResult.cmd)}
                          className="shrink-0 text-[10px] text-slate-400 hover:text-white"
                        >Copy</button>
                      </div>
                      <div className="text-[10px] text-slate-500">Token: <code className="text-emerald-300">{enrollResult.token}</code></div>
                    </div>
                  )}
                </div>
              )}

              {/* device detail */}
              {selectedDevice && (
                <DevicePanel
                  device={selectedDevice}
                  onClose={() => setSelectedDevice(null)}
                />
              )}

              {/* device list */}
              <div className="glass rounded-2xl p-4 space-y-3">
                <div className="text-sm font-semibold text-white flex items-center justify-between">
                  <span>Enrolled Devices</span>
                  <span className="text-[10px] font-normal text-slate-500">{tenantDevices.length} device{tenantDevices.length !== 1 ? "s" : ""}</span>
                </div>

                {loadingDevices ? (
                  <div className="text-xs text-slate-500 py-4 text-center">Loading devices…</div>
                ) : tenantDevices.length === 0 ? (
                  <div className="py-6 text-center text-slate-600 text-xs">
                    No devices enrolled yet. Use "Discover" to scan the network or "Enroll Device" to add manually.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tenantDevices.map((dev) => {
                      const Icon = TYPE_ICON[dev.type] ?? Monitor;
                      const statusCls = STATUS_STYLE[dev.status] ?? STATUS_STYLE.offline;
                      const isActive = selectedDevice?.device_id === dev.device_id;
                      return (
                        <button
                          key={dev.device_id}
                          onClick={() => navigate(`/devices/${dev.device_id}`)}
                          className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all border ${
                            isActive ? "bg-cyan-500/5 border-cyan-400/20" : "bg-white/3 border-white/5 hover:border-white/10"
                          }`}
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-400/15 shrink-0">
                            <Icon size={12} className="text-cyan-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white truncate">{dev.hostname}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                              <span>{timeSince(dev.last_seen)}</span>
                              {dev.ip_address && <span className="font-mono">{dev.ip_address}</span>}
                            </div>
                          </div>
                          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCls} capitalize`}>
                            {dev.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* tenant docs */}
              <TenantDocsPanel tenantId={selected.id} />
            </>
          )}
        </div>
      </div>
      {/* New Tenant Modal */}
      {showNewTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 size={16} className="text-cyan-400" />
                Create New Tenant
              </h2>
              <button onClick={() => setShowNewTenant(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 uppercase tracking-wide">Organization Name</label>
              <input
                autoFocus
                value={newTenantName}
                onChange={e => setNewTenantName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createTenant()}
                placeholder="e.g. Northwind Logistics"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400/40"
              />
            </div>
            {createError && <p className="text-xs text-rose-400">{createError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewTenant(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">Cancel</button>
              <button
                onClick={createTenant}
                disabled={!newTenantName.trim() || creatingTenant}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/30 disabled:opacity-40 transition-colors"
              >
                {creatingTenant ? "Creating..." : "Create in Clerk"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
