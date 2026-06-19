import { registerLeadsRoutes } from "./leads_routes.js";
// Sprint 7 live-data routes
import { execSync } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const APIGW = "http://172.18.0.1:8091";
const OPS   = "http://172.18.0.1:8210";
const LEDGER = "/opt/itechsmart/audit_ledger/ledger.json";
const SECRETS_DIR = os.homedir() + "/.secrets";
const BACKUPS_DIR = "/opt/itechsmart/backups";

async function jf(url, init = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(9000), ...init });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
  registerLeadsRoutes(app);
}
function stripeHdr(sk) { return { Authorization: `Basic ${Buffer.from(sk + ":").toString("base64")}` }; }

const certCache = { data: null, at: 0 };
const ledgerCache = { entries: null, total: 0, at: 0 };
function getLedger() {
  if (ledgerCache.entries && Date.now() - ledgerCache.at < 10000) return ledgerCache;
  try {
    const raw = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
    ledgerCache.entries = raw.entries || [];
    ledgerCache.total = raw.total_entries || ledgerCache.entries.length;
    ledgerCache.at = Date.now();
  } catch { ledgerCache.entries = []; ledgerCache.total = 0; }
  return ledgerCache;
  registerLeadsRoutes(app);
}

export function registerLiveRoutes(app, getSecret) {

  // M10 ProofLink Hero
  app.get("/api/prooflink/live", async (req, res) => {
    try {
      const status = await jf(`${APIGW}/v1/status`).catch(() => ({}));
      const pl = status.prooflink || {};
      const { entries: ledgerEntries } = getLedger();
      const last5 = ledgerEntries.slice(0, 5).map((e) => ({ hash: e.hash_sha256 ? e.hash_sha256.slice(0, 16) : "", category: e.category, ts: e.timestamp, actor: e.actor }));
      res.json({ total: pl.total_receipts ?? 0, chain_breaks: pl.chain_breaks ?? 0, action: pl.action_receipts ?? 0, last5 });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  app.get("/api/prooflink/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    let lastHash = "";
    const tick = () => {
      try {
        const { entries } = getLedger();
        const e = entries[entries.length - 1];
        if (e && e.hash_sha256 !== lastHash) {
          lastHash = e.hash_sha256;
          const _action = String(e.action || e.subject || "").slice(0, 500);
          res.write(`data: ${JSON.stringify({ hash: e.hash_sha256.slice(0, 16), category: e.category, ts: e.timestamp, actor: e.actor, action: _action })}\n\n`);
        }
      } catch {}
    };
    tick();
    const t = setInterval(tick, 5000);
    req.on("close", () => clearInterval(t));
  });

  // Agent Comms — threaded conversation view
  app.get("/api/comms/threads", (req, res) => {
    try {
      const { entries } = getLedger();
      const AGENT_PREFIXES = ["ag2:", "claude", "Claude", "a2a:", "hermes", "djuane", "system:break-it", "system:health"];
      const agentEntries = entries.filter(e =>
        e.actor && AGENT_PREFIXES.some(p => e.actor.startsWith(p)) &&
        e.action && !String(e.action).endsWith(": reported") &&
        !["graph_poll_complete","email_polling_complete","sla_check","token_refresh"].includes(e.category)
      );
      // Group by chain_id, fallback to timestamp bucket (5-min windows)
      const chains = {};
      for (const e of agentEntries) {
        const cid = e.chain_id || ("solo_" + (e.timestamp || "").slice(0, 15).replace(/[^0-9T]/g, "").slice(0, 12) + "_" + (e.actor || "").replace(/[^a-z0-9]/gi, "_").slice(0, 20));
        if (!chains[cid]) chains[cid] = { chain_id: cid, messages: [], actors: new Set(), last_ts: "" };
        chains[cid].messages.push(e);
        chains[cid].actors.add(e.actor);
        if (!chains[cid].last_ts || e.timestamp > chains[cid].last_ts) chains[cid].last_ts = e.timestamp;
      }
      const threads = Object.values(chains)
        .sort((a, b) => b.last_ts.localeCompare(a.last_ts))
        .slice(0, 100)
        .map(ch => ({
          chain_id: ch.chain_id,
          actors: Array.from(ch.actors),
          message_count: ch.messages.length,
          last_ts: ch.last_ts,
          preview: String(ch.messages[ch.messages.length - 1]?.action || "").slice(0, 120),
          category: ch.messages[0]?.category || "unknown",
          is_ag2: ch.chain_id.startsWith("ag2-"),
        }));
      res.json({ threads, total: threads.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/comms/thread/:chainId", (req, res) => {
    try {
      const { entries } = getLedger();
      const { chainId } = req.params;
      let messages;
      if (chainId.startsWith("solo_")) {
        // Single-actor entries - find by actor+timestamp match
        const ts_prefix = chainId.replace("solo_","").slice(0,12);
        const actor_slug = chainId.split("_").slice(2).join("_");
        messages = entries.filter(e => {
          const ts = (e.timestamp || "").slice(0,15).replace(/[^0-9T]/g,"").slice(0,12);
          const as = (e.actor || "").replace(/[^a-z0-9]/gi,"_").slice(0,20);
          return ts === ts_prefix && as === actor_slug;
        });
      } else {
        messages = entries.filter(e => e.chain_id === chainId);
      }
      messages = messages.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
      res.json({
        chain_id: chainId,
        messages: messages.map(e => ({
          hash: e.hash_sha256 ? e.hash_sha256.slice(0, 16) : "",
          actor: e.actor,
          role: e.actor?.startsWith("ag2:") ? "agent" : e.actor?.startsWith("claude") ? "assistant" : "system",
          message: String(e.action || e.category || ""),
          category: e.category,
          ts: e.timestamp,
        }))
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/comms/feed", (req, res) => {
    try {
      const { entries } = getLedger();
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const actor = req.query.actor || "";
      const AGENT_PREFIXES = ["ag2:", "claude", "Claude", "a2a:", "hermes", "djuane", "system:"];
      let feed = entries.filter(e =>
        e.actor && AGENT_PREFIXES.some(p => e.actor.startsWith(p)) &&
        e.action &&
        !String(e.action).endsWith(": reported")
      );
      if (actor) feed = feed.filter(e => e.actor === actor);
      feed = feed.slice(-limit).reverse();
      res.json({ messages: feed.map(e => ({
        hash: e.hash_sha256 ? e.hash_sha256.slice(0,16) : "",
        actor: e.actor, category: e.category,
        message: String(e.action || "").slice(0, 500),
        ts: e.timestamp, chain_id: e.chain_id || null,
      })), total: feed.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // SIE (Security Intelligence Engine) proxy — /api/sie/* → :8220/api/*
  app.all("/api/sie/*", async (req, res) => {
    try {
      const siePath = req.url.replace("/api/sie", "/api");
      const target = "http://127.0.0.1:8220" + siePath;
      const init = { method: req.method, headers: { "content-type": "application/json" } };
      if (!["GET","DELETE","HEAD"].includes(req.method) && req.body) {
        init.body = JSON.stringify(req.body);
      }
      const upstream = await fetch(target, { signal: AbortSignal.timeout(30000) });
      const ct = upstream.headers.get("content-type") || "application/json";
      res.status(upstream.status);
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (ct.includes("text/event-stream")) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        upstream.body.pipe(res);
        req.on("close", () => upstream.body.destroy());
      } else {
        res.setHeader("content-type", ct);
        res.send(await upstream.text());
      }
    } catch (e) {
      if (!res.headersSent) res.status(502).json({ error: e.message });
    }
  });

  // M01 Revenue
  app.get("/api/revenue", async (req, res) => {
    const sk = getSecret("STRIPE_SECRET_KEY");
    if (!sk) return res.json({ unavailable: true, reason: "No Stripe key configured" });
    try {
      const [subs, invs] = await Promise.all([
        jf("https://api.stripe.com/v1/subscriptions?status=active&limit=100", { headers: stripeHdr(sk) }),
        jf("https://api.stripe.com/v1/invoices?status=open&limit=100", { headers: stripeHdr(sk) }),
      ]);
      const mrr = subs.data.reduce((s, sub) =>
        s + (sub.items?.data || []).reduce((ss, i) => ss + (i.price?.unit_amount || 0) * (i.quantity || 1) / 100, 0), 0);
      const ar = invs.data.map((inv) => ({
        id: inv.id,
        customer: inv.customer_name || inv.customer_email || "Unknown",
        amount: inv.amount_due / 100,
        due: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
        days_overdue: inv.due_date ? Math.max(0, Math.floor((Date.now() - inv.due_date * 1000) / 86400000)) : 0,
      }));
      res.json({ mrr, arr: mrr * 12, ar_total: ar.reduce((s, i) => s + i.amount, 0), ar, sub_count: subs.data.length });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // M06 Audit receipts
  app.get("/api/audit/receipts", (req, res) => {
    try {
      const { category, q, limit = "50", offset = "0" } = req.query;
      const { entries: allEntries } = getLedger();
      let entries = [...allEntries];
      if (category) entries = entries.filter((e) => e.category === category);
      if (q) entries = entries.filter((e) => JSON.stringify(e).toLowerCase().includes(String(q).toLowerCase()));

      const total = entries.length;
      entries = entries.slice(Number(offset), Number(offset) + Number(limit));
      res.json({ total, entries: entries.map((e) => ({ hash: e.hash_sha256, category: e.category, ts: e.timestamp, actor: e.actor, chain_id: e.chain_id })) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/audit/verify/:hash", (req, res) => {
    try {
      const { hash } = req.params;
      const { entries: allEntries2 } = getLedger();
      const entry = allEntries2.find((e) => e.hash_sha256 === hash || (e.hash_sha256 && e.hash_sha256.startsWith(hash)));
      res.json({ found: !!entry, entry: entry ? { hash: entry.hash_sha256, category: entry.category, ts: entry.timestamp, actor: entry.actor, chain_id: entry.chain_id, prev_hash: entry.prev_hash } : null });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/audit/csv", (req, res) => {
    try {
      const { entries: allEntries3 } = getLedger();
      const entries = allEntries3.slice(0, 2000);
      const csv = ["hash_sha256,category,timestamp,actor,chain_id,prev_hash",
        ...entries.map((e) => [e.hash_sha256, e.category, e.timestamp, e.actor, e.chain_id, e.prev_hash]
          .map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=\"prooflink-receipts.csv\"");
      res.send(csv);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // M02 Cash (Brex)
  app.get("/api/cash", async (req, res) => {
    const brexKey = getSecret("BREX_API_KEY") || getSecret("BREX_TOKEN");
    if (!brexKey) return res.json({ unavailable: true, reason: "No Brex API key — add BREX_API_KEY to ~/.secrets/" });
    try {
      const [accts, txns] = await Promise.all([
        jf("https://platform.brexapis.com/v2/accounts/cash", { headers: { Authorization: `Bearer ${brexKey}` } }),
        jf("https://platform.brexapis.com/v2/transactions/cash/primary?limit=100", { headers: { Authorization: `Bearer ${brexKey}` } }),
      ]);
      const balance = (accts.items || []).reduce((s, a) => s + (a.current_balance?.amount || 0) / 100, 0);
      const cutoff = Date.now() - 30 * 86400000;
      const burn = (txns.items || []).filter((t) => t.amount < 0 && new Date(t.posted_at).getTime() > cutoff)
        .reduce((s, t) => s + Math.abs(t.amount / 100), 0);
      const runway = burn > 0 ? +(balance / burn).toFixed(1) : null;
      res.json({ balance, burn_30d: burn, runway_months: runway, as_of: new Date().toISOString() });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // M05 Alerts (Wazuh + ITSM)
  app.get("/api/alerts", async (req, res) => {
    try {
      const opsToken = getSecret("OPS_ADMIN_TOKEN");
      const noc = await jf(`${OPS}/api/v1/noc/summary`, { headers: { Authorization: `Bearer ${opsToken}` } }).catch(() => null);
      let wazuh = [];
      try {
        const wazuhPw = getSecret("WAZUH_API_PASSWORD") || getSecret("WAZUH_PASSWORD");
        if (wazuhPw) {
          const auth = await jf("https://127.0.0.1:55000/security/user/authenticate", {
            method: "POST", headers: { Authorization: `Basic ${Buffer.from(`wazuh:${wazuhPw}`).toString("base64")}` },
          });
          const jwt = auth && auth.data && auth.data.token;
          if (jwt) {
            const ar = await jf("https://127.0.0.1:55000/alerts?level=7&limit=20", { headers: { Authorization: `Bearer ${jwt}` } });
            wazuh = (ar && ar.data && ar.data.affected_items || []).map((a) => ({ source: "wazuh", level: a.rule && a.rule.level, description: a.rule && a.rule.description, ts: a.timestamp, agent: a.agent && a.agent.name }));
          }
        }
      } catch {}
      const itsm = ((noc && noc.tickets_open) || []).slice(0, 20).map((t) => ({
        source: "itsm", level: t.priority === "P0" ? "critical" : "warning", description: t.title, ts: t.opened_at, ref: t.ticket_ref, sla: t.sla_status,
      }));
      res.json({ wazuh, itsm, total: wazuh.length + itsm.length, kill_switch: (noc && noc.kill_switch) || null });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // M03 Pipeline (Apollo)
  app.get("/api/pipeline", async (req, res) => {
    const apolloKey = getSecret("APOLLO_API_KEY");
    if (!apolloKey) return res.json({ unavailable: true, reason: "No Apollo API key" });
    try {
      const data = await jf("https://api.apollo.io/v1/emailer_campaigns/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apolloKey },
        body: JSON.stringify({ per_page: 50 }),
      });
      const campaigns = ((data && data.emailer_campaigns) || []).map((c) => ({
        id: c.id, name: c.name, status: c.status,
        contacts: c.num_contacts || 0, replies: c.num_reply_positives || 0, opens: c.num_opens || 0,
        reply_rate: c.num_contacts > 0 ? +((c.num_reply_positives / c.num_contacts) * 100).toFixed(1) : 0,
      }));
      res.json({ campaigns, total: campaigns.length });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // M04 Fundraise
  app.get("/api/fundraise", async (req, res) => {
    try {
      const status = await jf(`${APIGW}/v1/status`).catch(() => ({}));
      const sk = getSecret("STRIPE_SECRET_KEY");
      let mrr = 0, arr = 0, sub_count = 0;
      if (sk) {
        const subs = await jf("https://api.stripe.com/v1/subscriptions?status=active&limit=100", { headers: stripeHdr(sk) }).catch(() => ({ data: [] }));
        mrr = subs.data.reduce((s, sub) => s + ((sub.items && sub.items.data) || []).reduce((ss, i) => ss + ((i.price && i.price.unit_amount) || 0) * (i.quantity || 1) / 100, 0), 0);
        arr = mrr * 12; sub_count = subs.data.length;
      }
      const pl = (status && status.prooflink) || {};
      res.json({
        mrr, arr, sub_count,
        containers: (status.infrastructure && status.infrastructure.containers_running) || 0,
        receipts: pl.total_receipts || 0,
        chain_breaks: pl.chain_breaks || 0,
        nist_score: 96, hipaa_score: 100,

        fundraise_2026: {
          recommended_rounds: [
            { type: "SBIR/STTR Phase I", amount: "$150K-$200K", timeline: "6-9 months", fit: "High - SDVOSB + AI-ops + FedRAMP pathway qualifies for DoD DIU, NSF, DARPA", action: "Apply via SBIR.gov - FY2026 DoD Phase I windows open Q3 2026" },
            { type: "Seed Round - Priced", amount: "$1.5M-$3M", timeline: "Q4 2026", fit: "Strong if 2-3 paying MSP clients signed by Sep 2026", action: "Target AI-ops and GovTech seed funds: Uncork, Lux, Shield Capital, Lightspeed" },
            { type: "Bootstrapped ARR Growth", amount: "First $700K ARR", timeline: "0-12 months", fit: "Best path to negotiating leverage before priced round", action: "Close 2 Managed Pro clients at $6,900/mo - hit $17K MRR by Q3 2026" },
            { type: "Revenue-Based Financing", amount: "$200K-$500K", timeline: "When MRR > $10K", fit: "Non-dilutive; funds sales and infra without giving equity", action: "Pipe, Capchase, or Arc - triggers when Stripe MRR exceeds $10K for 3 months" },
            { type: "Angel and Strategic", amount: "$250K-$500K", timeline: "Now", fit: "IT channel VARs, MSP platform owners who want AI moat", action: "Target 5-10 angels at $50K-$100K each, leveraging F6S Global Top 10 badge" },
            { type: "AFWERX Pitch Day", amount: "$50K-$2M", timeline: "Q3-Q4 2026", fit: "Air Force open to SDVOSBs with autonomous AI-ops tech", action: "Register at afwerx.com - BAA cycles quarterly, SDVOSB set-aside eligible" },
          ],
          market_context: "2026 AI SaaS funding is bifurcating: vertical AI with provable ROI and compliance evidence is still closing; horizontal AI copilots are stalling. UAIO's receipt architecture addresses the number-one enterprise AI blocker - auditability. That is a fundable moat in this environment.",
          grant_programs: [
            "SBA SBIR/STTR - DoD, NSF, DARPA - up to $2M Phase I+II total",
            "AFWERX Pitch Day - Air Force - SDVOSBs eligible, $50K-$2M",
            "DoD APEX Accelerator - formerly PTAP - free BD support and contract set-asides",
            "Veteran Business Outreach Center VBOC micro-grants and SBA Boots to Business",
            "NSF SBIR Phase I - $275K, AI and cybersecurity focus areas open Q4 2026",
          ],
          investor_thesis: "UAIO = AIOps + proof layer. The receipt-anchored autonomous operations model is defensible IP. Healthcare and Gov verticals provide 2x TAM expansion with HIPAA and FISMA moats competitors cannot replicate quickly.",
        },
        use_of_funds: [
          { label: "R&D / Engineering", pct: 45, color: "#22d3ee" },
          { label: "Sales & Marketing", pct: 25, color: "#a855f7" },
          { label: "Infrastructure", pct: 15, color: "#34d399" },
          { label: "Operations / G&A", pct: 15, color: "#f59e0b" },
        ],
        quotes: [
          { text: "The kill-switch and audit chain are genuinely novel for autonomous MSP AI.", author: "Seed advisor" },
          { text: "UAIO category framing maps cleanly to existing federal ITSM procurement lines.", author: "BD consultant" },
          { text: "50k+ immutable receipts in production, zero chain breaks. That's the story — provable autonomy.", author: "Investor note" },
          { text: "In 2026 the only AI that closes enterprise is AI that hands compliance a signed audit trail. You have that.", author: "GTM advisor" },
          { text: "MSP + AI + receipts is the wedge. Win one SDVOSB contract and the gov channel opens.", author: "Federal BD partner" },
        ],
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // M07 Backup / DR
  app.get("/api/backup", (req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) return res.json({ missing: true, message: "Backup dir not found — set up pg_dump cron to " + BACKUPS_DIR });
      const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => {
          const st = fs.statSync(path.join(BACKUPS_DIR, d.name));
          const ageH = (Date.now() - st.mtimeMs) / 3600000;
          return { name: d.name, mtime: st.mtime.toISOString(), age_hours: +ageH.toFixed(1), size: st.size, healthy: ageH < 26 };
        }).sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
      const newest = entries[0] || null;
      res.json({ files: entries.slice(0, 20), newest, healthy: !!(newest && newest.healthy) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // M08 Cert Expiry (cached 6h)
  app.get("/api/certs", async (req, res) => {
    if (certCache.data && Date.now() - certCache.at < 6 * 3600000) return res.json(certCache.data);
    const domains = ["itechsmart.dev", "api.itechsmart.dev", "mission.itechsmart.dev", "verify.itechsmart.dev", "market.itechsmart.dev", "noc.itechsmart.dev", "ag2.itechsmart.dev"];
    const certs = await Promise.all(domains.map(async (domain) => {
      try {
        const out = execSync(`echo | openssl s_client -connect ${domain}:443 -servername ${domain} 2>/dev/null | openssl x509 -noout -dates 2>/dev/null`, { timeout: 12000, encoding: "utf8" });
        const m = out.match(/notAfter=(.+)/);
        if (!m) return { domain, error: "parse failed", daysLeft: null, status: "unknown" };
        const expiry = new Date(m[1]);
        const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86400000);
        return { domain, expiry: expiry.toISOString(), daysLeft, status: daysLeft < 14 ? "critical" : daysLeft < 30 ? "warning" : "ok" };
      } catch (e) { return { domain, error: String(e.message).slice(0, 80), daysLeft: null, status: "unknown" }; }
    }));
    certs.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
    certCache.data = { certs, cached_at: new Date().toISOString() };
    certCache.at = Date.now();
    res.json(certCache.data);
  });

  // M11 Compliance
  app.get("/api/compliance", async (req, res) => {
    try {
      const [comp, status] = await Promise.all([
        jf(`${APIGW}/v1/compliance`).catch(() => null),
        jf(`${APIGW}/v1/status`).catch(() => ({})),
      ]);
      const deadline = new Date("2026-11-10T00:00:00Z");
      const cmmc_days = Math.floor((deadline.getTime() - Date.now()) / 86400000);
      const scores = (comp && comp.scores) || {};
      res.json({
        nist: { score: (scores.nist_csf && scores.nist_csf.score) || 96, max: 100, label: "NIST CSF 2.0", status: "internal_assessment" },
        hipaa: { score: (scores.hipaa && scores.hipaa.score) || 100, max: 100, label: "HIPAA", status: "hl7_module_verified" },
        soc2: (() => {
          try {
            const t = JSON.parse(require("fs").readFileSync('/opt/itechsmart/compliance/soc2-tracker.json','utf8'));
            const s = parseInt((t.current_published_score||'79').split('/')[0],10);
            return scores.soc2 || { score: s, max: 100, label: "SOC 2 Type II", status: "type_ii_in_progress" };
          } catch(_) { return scores.soc2 || { score: 79, max: 100, label: "SOC 2 Type II", status: "type_ii_in_progress" }; }
        })(),
        cmmc: { level: 2, deadline: "2026-11-10", days_remaining: cmmc_days, controls_met: 72, controls_total: 110, status: "roadmap" },
        receipts: (status.prooflink && status.prooflink.total_receipts) || 0,
        breakdown: (scores.soc2 && scores.soc2.breakdown) || [],
        evidence_packs: [
          { name: "NIST CSF Evidence Pack", filename: "nist-csf-evidence.pdf" },
          { name: "HIPAA Controls Evidence", filename: "hipaa-evidence.pdf" },
          { name: "SOC 2 Gap Analysis", filename: "soc2-gap.pdf" },
        ],
      });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // M09 Secrets Age — mtime ONLY, never content
  app.get("/api/secrets-age", (req, res) => {
    try {
      const secrets = fs.readdirSync(SECRETS_DIR, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => {
          const st = fs.statSync(path.join(SECRETS_DIR, d.name));
          const age_days = Math.floor((Date.now() - st.mtimeMs) / 86400000);
          return { name: d.name, mtime: st.mtime.toISOString(), age_days, stale: age_days > 90 };
        })
        .sort((a, b) => b.age_days - a.age_days);
      res.json({ secrets, stale_count: secrets.filter((s) => s.stale).length, total: secrets.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  registerLeadsRoutes(app);
}
