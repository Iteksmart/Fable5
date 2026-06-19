import React, { useEffect, useState } from 'react';

const T = {
  navy:"#0A0F2C", darkNav:"#060A1A", card:"#141D3B", card2:"#1A2550",
  teal:"#00D4FF", green:"#00E5A0", gold:"#FFB800", red:"#FF4B4B",
  purple:"#A78BFA", white:"#FFFFFF", gray:"#8B9DC3", light:"#B8C5E0",
};

const API = "/api/v1";

const AGENT_COLORS: Record<string, string> = {
  claude:"#CC785C", nemotron:"#76B900", octoai:"#FF6B35", codex:"#A78BFA",
  hermes:"#00D4FF", ag2:"#FFB800", iself:"#00E5A0", superninja:"#F472B6",
  "a2a":"#38BDF8", "a2a-bridge":"#38BDF8",
};

function agentColor(id: string) {
  if (!id) return T.teal;
  const key = Object.keys(AGENT_COLORS).find(k => id.toLowerCase().includes(k));
  return key ? AGENT_COLORS[key] : T.teal;
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:T.card, borderRadius:10, padding:"16px 18px",
      boxShadow:"0 4px 20px rgba(0,0,0,0.4)", ...style }}>
      {children}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background:color+"22", color, border:`1px solid ${color}44`,
      borderRadius:4, fontSize:10, padding:"2px 7px", fontWeight:700, letterSpacing:1 }}>
      {label}
    </span>
  );
}

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span style={{ display:"inline-block", width:size, height:size,
    borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}` }} />;
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  function load() {
    fetch(`${API}/approvals`).then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.approvals || []);
        setItems(arr);
      }).catch(() => {});
  }

  async function resolve(id: string, action: "approve" | "deny" | "info") {
    setActing(id);
    const method = "POST";
    const endpoint = action === "info" ? "info" : action;
    try {
      const res = await fetch(`${API}/approvals/${id}/${endpoint}`, {
        method, headers:{ "content-type":"application/json" },
        body: JSON.stringify({ resolved_by:"djuane", notes:"Resolved via Mission Control" }),
      });
      if (res.ok) {
        const statusMap = { approve:"approved", deny:"denied", info:"info_requested" };
        setItems(prev => prev.map(a => a.id === id ? { ...a, status: statusMap[action] } : a));
      }
    } catch {
      const statusMap: Record<string, string> = { approve:"approved", deny:"denied", info:"info_requested" };
      setItems(prev => prev.map(a => a.id === id ? { ...a, status: statusMap[action] } : a));
    } finally {
      setActing(null);
    }
  }

  function agentLabel(a: any) { return a.agent_name || a.agent_id || "Unknown Agent"; }
  function timestamp(a: any) {
    const ts = a.requested_at || a.created || a.created_at || "";
    if (!ts) return "";
    try { return new Date(ts).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }); } catch { return ts; }
  }
  function reqType(a: any) { return a.request_type || a.type || a.action?.split(" ")[0] || "request"; }
  function riskColor(a: any) {
    if (a.priority === "high" || a.priority === "urgent" || a.risk === "high") return T.red;
    if (a.priority === "low" || a.risk === "low") return T.gray;
    return T.gold;
  }

  const pending = items.filter(a => a.status === "pending" || a.status === "open");
  const resolved = items.filter(a => a.status !== "pending" && a.status !== "open");

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
        <span style={{ color:T.white, fontWeight:700, fontSize:16 }}>Agent Requests</span>
        {pending.length > 0 && (
          <span style={{ background:T.red, borderRadius:"50%", width:22, height:22,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, fontWeight:700, color:T.white }}>
            {pending.length}
          </span>
        )}
        <button onClick={load}
          style={{ marginLeft:"auto", background:"transparent", border:`1px solid ${T.card2}`,
            borderRadius:6, padding:"5px 12px", color:T.gray, fontSize:11, cursor:"pointer" }}>
          ↻ Refresh
        </button>
      </div>

      <div style={{ fontSize:10, color:T.teal, letterSpacing:2, marginBottom:10 }}>
        PENDING APPROVAL ({pending.length})
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
        {pending.map((a: any) => {
          const color = a.color || agentColor(a.agent_id || "");
          const isActing = acting === a.id;
          return (
            <Card key={a.id} style={{ borderLeft:`3px solid ${color}` }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <Dot color={color} size={8} />
                    <span style={{ color:T.white, fontWeight:700, fontSize:13 }}>{a.title}</span>
                    <Badge label={reqType(a).toUpperCase()} color={color} />
                    {(a.priority === "high" || a.risk === "high") && <Badge label="HIGH" color={T.red} />}
                    {(a.priority === "urgent") && <Badge label="URGENT" color={T.red} />}
                  </div>
                  <div style={{ fontSize:11, color:T.gray, marginBottom:4 }}>
                    {agentLabel(a)} · {timestamp(a)}
                  </div>
                  <div style={{ fontSize:12, color:T.light }}>{a.description || a.action || ""}</div>
                </div>
                <div style={{ display:"flex", gap:8, flexShrink:0, marginTop:2 }}>
                  <button onClick={() => resolve(a.id, "approve")} disabled={isActing}
                    style={{ background:T.green+"22", border:`1px solid ${T.green}`,
                      borderRadius:6, padding:"6px 14px", color:T.green,
                      fontSize:12, fontWeight:700, cursor:isActing ? "wait" : "pointer", opacity:isActing ? 0.5 : 1 }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => setExpanded(prev => prev === a.id ? null : a.id)}
                    style={{ background:expanded===a.id ? T.gold+"33" : T.gold+"22", border:`1px solid ${T.gold}`,
                      borderRadius:6, padding:"6px 14px", color:T.gold,
                      fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    {expanded === a.id ? "▲ Less" : "? More Info"}
                  </button>
                  <button onClick={() => resolve(a.id, "deny")} disabled={isActing}
                    style={{ background:T.red+"22", border:`1px solid ${T.red}`,
                      borderRadius:6, padding:"6px 14px", color:T.red,
                      fontSize:12, fontWeight:700, cursor:isActing ? "wait" : "pointer", opacity:isActing ? 0.5 : 1 }}>
                    ✕ Deny
                  </button>
                </div>
              </div>
              {expanded === a.id && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.card2}`, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div><span style={{ color:T.gray, fontSize:10 }}>ACTION </span><span style={{ color:T.light, fontSize:11 }}>{a.action || "—"}</span></div>
                  <div><span style={{ color:T.gray, fontSize:10 }}>RISK </span><span style={{ color:riskColor(a), fontSize:11, fontWeight:700 }}>{(a.risk || "—").toUpperCase()}</span></div>
                  <div><span style={{ color:T.gray, fontSize:10 }}>PRIORITY </span><span style={{ color:T.light, fontSize:11 }}>{a.priority || "normal"}</span></div>
                  <div><span style={{ color:T.gray, fontSize:10 }}>TYPE </span><span style={{ color:T.light, fontSize:11 }}>{a.request_type || a.type || "—"}</span></div>
                  {a.payload && Object.keys(a.payload).length > 0 && (
                    <div style={{ gridColumn:"1/-1" }}>
                      <span style={{ color:T.gray, fontSize:10 }}>PAYLOAD </span>
                      <code style={{ color:T.teal, fontSize:10 }}>{JSON.stringify(a.payload)}</code>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {pending.length === 0 && (
          <div style={{ color:T.gray, fontSize:13, textAlign:"center", padding:24,
            background:T.card, borderRadius:10 }}>
            ✓ No pending approvals — all caught up
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <>
          <div style={{ fontSize:10, color:T.gray, letterSpacing:2, marginBottom:10 }}>
            RESOLVED ({resolved.length})
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {resolved.map((a: any) => (
              <Card key={a.id} style={{ opacity:0.6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <Badge label={(a.status||"resolved").toUpperCase()}
                    color={a.status==="approved" ? T.green : a.status==="denied" ? T.red : T.gold} />
                  <span style={{ color:T.gray, fontSize:12 }}>{a.title}</span>
                  <span style={{ color:T.gray, fontSize:11, marginLeft:"auto" }}>{agentLabel(a)}</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
