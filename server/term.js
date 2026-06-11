// WebSocket terminal bridge.
// Modes (ws://host/ws/term?mode=...):
//   local — PTY shell on the box running this server (when deployed on the
//           OVH server this IS the server shell / "VM shell").
//   ssh   — spawns `ssh ssh.itechsmart.dev` in a PTY, so the system ssh
//           config + cloudflared Zero Trust ProxyCommand handle transport.
//           Port 22 on the raw IP is never touched.
// Client → server messages: {type:"input",data} | {type:"resize",cols,rows}
// Server → client: raw utf8 output frames, plus {type:"exit"} JSON frame.
import { spawn } from "node:child_process";

let pty = null;
try {
  pty = (await import("node-pty")).default ?? (await import("node-pty"));
} catch {
  console.warn("[term] node-pty unavailable — falling back to pipe mode (no TTY niceties)");
}

const SSH_TARGET = process.env.SSH_TARGET || "ssh.itechsmart.dev";
const SSH_USER = process.env.SSH_USER || "";
const SHELL = process.env.SHELL_BIN || process.env.SHELL || "bash";

export function attachTerminal(ws, query) {
  const mode = query.get("mode") || "local";
  const cols = Number(query.get("cols")) || 120;
  const rows = Number(query.get("rows")) || 32;

  let cmd, args;
  if (mode === "ssh") {
    cmd = "ssh";
    args = ["-tt", SSH_USER ? `${SSH_USER}@${SSH_TARGET}` : SSH_TARGET];
  } else {
    cmd = SHELL;
    args = [];
  }

  if (pty) {
    const proc = pty.spawn(cmd, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: process.env.HOME,
      env: { ...process.env, TERM: "xterm-256color" },
    });
    proc.onData((d) => ws.readyState === ws.OPEN && ws.send(d));
    proc.onExit(({ exitCode }) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "exit", code: exitCode }));
        ws.close();
      }
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "input") proc.write(msg.data);
        else if (msg.type === "resize") proc.resize(msg.cols, msg.rows);
      } catch {
        proc.write(raw.toString());
      }
    });
    ws.on("close", () => proc.kill());
  } else {
    // Degraded pipe fallback — still usable for commands, no real TTY.
    const proc = spawn(cmd, args, { env: { ...process.env, TERM: "dumb" } });
    proc.stdout.on("data", (d) => ws.readyState === ws.OPEN && ws.send(d.toString()));
    proc.stderr.on("data", (d) => ws.readyState === ws.OPEN && ws.send(d.toString()));
    proc.on("exit", (code) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "exit", code }));
        ws.close();
      }
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "input") proc.stdin.write(msg.data);
      } catch {
        proc.stdin.write(raw.toString());
      }
    });
    ws.on("close", () => proc.kill());
  }
}
