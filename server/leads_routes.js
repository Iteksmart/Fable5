// Leads / MSP Outbound Pipeline routes
import pg from "pg";
import fs from "node:fs";

const { Pool } = pg;

const pool = new Pool({
  host: "127.0.0.1", port: 5433,
  database: "itechsmart", user: "itechsmart", password: "its2026!",
});

const PROXY   = "http://127.0.0.1:8204";
const N8N     = "http://127.0.0.1:5678";
const SEQ_ID  = "6a32fc61919023000b0ec7af";
const WF_ID   = "XH9A0K3zEtiUiHly";

function getJwt() {
  try { return fs.readFileSync("/tmp/n8n_jwt.txt", "utf8").trim(); }
  catch { return ""; }
}

export function registerLeadsRoutes(app) {

  // Aggregate stats
  app.get("/api/leads/stats", async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT
          COUNT(*)                                                       AS total,
          COUNT(*) FILTER (WHERE status='enrolled' AND apollo_enroll_ok) AS enrolled,
          COUNT(*) FILTER (WHERE status='rejected')                      AS rejected,
          COUNT(*) FILTER (WHERE status='pending_enroll')                AS pending_enroll,
          ROUND(AVG(score) FILTER (WHERE email != '')::numeric, 1)       AS avg_score,
          MAX(created_at)                                                AS last_run
        FROM outbound_leads WHERE email != ''
      `);
      res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Lead list
  app.get("/api/leads", async (req, res) => {
    try {
      const { status, limit = "200" } = req.query;
      const params = [];
      let where = "WHERE email != ''";
      if (status) { where += ` AND status = $${params.length + 1}`; params.push(status); }
      const r = await pool.query(
        `SELECT contact_id, email, first_name, last_name, title, company, website,
                employees, industry, city, state, score, score_reason, pain_point,
                email_subject, email_body, status, apollo_enroll_ok,
                apollo_sequence_id, created_at
         FROM outbound_leads ${where}
         ORDER BY score DESC, created_at DESC
         LIMIT $${params.length + 1}`,
        [...params, Number(limit)],
      );
      res.json({ leads: r.rows, total: r.rowCount });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Trigger full pipeline (proxied to apollo-proxy)
  app.post("/api/leads/run-pipeline", async (req, res) => {
    try {
      const { per_page = 10, score_threshold = 75 } = req.body || {};
      const r = await fetch(`${PROXY}/run-pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ per_page, score_threshold, sequence_id: SEQ_ID }),
        signal: AbortSignal.timeout(660_000),
      });
      res.json(await r.json());
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // n8n execution history for this workflow
  app.get("/api/leads/executions", async (req, res) => {
    try {
      const jwt = getJwt();
      if (!jwt) return res.json([]);
      const r = await fetch(
        `${N8N}/api/v1/executions?workflowId=${WF_ID}&limit=15`,
        { headers: { "X-N8N-API-KEY": jwt }, signal: AbortSignal.timeout(8000) },
      );
      const data = await r.json();
      res.json((data.data || []).map((e) => ({
        id: e.id,
        status: e.status,
        startedAt: e.startedAt,
        stoppedAt: e.stoppedAt,
        duration_s: e.startedAt && e.stoppedAt
          ? Math.round((new Date(e.stoppedAt) - new Date(e.startedAt)) / 1000)
          : null,
      })));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Proxy health check to apollo-proxy
  app.get("/api/leads/proxy-health", async (req, res) => {
    try {
      const r = await fetch(`${PROXY}/health`, { signal: AbortSignal.timeout(4000) });
      res.json(await r.json());
    } catch (e) { res.status(502).json({ error: e.message }); }
  });
}
