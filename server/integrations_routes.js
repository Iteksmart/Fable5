'use strict';
import fs           from 'node:fs';
import path         from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// PROTECTED: Mission Control integration routes. Do NOT rewrite or remove these 9 routes.
export function registerIntegrationRoutes(app, getSecret) {

  // Langfuse AI traces (AI Studio tab)
  app.get('/api/integrations/langfuse/traces', async (req, res) => {
    try {
      const pub  = getSecret('LANGFUSE_PUBLIC_KEY', 'langfuse_public_key') || '';
      const sec  = getSecret('LANGFUSE_SECRET_KEY', 'langfuse_secret_key') || '';
      const base = (getSecret('LANGFUSE_BASE_URL', 'langfuse_base_url') || 'http://localhost:3001').replace(/\/$/, '');
      const headers = pub && sec
        ? { Authorization: 'Basic ' + Buffer.from(pub + ':' + sec).toString('base64') }
        : {};
      const r = await fetch(base + '/api/public/traces?limit=10',
        { headers, signal: AbortSignal.timeout(6000) });
      if (!r.ok) return res.status(r.status).json({ error: 'Langfuse returned ' + r.status });
      res.json(await r.json());
    } catch(e) { res.status(502).json({ error: e.message, source: 'langfuse' }); }
  });

  // Probo GRC health (Compliance tab) — /api/v1/controls/summary absent in this build
  app.get('/api/integrations/probo/summary', async (req, res) => {
    try {
      const base = (getSecret('PROBO_BASE_URL', 'probo_base_url') || 'http://localhost:3250').replace(/\/$/, '');
      const r = await fetch(base + '/health',
        { signal: AbortSignal.timeout(6000) });
      if (!r.ok) return res.status(r.status).json({ error: 'Probo returned ' + r.status });
      const ct = r.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await r.json() : await r.text();
      res.json({ healthy: true, status: body, source: 'probo' });
    } catch(e) { res.status(502).json({ error: e.message, source: 'probo' }); }
  });

  // AlertChain OPA decisions (Compliance + NOC tabs)
  app.get('/api/integrations/alertchain/decisions', async (req, res) => {
    try {
      const r = await fetch('http://localhost:3035/health',
        { signal: AbortSignal.timeout(5000) });
      const healthy = r.ok;
      res.json({ healthy, allowed: 0, denied: 0, total: 0, status: healthy ? 'running' : 'down',
        note: 'Decisions accumulate as Wazuh alerts are processed via /webhook/wazuh',
        recent_denials: [] });
    } catch(e) { res.status(502).json({ error: e.message, decisions: [], source: 'alertchain' }); }
  });

  // TacticalRMM agents via REST API key (Devices tab)
  app.get('/api/integrations/tactical/agents', async (req, res) => {
    try {
      const key  = getSecret('TACTICAL_API_KEY', 'tactical_api_key');
      const base = (getSecret('TACTICAL_BASE_URL', 'tactical_base_url') || 'https://tactical.itechsmart.dev').replace(/\/$/, '');
      if (!key) return res.status(503).json({ error: 'TACTICAL_API_KEY not configured', agents: [] });
      const r = await fetch(base + '/api/v3/agents/', {
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) return res.status(r.status).json({ error: 'TacticalRMM returned ' + r.status, agents: [] });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) return res.status(502).json({ error: 'TacticalRMM backend unavailable (HTML response)', agents: [] });
      const agents = await r.json();
      res.json({ agents, count: Array.isArray(agents) ? agents.length : 0 });
    } catch(e) { res.status(502).json({ error: e.message, agents: [], source: 'tactical' }); }
  });

  // Weaviate meta (Agents tab)
  app.get('/api/integrations/weaviate/meta', async (req, res) => {
    try {
      const key  = getSecret('WEAVIATE_API_KEY', 'weaviate_api_key');
      const base = (getSecret('WEAVIATE_BASE_URL', 'weaviate_base_url') || 'http://localhost:8383').replace(/\/$/, '');
      const headers = key ? { Authorization: 'Bearer ' + key } : {};
      const [metaR, classesR] = await Promise.all([
        fetch(base + '/v1/meta',   { headers, signal: AbortSignal.timeout(5000) }),
        fetch(base + '/v1/schema', { headers, signal: AbortSignal.timeout(5000) }),
      ]);
      const meta   = metaR.ok    ? await metaR.json()    : {};
      const schema = classesR.ok ? await classesR.json() : {};
      res.json({ meta, classCount: (schema.classes || []).length,
        classes: (schema.classes || []).map(c => c.class) });
    } catch(e) { res.status(502).json({ error: e.message, source: 'weaviate' }); }
  });

  // Shuffle workflows (NOC tab)
  app.get('/api/integrations/shuffle/workflows', async (req, res) => {
    try {
      const key  = getSecret('SHUFFLE_API_KEY', 'shuffle_api_key');
      const base = (getSecret('SHUFFLE_BASE_URL', 'shuffle_base_url') || 'http://localhost:5001').replace(/\/$/, '');
      const headers = key ? { Authorization: 'Bearer ' + key } : {};
      const r = await fetch(base + '/api/v1/workflows',
        { headers, signal: AbortSignal.timeout(6000) });
      if (!r.ok) return res.status(r.status).json({ error: 'Shuffle returned ' + r.status, workflows: [] });
      res.json(await r.json());
    } catch(e) { res.status(502).json({ error: e.message, workflows: [], source: 'shuffle' }); }
  });

  // RAGFlow datasets (Agents tab)
  app.get('/api/integrations/ragflow/datasets', async (req, res) => {
    try {
      const key  = getSecret('RAGFLOW_API_KEY', 'ragflow_api_key');
      const base = (getSecret('RAGFLOW_BASE_URL', 'ragflow_base_url') || 'http://localhost:9380').replace(/\/$/, '');
      const headers = key ? { Authorization: 'Bearer ' + key } : {};
      const r = await fetch(base + '/api/v1/datasets',
        { headers, signal: AbortSignal.timeout(6000) });
      if (!r.ok) return res.status(r.status).json({ error: 'RAGFlow returned ' + r.status, data: [] });
      const data = await r.json();
      const datasets = data.data || data.datasets || data || [];
      res.json({ total: datasets.length,
        total_documents: datasets.reduce((a, d) => a + (d.doc_count || d.document_count || 0), 0),
        datasets: datasets.slice(0, 10) });
    } catch(e) { res.status(502).json({ error: e.message, data: [], source: 'ragflow' }); }
  });

  // MeshCentral devices (Devices tab) — uses meshctrl CLI via docker exec (REST API not enabled)
  app.get('/api/integrations/meshcentral/devices', async (req, res) => {
    try {
      const user = getSecret('MESHCENTRAL_USER', 'meshcentral_user') || '';
      const pass = getSecret('MESHCENTRAL_PASS', 'meshcentral_pass') || '';
      if (!user || !pass) return res.status(503).json({ error: 'MESHCENTRAL_USER/PASS not configured', devices: [] });
      const { stdout } = await execFileAsync('docker', [
        'exec', 'meshcentral',
        'node', '/opt/meshcentral/meshcentral/meshctrl.js',
        'ListDevices',
        '--url', 'wss://localhost:443',
        '--loginuser', user,
        '--loginpass', pass,
        '--json',
      ], { timeout: 15000 });
      const devices = JSON.parse(stdout.trim() || '[]');
      res.json({ devices, count: Array.isArray(devices) ? devices.length : 0, healthy: true });
    } catch(e) { res.status(502).json({ error: e.message, devices: [], source: 'meshcentral' }); }
  });

  // Gryph coding trails (Admin tab)
  app.get('/api/integrations/gryph/trails', (req, res) => {
    try {
      const dir = '/opt/itechsmart/gryph/trails';
      if (!fs.existsSync(dir)) return res.json({ trails: [], count: 0 });
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .sort().slice(-10).reverse();
      const trails = files.map(f => {
        try {
          const lines = fs.readFileSync(path.join(dir, f), 'utf8')
            .trim().split('\n').filter(Boolean);
          const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
          const start  = events.find(e => e.event === 'session_start');
          const end    = events.find(e => e.event === 'session_end');
          return { file: f, tool: (start && start.tool) || 'unknown',
            session_id: (start && start.session_id) || f,
            started: start && start.timestamp, ended: end && end.timestamp,
            exit_code: end && end.exit_code, total_events: events.length };
        } catch { return { file: f, error: 'parse error' }; }
      });
      res.json({ trails, count: files.length });
    } catch(e) { res.status(502).json({ error: e.message }); }
  });

}
