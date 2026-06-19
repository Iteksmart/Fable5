import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import {
  Monitor, Server, Globe, Wifi, ArrowLeft, CheckCircle2,
  AlertTriangle, Clock, RefreshCw, Cpu, HardDrive, Activity,
  Terminal, Send, Scan, Shield, Package, ChevronRight,
  Copy, Check, Zap, Network,
} from "lucide-react";

const API = "https://api.itechsmart.dev";

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
  metadata?: Record<string, unknown>;
}

interface Resources {
  live: boolean;
  cpu_percent?: number;
  memory?: { total_gb: number; used_gb: number; percent: number };
  disk?: { total_gb: number; used_gb: number; percent: number };
  network?: { bytes_sent_mb: number; bytes_recv_mb: number };
  uptime_hours?: number;
  platform?: string;
  note?: string;
}

interface Command {
  cmd_id: string;
  command: string;
  queued_at: string;
  status: string;
  result?: string | null;
}

interface ScanSummary {
  platform?: string;
  hostname?: string;
  uptime_seconds?: number;
  process_count?: number;
  running_services?: number;
  open_ports?: number;
  av_enabled?: boolean;
  last_patches?: Array<{ HotFixID: string; Description: string; InstalledOn: any }>;
}

interface Scan {
  scan_id: string;
  scan_type?: string;
  subnet?: string;
  scanned_at: string;
  total?: number;
  host_count?: number;
  scanner?: string;
  summary?: ScanSummary;
}

const TYPE_ICON: Record<string, typeof Server> = {
  server: Server,
  desktop: Monitor,
  "browser-extension": Globe,
  network: Wifi,
};

const STATUS_STYLE: Record<string, { badge: string; dot: string }> = {
  protected: { badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25", dot: "bg-emerald-400" },
  pending:   { badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25", dot: "bg-yellow-400" },
  offline:   { badge: "bg-slate-500/15 text-slate-400 border-slate-500/25", dot: "bg-slate-500" },
};

function timeSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function MiniBar({ label, pct, sub, color = "bg-cyan-400" }: {
  label: string; pct: number; sub?: string; color?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-mono">{sub || `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-slate-500 hover:text-white transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

// ── Terminal emulator (command queue) ─────────────────────────────────────────
function DeviceTerminal({ deviceId, hostname }: { deviceId: string; hostname: string }) {
  const [lines, setLines] = useState<{ text: string; type: "cmd" | "out" | "err" | "info" }[]>([
    { text: `Connected to ${hostname} via iTechSmart Agent`, type: "info" },
    { text: `Type a command and press Enter. Results appear when the agent checks in.`, type: "info" },
    { text: `Commands: pulse-scan, get-status, restart-agent, list-processes, get-uptime`, type: "info" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  async function submit() {
    if (!input.trim() || sending) return;
    const cmd = input.trim();
    setInput("");
    setHistory((h) => [cmd, ...h].slice(0, 50));
    setHistIdx(-1);
    setLines((l) => [...l, { text: `$ ${cmd}`, type: "cmd" }]);
    setSending(true);
    try {
      const r = await fetch(`${API}/v1/devices/${deviceId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await r.json();
      setLines((l) => [...l,
        { text: data.message || "Command queued", type: "out" },
        { text: `cmd_id: ${data.cmd_id || "—"}`, type: "info" },
      ]);
    } catch (e) {
      setLines((l) => [...l, { text: `Error: ${e}`, type: "err" }]);
    }
    setSending(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { submit(); return; }
    if (e.key === "ArrowUp") {
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      if (history[idx]) setInput(history[idx]);
    }
    if (e.key === "ArrowDown") {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : history[idx]);
    }
  }

  const COLOR: Record<string, string> = {
    cmd: "text-cyan-300",
    out: "text-emerald-300",
    err: "text-rose-400",
    info: "text-slate-500",
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-black/20">
        <Terminal size={12} className="text-cyan-400" />
        <span className="text-xs font-semibold text-slate-300">Agent Terminal — {hostname}</span>
        <span className="ml-auto text-[10px] text-yellow-500/70 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
          Async — results on next agent heartbeat
        </span>
      </div>
      <div className="h-56 overflow-y-auto p-4 space-y-0.5 font-mono text-xs bg-black/40">
        {lines.map((l, i) => (
          <div key={i} className={COLOR[l.type]}>{l.text}</div>
        ))}
        {sending && <div className="text-slate-500 animate-pulse">Sending…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-white/5 bg-black/30">
        <span className="text-cyan-400 font-mono text-xs">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter command…"
          className="flex-1 bg-transparent font-mono text-xs text-white placeholder-slate-600 focus:outline-none"
          autoFocus
        />
        <button
          onClick={submit}
          disabled={sending || !input.trim()}
          className="flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-400/20 px-3 py-1 text-[10px] text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40"
        >
          <Send size={10} /> Send
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();

  const [device, setDevice] = useState<Device | null>(null);
  const [resources, setResources] = useState<Resources | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [tab, setTab] = useState<"overview" | "terminal" | "commands" | "scans">("overview");

  async function load() {
    if (!deviceId) return;
    setLoading(true);
    try {
      const [devRes, resRes, cmdRes, scanRes] = await Promise.all([
        fetch(`${API}/v1/shield/devices`).then((r) => r.json()),
        fetch(`${API}/v1/devices/${deviceId}/resources`).then((r) => r.json()).catch(() => null),
        fetch(`${API}/v1/devices/${deviceId}/command`).then((r) => r.json()).catch(() => ({ commands: [] })),
        fetch(`${API}/v1/devices/${deviceId}/scans`).then((r) => r.json()).catch(() => ({ scans: [] })),
      ]);
      const found = (devRes as Device[]).find((d) => d.device_id === deviceId) || null;
      setDevice(found);
      setResources(resRes);
      setCommands(cmdRes?.commands || []);
      setScans(scanRes?.scans || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [deviceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Loading device…
      </div>
    );
  }

  if (!device) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="glass rounded-2xl p-8 text-center text-slate-500">Device not found</div>
      </div>
    );
  }

  const Icon = TYPE_ICON[device.type] ?? Monitor;
  const st = STATUS_STYLE[device.status] ?? STATUS_STYLE.offline;
  const installCmd = `curl -o desktop-agent.py https://api.itechsmart.dev/v1/devices/agent/download && python3 desktop-agent.py --token ${device.device_id}`;
  const discoverCmd = `python3 desktop-agent.py --discover`;

  return (
    <div className="space-y-5">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-white transition-colors">
          <ArrowLeft size={12} /> Back
        </button>
        <ChevronRight size={10} />
        <span className="text-slate-300 font-medium">{device.hostname}</span>
      </div>

      {/* header card */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-400/20">
                <Icon size={24} className="text-cyan-400" />
              </div>
              <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${st.dot}`} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{device.hostname}</h1>
              <div className="text-xs text-slate-500 capitalize mt-0.5">{device.type.replace("-", " ")} · Shield v{device.shield_version}</div>
              {device.agent_name && (
                <div className="text-[10px] text-slate-600 mt-0.5">{device.agent_name}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white">
              <RefreshCw size={11} /> Refresh
            </button>
            <span className={`text-[10px] font-semibold px-3 py-1 rounded-full border ${st.badge} capitalize`}>
              {device.status}
            </span>
          </div>
        </div>

        {/* meta row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "IP Address", value: device.ip_address || "—" },
            { label: "MAC Address", value: device.mac_address || "—" },
            { label: "Last Seen", value: timeSince(device.last_seen) },
            { label: "Threats Blocked", value: device.threats_blocked.toLocaleString(), highlight: device.threats_blocked > 0 },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="bg-white/3 rounded-xl px-3 py-2">
              <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
              <div className={`text-sm font-mono font-semibold ${highlight ? "text-rose-400" : "text-slate-200"}`}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* status row */}
        <div className="mt-3 flex items-center gap-3">
          {device.status === "protected" ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <CheckCircle2 size={12} /> Shield active — this device is monitored
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-yellow-400 text-xs">
              <AlertTriangle size={12} /> Awaiting shield agent — run install command below
            </div>
          )}
          {device.metadata?.platform && (
            <div className="ml-auto text-[10px] text-slate-500 bg-white/3 px-2 py-0.5 rounded-full">
              {String(device.metadata.platform)}
            </div>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-white/5">
        {(["overview", "terminal", "commands", "scans"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "terminal" ? "Terminal" : t === "commands" ? `Commands (${commands.length})` : t === "scans" ? `Scans (${scans.length})` : "Overview"}
          </button>
        ))}
      </div>

      {/* ── Overview tab ──────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* system resources */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Activity size={14} className="text-cyan-400" /> System Resources
              {resources?.live && (
                <span className="ml-auto text-[10px] text-emerald-400 font-normal">● Live</span>
              )}
            </div>
            {resources?.live ? (
              <div className="space-y-3">
                <MiniBar
                  label="CPU"
                  pct={resources.cpu_percent ?? 0}
                  color={(resources.cpu_percent ?? 0) > 80 ? "bg-rose-400" : "bg-cyan-400"}
                />
                <MiniBar
                  label="Memory"
                  pct={resources.memory?.percent ?? 0}
                  sub={`${resources.memory?.used_gb}GB / ${resources.memory?.total_gb}GB`}
                  color={(resources.memory?.percent ?? 0) > 80 ? "bg-orange-400" : "bg-violet-400"}
                />
                <MiniBar
                  label="Disk"
                  pct={resources.disk?.percent ?? 0}
                  sub={`${resources.disk?.used_gb}GB / ${resources.disk?.total_gb}GB`}
                  color="bg-emerald-400"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Uptime</span>
                  <span className="text-slate-300">{resources.uptime_hours?.toFixed(1)}h</span>
                </div>
                {resources.network && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Network size={10} /> Network I/O</span>
                    <span className="text-slate-300 font-mono">↑{resources.network.bytes_sent_mb.toFixed(0)}MB ↓{resources.network.bytes_recv_mb.toFixed(0)}MB</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 space-y-2">
                <p>{resources?.note || "Live resources available when Shield agent is running."}</p>
                {resources?.platform && <p>Platform: <span className="text-slate-300">{resources.platform}</span></p>}
              </div>
            )}
          </div>

          {/* quick actions */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap size={14} className="text-yellow-400" /> Quick Actions
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setTab("terminal")}
                className="w-full flex items-center gap-3 rounded-xl bg-cyan-500/5 border border-cyan-400/15 hover:border-cyan-400/30 px-4 py-3 text-left transition-all"
              >
                <Terminal size={16} className="text-cyan-400 shrink-0" />
                <div>
                  <div className="text-sm text-white font-medium">Open Terminal</div>
                  <div className="text-[10px] text-slate-500">Send commands via agent queue</div>
                </div>
                <ChevronRight size={14} className="text-slate-600 ml-auto" />
              </button>
              <button
                onClick={async () => {
                  await fetch(`${API}/v1/devices/${device.device_id}/command`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ command: "pulse-scan" }),
                  });
                  setTab("commands");
                }}
                className="w-full flex items-center gap-3 rounded-xl bg-violet-500/5 border border-violet-400/15 hover:border-violet-400/30 px-4 py-3 text-left transition-all"
              >
                <Scan size={16} className="text-violet-400 shrink-0" />
                <div>
                  <div className="text-sm text-white font-medium">Run Pulse Scan</div>
                  <div className="text-[10px] text-slate-500">Full security + health scan</div>
                </div>
                <ChevronRight size={14} className="text-slate-600 ml-auto" />
              </button>
              <button
                onClick={async () => {
                  await fetch(`${API}/v1/devices/${device.device_id}/command`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ command: "get-status" }),
                  });
                  setTab("commands");
                }}
                className="w-full flex items-center gap-3 rounded-xl bg-emerald-500/5 border border-emerald-400/15 hover:border-emerald-400/30 px-4 py-3 text-left transition-all"
              >
                <Shield size={16} className="text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm text-white font-medium">Get Status</div>
                  <div className="text-[10px] text-slate-500">Request agent status report</div>
                </div>
                <ChevronRight size={14} className="text-slate-600 ml-auto" />
              </button>
            </div>
          </div>

          {/* install info */}
          <div className="glass rounded-2xl p-5 space-y-3 lg:col-span-2">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <Package size={14} className="text-slate-400" /> Agent Installation
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-black/30 rounded-xl px-4 py-2.5">
                <span className="text-[10px] text-slate-500 w-14 shrink-0">Install</span>
                <code className="flex-1 font-mono text-[11px] text-sky-300 break-all">{installCmd}</code>
                <CopyButton text={installCmd} />
              </div>
              <div className="flex items-center gap-2 bg-black/30 rounded-xl px-4 py-2.5">
                <span className="text-[10px] text-slate-500 w-14 shrink-0">Discover</span>
                <code className="flex-1 font-mono text-[11px] text-violet-300">{discoverCmd}</code>
                <CopyButton text={discoverCmd} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Terminal tab ──────────────────────────────────────────────────── */}
      {tab === "terminal" && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500 bg-yellow-500/5 border border-yellow-500/15 rounded-xl px-4 py-2.5">
            Commands are queued and executed by the Shield agent on its next heartbeat (default 60s). For real-time SSH access, use the Terminal page with an SSH session.
          </div>
          <DeviceTerminal deviceId={device.device_id} hostname={device.hostname} />
        </div>
      )}

      {/* ── Commands tab ─────────────────────────────────────────────────── */}
      {tab === "commands" && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold text-white">Command History</div>
          {commands.length === 0 ? (
            <div className="py-6 text-center text-slate-600 text-xs">No commands sent yet</div>
          ) : (
            <div className="space-y-2">
              {commands.map((c) => (
                <div key={c.cmd_id} className="flex items-center gap-3 bg-black/20 rounded-xl px-4 py-2.5">
                  <code className="flex-1 font-mono text-xs text-cyan-300">{c.command}</code>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    c.status === "done" ? "text-emerald-300 border-emerald-500/25 bg-emerald-500/10"
                    : "text-yellow-300 border-yellow-500/25 bg-yellow-500/10"
                  }`}>{c.status}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{new Date(c.queued_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Scans tab ────────────────────────────────────────────────────── */}
      {tab === "scans" && (
        <div className="space-y-3">
          {scans.length === 0 ? (
            <div className="glass rounded-2xl p-5 py-8 text-center space-y-2">
              <Scan size={24} className="text-slate-700 mx-auto" />
              <div className="text-slate-500 text-xs">No scans yet</div>
              <div className="text-[10px] text-slate-600 font-mono">Queue a pulse-scan from Quick Actions or Terminal</div>
            </div>
          ) : (
            scans.map((s) => {
              const isPulse = !s.scan_type || s.scan_type === "pulse-scan";
              const sm = s.summary;
              return (
                <div key={s.scan_id} className="glass rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scan size={13} className={isPulse ? "text-cyan-400" : "text-violet-400"} />
                      <span className="text-sm font-semibold text-white capitalize">
                        {isPulse ? "Pulse Scan" : (s.scan_type || "Network Discovery")}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">{new Date(s.scanned_at).toLocaleString()}</span>
                  </div>
                  {isPulse && sm ? (
                    <div className="space-y-3">
                      {/* Stat grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: "Processes", value: sm.process_count ?? "—", color: "text-cyan-300" },
                          { label: "Services", value: sm.running_services ?? "—", color: "text-violet-300" },
                          { label: "TCP Connections", value: sm.open_ports ?? "—", color: "text-sky-300" },
                          { label: "AV Status", value: sm.av_enabled === true ? "Enabled" : sm.av_enabled === false ? "Disabled" : "—", color: sm.av_enabled ? "text-emerald-400" : "text-rose-400" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-black/30 rounded-xl p-3 text-center">
                            <div className={`text-lg font-bold font-mono ${color}`}>{String(value)}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                      {/* Uptime */}
                      {sm.uptime_seconds != null && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <Activity size={10} className="text-emerald-400" />
                          Uptime: <span className="text-white font-mono">
                            {Math.floor(sm.uptime_seconds / 86400)}d {Math.floor((sm.uptime_seconds % 86400) / 3600)}h {Math.floor((sm.uptime_seconds % 3600) / 60)}m
                          </span>
                          <span className="ml-2">Platform: <span className="text-white">{sm.platform}</span></span>
                        </div>
                      )}
                      {/* Recent patches */}
                      {sm.last_patches && sm.last_patches.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Recent Patches</div>
                          {sm.last_patches.slice(0, 3).map((p, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] bg-black/20 rounded-lg px-3 py-1.5">
                              <Shield size={9} className="text-emerald-400 shrink-0" />
                              <span className="text-emerald-300 font-mono font-semibold">{p.HotFixID}</span>
                              <span className="text-slate-500">{p.Description}</span>
                              <span className="ml-auto text-slate-600">{p.InstalledOn?.DateTime?.split(" ").slice(0,3).join(" ") ?? ""}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="font-mono">{s.subnet || "—"}</span>
                      <span className="text-violet-300 font-semibold">{(s.host_count ?? s.total ?? 0)} hosts</span>
                      {s.scanner && <span className="text-slate-600">{s.scanner}</span>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
