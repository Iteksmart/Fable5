import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { motion } from "framer-motion";
import {
  Cloud,
  MonitorDot,
  Plug,
  PlugZap,
  RotateCcw,
  Server,
  TerminalSquare,
} from "lucide-react";
import clsx from "clsx";
import { GlassCard, NeonButton } from "../components/ui";
import { getToken } from "../lib/api";

type Mode = "ssh" | "local";
type ConnState = "idle" | "connecting" | "connected" | "closed";

const THEME = {
  background: "#00000000",
  foreground: "#d6e2f0",
  cursor: "#22d3ee",
  cursorAccent: "#0b1020",
  selectionBackground: "rgba(34,211,238,0.25)",
  black: "#1e293b",
  red: "#fb7185",
  green: "#34d399",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e2e8f0",
  brightBlack: "#475569",
  brightRed: "#fda4af",
  brightGreen: "#6ee7b7",
  brightYellow: "#fde68a",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#f8fafc",
};

const SNIPPETS: { label: string; cmd: string }[] = [
  { label: "claude", cmd: "claude\n" },
  { label: "status live", cmd: "curl -s https://api.itechsmart.dev/v1/status/live | jq .\n" },
  { label: "tunnel health", cmd: "systemctl status cloudflared --no-pager | head -12\n" },
  { label: "docker ps", cmd: "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'\n" },
  { label: "hermes ping", cmd: "curl -s http://localhost:8089/health\n" },
  { label: "noc", cmd: "curl -s http://127.0.0.1:8210/noc | head -40\n" },
  { label: "disk", cmd: "df -h /\n" },
  { label: "top procs", cmd: "ps aux --sort=-%cpu | head -10\n" },
];

export default function TerminalPage() {
  const [params, setParams] = useSearchParams();
  const mode = (params.get("mode") as Mode) || "ssh";
  const [state, setState] = useState<ConnState>("idle");
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    wsRef.current?.close();
    termRef.current?.dispose();
    if (!hostRef.current) return;

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      allowTransparency: true,
      theme: THEME,
      scrollback: 8000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    setState("connecting");
    term.writeln(`\x1b[36m⚡ iTechSmart Mission Control — ${mode === "ssh" ? "SSH via Cloudflare Zero Trust (ssh.itechsmart.dev)" : "local VM shell"}\x1b[0m`);
    term.writeln("\x1b[90mestablishing session…\x1b[0m\r\n");

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const tok = getToken();
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/term?mode=${mode}&cols=${term.cols}&rows=${term.rows}${tok ? `&token=${encodeURIComponent(tok)}` : ""}`
    );
    wsRef.current = ws;

    ws.onopen = () => setState("connected");
    ws.onmessage = (ev) => {
      const data = typeof ev.data === "string" ? ev.data : "";
      // exit frames come through as JSON
      if (data.startsWith('{"type":"exit"')) {
        term.writeln("\r\n\x1b[90m[session ended]\x1b[0m");
        setState("closed");
        return;
      }
      term.write(data);
    };
    ws.onclose = () => setState((s) => (s === "connected" || s === "connecting" ? "closed" : s));
    ws.onerror = () => setState("closed");

    term.onData((d) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "input", data: d }));
    });
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "resize", cols, rows }));
    });

    const onWinResize = () => fit.fit();
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, [mode]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      wsRef.current?.close();
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, [connect]);

  const sendSnippet = (cmd: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "input", data: cmd }));
      termRef.current?.focus();
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
      <GlassCard hover={false} className="shrink-0 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <TerminalSquare size={18} className="text-cyan-400" />
          <span className="text-sm font-bold text-white">Remote Console</span>

          <div className="glass flex rounded-xl p-1">
            {(
              [
                ["ssh", "OVH via CF Tunnel", Cloud],
                ["local", "VM Shell", MonitorDot],
              ] as [Mode, string, typeof Cloud][]
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                onClick={() => setParams({ mode: m })}
                className={clsx(
                  "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  mode === m ? "text-white" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {mode === m && (
                  <motion.span
                    layoutId="term-mode"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/25 to-purple-600/20 ring-1 ring-cyan-400/30"
                  />
                )}
                <Icon size={13} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span
              className={clsx(
                "flex items-center gap-1.5 text-xs font-medium",
                state === "connected" && "text-emerald-300",
                state === "connecting" && "text-amber-300",
                (state === "closed" || state === "idle") && "text-slate-500"
              )}
            >
              {state === "connected" ? <PlugZap size={14} /> : <Plug size={14} />}
              {state}
            </span>
            <NeonButton variant="ghost" onClick={connect}>
              <RotateCcw size={13} /> Reconnect
            </NeonButton>
          </div>
        </div>

        {/* quick commands */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SNIPPETS.map((s) => (
            <button
              key={s.label}
              onClick={() => sendSnippet(s.cmd)}
              disabled={state !== "connected"}
              className="glass rounded-lg px-2.5 py-1 font-mono text-[11px] text-cyan-300/90 transition-all hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-30"
            >
              {s.label}
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard hover={false} className="relative min-h-0 flex-1 overflow-hidden">
        {/* terminal chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-rose-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <span className="ml-3 flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <Server size={11} />
            {mode === "ssh" ? "ubuntu@ovh · ssh.itechsmart.dev · tunnel 3525b90f" : "mission-control host shell"}
          </span>
        </div>
        <div ref={hostRef} className="h-[calc(100%-41px)] w-full bg-ink-950/70 p-3" />
        {state === "closed" && (
          <div className="absolute inset-0 top-[41px] flex items-center justify-center bg-ink-950/60 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-300">Session closed</div>
              <div className="mt-3">
                <NeonButton onClick={connect}>
                  <RotateCcw size={14} /> Reconnect
                </NeonButton>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
