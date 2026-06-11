// iTechSmart Mission Control — backend.
// Express API + WebSocket terminal bridge + static hosting of the built UI.
import express from "express";
import cors from "cors";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import { handleChat, PROVIDERS } from "./ai.js";
import { providerKeyStatus, reloadSecrets } from "./secrets.js";
import * as store from "./store.js";
import { getMetrics, probeServices, tunnelStatus } from "./metrics.js";
import { attachTerminal } from "./term.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8443;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---------- system ----------
app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));
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

// ---------- websockets ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/ws/term") {
    wss.handleUpgrade(req, socket, head, (ws) => attachTerminal(ws, url.searchParams));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`⚡ iTechSmart Mission Control API on http://127.0.0.1:${PORT}`);
});
