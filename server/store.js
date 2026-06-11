// Tiny JSON-file data store for the MSP business suite.
// Persists to server/data/db.json so CRUD survives restarts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const seed = {
  clients: [
    { id: "c1", name: "Northwind Logistics", contact: "Dana Reyes", email: "dana@northwind.example", plan: "Managed Pro", mrr: 4200, devices: 86, sla: "99.9%", health: 98, since: "2023-04-12" },
    { id: "c2", name: "Bayview Dental Group", contact: "Marcus Lee", email: "mlee@bayviewdental.example", plan: "Managed Core", mrr: 1850, devices: 34, sla: "99.5%", health: 92, since: "2024-01-08" },
    { id: "c3", name: "Crestline Realty", contact: "Priya Nair", email: "priya@crestline.example", plan: "Co-Managed", mrr: 2600, devices: 51, sla: "99.5%", health: 88, since: "2023-09-30" },
    { id: "c4", name: "Atlas Manufacturing", contact: "Tom Garber", email: "tgarber@atlasmfg.example", plan: "Managed Pro", mrr: 6900, devices: 142, sla: "99.99%", health: 95, since: "2022-11-02" },
    { id: "c5", name: "Lumen Law Partners", contact: "Sofia Brandt", email: "sbrandt@lumenlaw.example", plan: "Managed Core", mrr: 2150, devices: 28, sla: "99.5%", health: 99, since: "2024-06-17" },
  ],
  tickets: [
    { id: "t1", subject: "VPN drops on Atlas plant floor APs", client: "Atlas Manufacturing", priority: "high", status: "open", assignee: "AI Triage → L2", created: "2026-06-10T14:22:00Z", sla_due: "2026-06-11T14:22:00Z" },
    { id: "t2", subject: "O365 mailbox migration batch 3", client: "Bayview Dental Group", priority: "medium", status: "in_progress", assignee: "Jordan", created: "2026-06-09T09:10:00Z", sla_due: "2026-06-12T09:10:00Z" },
    { id: "t3", subject: "Ransomware canary tripped — isolated, verify", client: "Crestline Realty", priority: "critical", status: "open", assignee: "Hermes SEMI_AUTO", created: "2026-06-11T03:47:00Z", sla_due: "2026-06-11T07:47:00Z" },
    { id: "t4", subject: "New hire onboarding x3 (laptops + M365)", client: "Lumen Law Partners", priority: "low", status: "open", assignee: "Unassigned", created: "2026-06-10T16:05:00Z", sla_due: "2026-06-13T16:05:00Z" },
    { id: "t5", subject: "Backup job failing on NAS-02", client: "Northwind Logistics", priority: "high", status: "in_progress", assignee: "Alex", created: "2026-06-10T07:30:00Z", sla_due: "2026-06-11T07:30:00Z" },
    { id: "t6", subject: "Quarterly patch compliance report", client: "Atlas Manufacturing", priority: "medium", status: "resolved", assignee: "AI Reports", created: "2026-06-08T11:00:00Z", sla_due: "2026-06-10T11:00:00Z" },
  ],
  invoices: [
    { id: "INV-2041", client: "Atlas Manufacturing", amount: 6900, status: "paid", issued: "2026-06-01", due: "2026-06-15" },
    { id: "INV-2042", client: "Northwind Logistics", amount: 4200, status: "paid", issued: "2026-06-01", due: "2026-06-15" },
    { id: "INV-2043", client: "Crestline Realty", amount: 2600, status: "sent", issued: "2026-06-01", due: "2026-06-15" },
    { id: "INV-2044", client: "Bayview Dental Group", amount: 1850, status: "sent", issued: "2026-06-01", due: "2026-06-15" },
    { id: "INV-2045", client: "Lumen Law Partners", amount: 2150, status: "overdue", issued: "2026-05-01", due: "2026-05-15" },
  ],
  activity: [
    { id: "a1", ts: "2026-06-11T05:12:00Z", kind: "ai", text: "Hermes SEMI_AUTO isolated endpoint CRST-WS-014 after canary trip; awaiting human verify." },
    { id: "a2", ts: "2026-06-11T04:50:00Z", kind: "infra", text: "Cloudflare tunnel 3525b90f health check OK (4 connectors)." },
    { id: "a3", ts: "2026-06-10T22:31:00Z", kind: "ticket", text: "AI Triage routed Atlas VPN ticket to L2 with packet-capture playbook attached." },
    { id: "a4", ts: "2026-06-10T18:02:00Z", kind: "billing", text: "June invoices generated: $17,700 across 5 clients." },
    { id: "a5", ts: "2026-06-10T12:44:00Z", kind: "ai", text: "Nemotron completed log-anomaly sweep: 0 criticals, 3 warnings filed." },
  ],
};

let db = null;

function load() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    db = structuredClone(seed);
    save();
  }
  return db;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function list(collection) {
  return load()[collection] || [];
}

export function create(collection, item) {
  load();
  const id = item.id || `${collection.slice(0, 1)}${Date.now().toString(36)}`;
  const rec = { ...item, id };
  db[collection] = [rec, ...(db[collection] || [])];
  save();
  return rec;
}

export function update(collection, id, patch) {
  load();
  const arr = db[collection] || [];
  const i = arr.findIndex((r) => r.id === id);
  if (i === -1) return null;
  arr[i] = { ...arr[i], ...patch, id };
  save();
  return arr[i];
}

export function remove(collection, id) {
  load();
  const before = (db[collection] || []).length;
  db[collection] = (db[collection] || []).filter((r) => r.id !== id);
  save();
  return db[collection].length < before;
}

export function logActivity(kind, text) {
  return create("activity", { kind, text, ts: new Date().toISOString() });
}
