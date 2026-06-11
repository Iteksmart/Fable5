// iTechSmart Mission Control — backend.
// Express API + WebSocket terminal bridge + static hosting of the built UI.
import express from "express";
import cors from "cors";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import { handleChat, PROVIDERS } from "./ai.js";
import { providerKeyStatus, reloadSecrets, getSecret } from "./secrets.js";
import * as store from "./store.js";
import { getMetrics, probeServices, tunnelStatus } from "./metrics.js";
import { attachTerminal, ptyAvailable } from "./term.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8443;
const HOST = process.env.HOST || "127.0.0.1";

// Optional shared-secret auth (defense in depth behind Cloudflare Access).
// Set MC_AUTH_TOKEN in env/.secrets/vault to require it on /api/* and /ws/term.
const AUTH_TOKEN = () => getSecret("MC_AUTH_TOKEN");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function authorized(req) {
  const token = AUTH_TOKEN();
  if (!token) return true;
  const h = req.headers?.authorization || "";
  return h === `Bearer ${token}`;
}

app.use("/api", (req, res, next) => {
  if (req.path === "/health") return next();
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  next();
});

// ---------- system ----------
app.get("/api/health", (req, res) =>
  res.json({ ok: true, ts: Date.now(), auth: !!AUTH_TOKEN(), version: 1 })
);
app.get("/api/metrics", (req, res) => res.json(getMetrics()));
app.get("/api/services", async (req, res) => res.json(await probeServices()));
app.get("/api/tunnel", async (req, res) => res.json(await tunnelStatus()));

app.get("/api/status/live", async (req, res) => {
  try {
    const r = await fetch("https://api.itechsmart.dev/v1/status/live", {
      signal: AbortSignal.timeout(5000),
    });
    res.status(r.status).send(await r.text());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Production audit: verifies every subsystem and reports pass/fail.
app.get("/api/selftest", async (req, res) => {
  const dist = path.join(__dirname, "..", "dist", "index.html");
  const checks = {
    node: { ok: Number(process.versions.node.split(".")[0]) >= 18, info: `v${process.versions.node}` },
    ui_build: { ok: fs.existsSync(dist), info: dist },
    pty: { ok: ptyAvailable(), info: ptyAvailable() ? "node-pty active" : "pipe fallback (install build-essential, reinstall)" },
    data_store: { ok: true, info: `${store.list("clients").length} clients, ${store.list("tickets").length} tickets` },
    ai_keys: providerKeyStatus(),
    auth_token: { ok: true, info: AUTH_TOKEN() ? "enabled" : "disabled (relying on Cloudflare Access)" },
  };
  try {
    checks.tunnel = await tunnelStatus();
  } catch (e) {
    checks.tunnel = { active: false, error: e.message };
  }
  checks.services = await probeServices();
  const hardFail = !checks.node.ok || !checks.ui_build.ok;
  res.status(hardFail ? 500 : 200).json({ ok: !hardFail, checks });
});

// ---------- AI orchestration ----------
app.get("/api/ai/providers", (req, res) =>
  res.json({ providers: PROVIDERS, keys: providerKeyStatus() })
);
app.post("/api/ai/chat", handleChat);
app.post("/api/ai/reload-secrets", (req, res) => {
  reloadSecrets();
  res.json({ keys: providerKeyStatus() });
});

// ---------- business CRUD ----------
const COLLECTIONS = ["clients", "tickets", "invoices", "activity"];
for (const col of COLLECTIONS) {
  app.get(`/api/${col}`, (req, res) => res.json(store.list(col)));
  app.post(`/api/${col}`, (req, res) => {
    const rec = store.create(col, req.body || {});
    if (col !== "activity") store.logActivity(col.slice(0, -1), `Created ${col.slice(0, -1)}: ${rec.name || rec.subject || rec.id}`);
    res.status(201).json(rec);
  });
  app.patch(`/api/${col}/:id`, (req, res) => {
    const rec = store.update(col, req.params.id, req.body || {});
    if (!rec) return res.status(404).json({ error: "not found" });
    res.json(rec);
  });
  app.delete(`/api/${col}/:id`, (req, res) => {
    res.json({ deleted: store.remove(col, req.params.id) });
  });
}

// ---------- static UI (production) ----------
const dist = path.join(__dirname, "..", "dist");
app.use(express.static(dist));
app.get(/^(?!\/api|\/ws).*/, (req, res, next) => {
  res.sendFile(path.join(dist, "index.html"), (err) => err && next());
});

// last-resort error handler so one bad request never kills the service
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[api]", err);
  if (!res.headersSent) res.status(500).json({ error: "internal error" });
});

// ---------- websockets ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname !== "/ws/term") return socket.destroy();
  const token = AUTH_TOKEN();
  if (token && url.searchParams.get("token") !== token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => attachTerminal(ws, url.searchParams));
});

server.listen(PORT, HOST, () => {
  console.log(`⚡ iTechSmart Mission Control API on http://${HOST}:${PORT}`);
  console.log(`   auth token: ${AUTH_TOKEN() ? "ENABLED" : "disabled"} · pty: ${ptyAvailable() ? "yes" : "pipe fallback"}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`\n[shutdown] ${sig} received`);
    wss.clients.forEach((c) => c.close());
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
process.on("uncaughtException", (e) => console.error("[uncaught]", e));
process.on("unhandledRejection", (e) => console.error("[unhandled]", e));
