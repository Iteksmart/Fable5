'use strict';
import https from 'node:https';

// Helper using https.request so we can override the Host header (fetch() forbids it)
function tacticalReq(path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '172.18.0.1',
      port: 4443,
      path,
      method: method || 'GET',
      headers: headers || {},
      rejectUnauthorized: false,
    };
    if (body) opts.headers['Content-Length'] = String(Buffer.byteLength(body));
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString(), ok: res.statusCode >= 200 && res.statusCode < 300 }));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// Overrides registered BEFORE integrations_routes.js — these paths take precedence.
export function registerIntegrationRoutesExt(app, getSecret) {

  // TacticalRMM agents list
  app.get('/api/integrations/tactical/agents', async (req, res) => {
    try {
      const key = getSecret('TACTICAL_API_KEY', 'tactical_api_key') || getSecret('TACTICAL_API_TOKEN', 'tactical_api_token') || '';
      if (!key) return res.status(503).json({ error: 'TACTICAL credentials not configured', agents: [] });
      const r = await tacticalReq('/agents/', 'GET', { 'X-API-KEY': key, 'Host': 'api.tactical.itechsmart.dev' });
      if (!r.ok) return res.status(r.status).json({ error: 'TacticalRMM returned ' + r.status, agents: [] });
      const agents = JSON.parse(r.body);
      res.json({ agents: Array.isArray(agents) ? agents : [], count: Array.isArray(agents) ? agents.length : 0 });
    } catch(e) { res.status(502).json({ error: e.message, agents: [], source: 'tactical' }); }
  });

  // TacticalRMM alerts — list endpoint only accepts PATCH with {top:N}
  app.get('/api/integrations/tactical/alerts', async (req, res) => {
    try {
      const key = getSecret('TACTICAL_API_KEY', 'tactical_api_key') || getSecret('TACTICAL_API_TOKEN', 'tactical_api_token') || '';
      if (!key) return res.status(503).json({ error: 'TACTICAL credentials not configured', alerts: [] });
      const body = JSON.stringify({ top: 50 });
      const r = await tacticalReq('/alerts/', 'PATCH', {
        'X-API-KEY': key,
        'Host': 'api.tactical.itechsmart.dev',
        'Content-Type': 'application/json',
      }, body);
      if (!r.ok) return res.status(r.status).json({ error: 'TacticalRMM returned ' + r.status, alerts: [] });
      const data = JSON.parse(r.body);
      const alerts = data.alerts ?? (Array.isArray(data) ? data : []);
      res.json({ alerts: alerts.slice(0, 50), count: data.alerts_count ?? alerts.length });
    } catch(e) { res.status(502).json({ error: e.message, alerts: [], source: 'tactical' }); }
  });

  // Wazuh manager stats — self-signed cert on port 55000
  app.get('/api/integrations/wazuh/alerts', async (req, res) => {
    try {
      const user = getSecret('WAZUH_API_USER') || 'wazuh-wui';
      const pass = getSecret('WAZUH_API_PASS') || getSecret('wazuh_api_pass') || '';
      const auth = Buffer.from(user + ':' + pass).toString('base64');
      const wazuhReq = (method, p, hdrs) => new Promise((resolve, reject) => {
        const r2 = https.request({ hostname: 'localhost', port: 55000, path: p, method,
          headers: hdrs, rejectUnauthorized: false }, (res2) => {
          let d = ''; res2.on('data', c => d += c); res2.on('end', () => resolve({ status: res2.statusCode, body: d }));
        });
        r2.on('error', reject);
        r2.setTimeout(6000, () => { r2.destroy(); reject(new Error('timeout')); });
        r2.end();
      });
      const authR = await wazuhReq('POST', '/security/user/authenticate?raw=true', { Authorization: 'Basic ' + auth });
      if (authR.status !== 200) return res.status(authR.status).json({ error: 'Wazuh auth failed', alerts: [] });
      const jwt = authR.body.trim();
      const statR = await wazuhReq('GET', '/manager/stats?component=remoted', { Authorization: 'Bearer ' + jwt });
      const stats = statR.status === 200 ? JSON.parse(statR.body) : {};
      res.json({ status: 'running', stats: stats.data ?? {}, source: 'wazuh' });
    } catch(e) { res.status(502).json({ error: e.message, alerts: [], source: 'wazuh' }); }
  });

}
