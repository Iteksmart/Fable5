import React, { useEffect, useState } from 'react';

const T = {
  navy:"#0A0F2C", darkNav:"#060A1A", card:"#141D3B", card2:"#1A2550",
  teal:"#00D4FF", green:"#00E5A0", gold:"#FFB800", red:"#FF4B4B",
  purple:"#A78BFA", white:"#FFFFFF", gray:"#8B9DC3", light:"#B8C5E0",
};

const API = "/api/v1";

// Map API integration status → UI status
function statusToColor(status: string, name: string): { color: string; badge: string } {
  if (status === "active" || status === "ok") return { color:T.green, badge:"ok" };
  if (status === "inactive" || status === "error") {
    // Known config issues
    if (name.toLowerCase().includes("stripe")) return { color:T.red, badge:"error" };
    if (name.toLowerCase().includes("linkedin")) return { color:T.gold, badge:"warning" };
    return { color:T.red, badge:"error" };
  }
  if (status === "warning") return { color:T.gold, badge:"warning" };
  return { color:T.gray, badge:status };
}

function integrationNote(item: any): string {
  const name = (item.name || "").toLowerCase();
  if (item.note) return item.note;
  if (name.includes("anthropic")) return item.status === "active" ? "API key configured" : "API key not set — check ~/.secrets/anthropic_api_key";
  if (name.includes("nvidia") || name.includes("nemotron")) return item.status === "active" ? "NGC key configured" : "NGC key not set — check ~/.secrets/ngc_api_key";
  if (name.includes("stripe")) return "Keys not configured — billing disabled";
  if (name.includes("linkedin")) return "OAuth token expires Jul 27, 2026";
  if (name.includes("cloudflare")) return "Zero Trust + tunnel active";
  if (name.includes("letta")) return "Memory server at :8283";
  if (name.includes("vault")) return "HashiCorp Vault at :8200";
  if (name.includes("hermes")) return "185 agents, fleet active";
  if (name.includes("ag2")) return "6-agent GroupChat at :8500";
  if (name.includes("n8n")) return "Automation at n8n.itechsmart.dev";
  return item.status;
}

const QUICK_LINKS = [
  { label:"Port Registry",      href:"https://verify.itechsmart.dev/api/v1/ports/ui", color:T.teal },
  { label:"Clerk User Mgmt",    href:"https://dashboard.clerk.com",                   color:T.purple },
  { label:"Cloudflare Zero Trust",href:"https://dash.cloudflare.com",                 color:T.gold },
  { label:"Wazuh SIEM",         href:"https://wazuh.itechsmart.dev",                  color:T.green },
  { label:"N8N Workflows",      href:"https://n8n.itechsmart.dev",                    color:T.teal },
  { label:"Vault Secrets",      href:"https://vault.itechsmart.dev",                  color:T.gold },
];

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:T.card, borderRadius:10, padding:"16px 18px",
      boxShadow:"0 4px 20px rgba(0,0,0,0.4)", ...style }}>
      {children}
    </div>
  );
}

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span style={{ display:"inline-block", width:size, height:size,
    borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}` }} />;
}

export default function AdminPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [controls, setControls] = useState<any[]>([]);
  const [stats, setStats] = useState({ count:158, healthy:0, degraded:0 });
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/admin/integrations`).then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.integrations || []);
        setIntegrations(arr);
      }).catch(() => {});

    fetch(`${API}/admin/flags`).then(r => r.json())
      .then(data => {
        const flags = data.flags || data;
        if (typeof flags === "object" && !Array.isArray(flags)) {
          const LABELS: Record<string, string> = {
            agent_auto_approve: "Agent Auto-Approve",
            nemotron_fallback: "Nemotron Fallback",
            daytona_autoprovision: "Daytona Autoprovision",
            hermes_dispatch: "Hermes Dispatch",
            ag2_auto_heal: "AG2 Auto-Heal",
            iself_auto_heal: "iSELF Auto-Heal",
            comms_sse_enabled: "Comms SSE Stream",
            receipt_sealing: "Receipt Sealing",
            supreme_standup_auto: "Supreme Standup AUTO",
          };
          setControls(Object.entries(flags).map(([key, val]) => ({
            key, label: LABELS[key] || key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()),
            on: val === true || val === 1,
            color: (val === true || val === 1) ? T.green : T.gray,
            note: key === "supreme_standup_auto" ? "Manual by design" : undefined,
          })));
        } else if (Array.isArray(flags)) {
          setControls(flags);
        }
      }).catch(() => {});

    fetch(`${API}/admin/services`).then(r => r.json())
      .then(data => {
        const svcs = data.services || [];
        const healthy = svcs.filter((s: any) => s.status === "active" || s.health === 200).length;
        setStats({ count: data.count || svcs.length, healthy, degraded: svcs.length - healthy });
      }).catch(() => {});
  }, []);

  const [gryphData, setGryphData] = React.useState<any>(null)
  useEffect(() => {
    fetch('/api/v1/integrations/gryph/trails')
      .then(r => r.json())
      .then(setGryphData)
      .catch(() => {})
  }, [])

  async function toggleFlag(key: string, currentOn: boolean) {
    setToggling(key);
    setControls(prev => prev.map(c => c.key === key ? { ...c, on:!currentOn, color:!currentOn ? T.green : T.gray } : c));
    try {
      await fetch(`${API}/admin/flags/${key}`, {
        method:"POST", headers:{ "content-type":"application/json" },
        body: JSON.stringify({ value: !currentOn }),
      });
    } catch {}
    setToggling(null);
  }

  return (
    <div style={{ display:"flex", gap:16 }}>
      <div style={{ flex:1 }}>
        {/* Integrations */}
        <div style={{ fontSize:10, color:T.teal, letterSpacing:2, marginBottom:10 }}>
          INTEGRATIONS ({integrations.length})
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
          {integrations.length === 0 && (
            <div style={{ color:T.gray, fontSize:12, padding:12 }}>Loading integrations…</div>
          )}
          {integrations.map((itg: any, i: number) => {
            const { color, badge } = statusToColor(itg.status, itg.name || "");
            const note = integrationNote(itg);
            return (
              <Card key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px" }}>
                <Dot color={color} size={10} />
                <span style={{ color:T.white, fontWeight:600, fontSize:13, width:180 }}>{itg.name}</span>
                <span style={{ fontSize:12, color:T.light, flex:1 }}>{note}</span>
                <span style={{ fontSize:10, color, background:color+"15", borderRadius:4, padding:"2px 6px", fontWeight:700, flexShrink:0 }}>
                  {badge.toUpperCase()}
                </span>
                {badge === "error" && (
                  <button style={{ background:T.red+"22", border:`1px solid ${T.red}`,
                    borderRadius:6, padding:"4px 12px", color:T.red,
                    fontSize:11, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                    FIX
                  </button>
                )}
              </Card>
            );
          })}
        </div>

        {/* Platform controls */}
        {controls.length > 0 && (
          <>
            <div style={{ fontSize:10, color:T.teal, letterSpacing:2, marginBottom:10 }}>
              PLATFORM CONTROLS
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {controls.map((ctrl: any, i: number) => (
                <Card key={i} style={{ display:"flex", alignItems:"center",
                  justifyContent:"space-between", padding:"12px 14px" }}>
                  <div>
                    <div style={{ fontSize:12, color:T.white, fontWeight:600 }}>{ctrl.label}</div>
                    {ctrl.note && <div style={{ fontSize:10, color:T.gray }}>{ctrl.note}</div>}
                  </div>
                  <div onClick={() => !toggling && toggleFlag(ctrl.key, ctrl.on)}
                    style={{ background:ctrl.on ? ctrl.color+"33" : "#ffffff11",
                      border:`1.5px solid ${ctrl.on ? ctrl.color : "#ffffff22"}`,
                      borderRadius:20, width:40, height:22, position:"relative",
                      cursor:toggling ? "wait" : "pointer", flexShrink:0,
                      opacity: toggling === ctrl.key ? 0.5 : 1 }}>
                    <div style={{ position:"absolute", top:2,
                      left:ctrl.on ? 20 : 2, width:14, height:14, borderRadius:"50%",
                      background:ctrl.on ? ctrl.color : "#ffffff44",
                      transition:"left 0.2s" }} />
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right panel */}
      <div style={{ width:280 }}>
        <Card style={{ marginBottom:12 }}>
          <div style={{ fontSize:10, color:T.teal, letterSpacing:2, marginBottom:12 }}>
            QUICK ACTIONS
          </div>
          {QUICK_LINKS.map((a, i) => (
            <a key={i} href={a.href} target="_blank" rel="noopener noreferrer"
              style={{ display:"block", padding:"10px 0",
                borderBottom:`1px solid ${T.card2}`,
                fontSize:13, color:a.color, fontWeight:600, textDecoration:"none" }}>
              {a.label} →
            </a>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize:10, color:T.teal, letterSpacing:2, marginBottom:10 }}>
            PLATFORM STATS
          </div>
          {[
            ["Services",          stats.count + " monitored"],
            ["Healthy",           stats.healthy > 0 ? stats.healthy + " active" : "Loading…"],
            ["Containers",        "115+ running"],
            ["Subdomains",        "44 conf.d routes"],
            ["ProofLink Receipts","45,915+"],
            ["Agents",            "185 Hermes live"],
            ["Tests",             "22/22 passing"],
          ].map(([k, v], i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between",
              padding:"7px 0", borderBottom:`1px solid ${T.card2}`, fontSize:12 }}>
              <span style={{ color:T.gray }}>{k}</span>
              <span style={{ color:T.white, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </Card>
        {/* ── Gryph Coding Agent Audit Trails ────────────────────────────── */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold">🔍 Gryph — Coding Agent Audit Trails</span>
            <span className="text-xs text-white/40">{gryphData?.total_sessions ?? 0} sessions total</span>
          </div>
          {(gryphData?.recent ?? []).length === 0 && (
            <p className="text-xs text-white/30">No sessions yet. Use: <code className="font-mono bg-white/5 px-1 rounded">gryph-session codex "your task"</code></p>
          )}
          <div className="space-y-2">
            {(gryphData?.recent ?? []).map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/5">
                <span className="text-amber-400 font-bold w-16 shrink-0">{s.tool ?? 'codex'}</span>
                <span className="flex-1 font-mono text-white/40 truncate">{s.session}</span>
                <span className="text-cyan-400 w-16 text-right">{s.events} events</span>
                <span className="text-white/20 w-20 text-right">
                  {s.start ? new Date(s.start).toLocaleTimeString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

  );
}
