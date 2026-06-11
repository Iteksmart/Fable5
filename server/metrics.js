// Live host metrics + service health probes.
import os from "node:os";
import { execFile } from "node:child_process";

const history = []; // rolling 60-point cpu/mem/net history
let lastCpu = cpuTimes();

function cpuTimes() {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const c of cpus) {
    for (const k of Object.keys(c.times)) total += c.times[k];
    idle += c.times.idle;
  }
  return { idle, total };
}

function sample() {
  const now = cpuTimes();
  const dTotal = now.total - lastCpu.total;
  const dIdle = now.idle - lastCpu.idle;
  lastCpu = now;
  const cpu = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 1000) / 10 : 0;
  const mem = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 1000) / 10;
  const load = os.loadavg()[0];
  history.push({ t: Date.now(), cpu, mem, load: Math.round(load * 100) / 100 });
  if (history.length > 60) history.shift();
}
setInterval(sample, 5000);
sample();

export function getMetrics() {
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || "unknown",
    uptime: os.uptime(),
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    loadavg: os.loadavg(),
    history,
    current: history[history.length - 1],
  };
}

// Services probed for the NOC board. Override with SERVICES_JSON env
// (JSON array of {id,name,url,internal}).
const DEFAULT_SERVICES = [
  { id: "api", name: "iTechSmart API", url: "https://api.itechsmart.dev/v1/status/live" },
  { id: "dash", name: "Legacy Dashboard", url: "http://127.0.0.1:8210", internal: true },
  { id: "noc", name: "NOC Service", url: "http://127.0.0.1:8210/noc", internal: true },
  { id: "hermes", name: "Hermes (NGC)", url: "http://localhost:8444/api/health", internal: true },
];

function services() {
  try {
    if (process.env.SERVICES_JSON) return JSON.parse(process.env.SERVICES_JSON);
  } catch { /* fall through to defaults */ }
  return DEFAULT_SERVICES;
}

export async function probeServices() {
  const results = await Promise.all(
    services().map(async (s) => {
      const started = Date.now();
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(s.url, { signal: ctrl.signal });
        clearTimeout(t);
        return { ...s, up: r.ok || r.status < 500, status: r.status, ms: Date.now() - started };
      } catch (e) {
        return { ...s, up: false, status: 0, ms: Date.now() - started, error: e.message };
      }
    })
  );
  return results;
}

// Cloudflare tunnel status via systemd (works on the OVH host).
export function tunnelStatus() {
  return new Promise((resolve) => {
    execFile("systemctl", ["is-active", "cloudflared"], (err, stdout) => {
      const state = (stdout || "").trim();
      resolve({
        id: process.env.CF_TUNNEL_ID || "3525b90f",
        service: "cloudflared",
        active: !err && state === "active",
        state: state || "unknown",
      });
    });
  });
}
