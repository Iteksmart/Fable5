#!/usr/bin/env node
// Production audit for iTechSmart Mission Control. Run ON the server:
//   npm run doctor            (audits a service expected on PORT, default 8443)
// Exits non-zero if any hard requirement fails.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getSecret, providerKeyStatus } from "./secrets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8443;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = getSecret("MC_AUTH_TOKEN");
const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

const results = [];
let hardFailure = false;

function report(name, ok, info, { hard = false, warnOnly = false } = {}) {
  const icon = ok ? "✅" : warnOnly ? "⚠️ " : "❌";
  if (!ok && hard) hardFailure = true;
  results.push({ name, ok, info });
  console.log(`${icon} ${name.padEnd(34)} ${info ?? ""}`);
}

function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

async function get(url, opts = {}) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: authHeaders, ...opts });
    return { status: r.status, text: await r.text() };
  } catch (e) {
    return { status: 0, text: e.message };
  }
}

console.log(`\n🩺 Mission Control doctor — auditing ${BASE}\n`);

// --- environment ---
const nodeMajor = Number(process.versions.node.split(".")[0]);
report("Node.js >= 18", nodeMajor >= 18, `v${process.versions.node}`, { hard: true });

const dist = path.join(__dirname, "..", "dist", "index.html");
report("UI production build", fs.existsSync(dist), fs.existsSync(dist) ? dist : "missing — run: npm run build", { hard: true });

let ptyOk = false;
try {
  await import("node-pty");
  ptyOk = true;
} catch { /* reported below */ }
report("node-pty (real TTY)", ptyOk, ptyOk ? "native module loaded" : "pipe fallback — apt install build-essential python3 && npm rebuild node-pty", { warnOnly: true });

report("ssh client (for SSH mode)", !!sh("which", ["ssh"]), sh("which", ["ssh"]) ?? "openssh-client not installed", { warnOnly: true });

const cf = sh("systemctl", ["is-active", "cloudflared"]);
report("cloudflared systemd unit", cf === "active", cf ?? "systemctl unavailable", { warnOnly: true });

// --- secrets ---
const keys = providerKeyStatus();
const keyed = Object.entries(keys).filter(([, v]) => v).map(([k]) => k);
report("AI provider keys found", keyed.length > 0, keyed.join(", ") || "none — populate ~/.secrets or vault", { warnOnly: true });
report("MC_AUTH_TOKEN", true, TOKEN ? "enabled (good)" : "not set — ensure Cloudflare Access guards the hostname", { warnOnly: true });

// --- running service ---
const health = await get(`${BASE}/api/health`);
report("API /api/health", health.status === 200, health.status === 200 ? health.text : `HTTP ${health.status} ${health.text.slice(0, 80)} — is the service running? (npm start)`, { hard: true });

if (health.status === 200) {
  const spa = await get(`${BASE}/orchestrator`);
  report("SPA route /orchestrator", spa.status === 200 && spa.text.includes("<div id=\"root\">"), `HTTP ${spa.status}`, { hard: true });

  const provs = await get(`${BASE}/api/ai/providers`);
  report("AI providers endpoint", provs.status === 200, `HTTP ${provs.status}`, { hard: true });

  const metrics = await get(`${BASE}/api/metrics`);
  report("Metrics endpoint", metrics.status === 200, `HTTP ${metrics.status}`);

  // websocket terminal handshake
  const wsOk = await new Promise((resolve) => {
    import("ws").then(({ WebSocket }) => {
      const qs = TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : "";
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/term?mode=local&cols=80&rows=24${qs}`);
      let out = "";
      const timer = setTimeout(() => { ws.close(); resolve(false); }, 6000);
      ws.on("open", () => setTimeout(() => ws.send(JSON.stringify({ type: "input", data: "echo DOCTOR_$((40+2))\n" })), 300));
      ws.on("message", (d) => {
        out += d.toString();
        if (out.includes("DOCTOR_42")) { clearTimeout(timer); ws.close(); resolve(true); }
      });
      ws.on("error", () => { clearTimeout(timer); resolve(false); });
    });
  });
  report("WebSocket terminal round-trip", wsOk, wsOk ? "echo verified through PTY" : "no echo — check logs", { hard: true });
}

// --- adjacent services (informational) ---
for (const [name, url] of [
  ["Legacy dashboard :8210", "http://127.0.0.1:8210"],
  ["Hermes (NGC) :8444", "http://localhost:8444/api/health"],
]) {
  const r = await get(url);
  report(name, r.status > 0 && r.status < 500, r.status ? `HTTP ${r.status}` : r.text.slice(0, 60), { warnOnly: true });
}

console.log(`\n${hardFailure ? "❌ FAILED — fix the hard errors above before exposing this through the tunnel." : "✅ ALL HARD CHECKS PASSED — safe to route mission.itechsmart.dev → :" + PORT}\n`);
process.exit(hardFailure ? 1 : 0);
