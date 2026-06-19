import React, { useState, useEffect, useRef, useCallback } from 'react';

const AGENT_COLORS: Record<string, string> = {
  'ag2:IncidentDetector': '#FF4B4B',
  'ag2:SecurityGatekeeper': '#00E5A0',
  'ag2:DigitalTwinAnalyst': '#A78BFA',
  'ag2:RemediationPlanner': '#FB923C',
  'ag2:ExecutionAgent': '#60A5FA',
  'ag2:ProofLinkNotary': '#FDE68A',
  'claude': '#7C3AED',
  'claude-code': '#9333EA',
  'djuane': '#06B6D4',
};

function getAgentColor(actor: string): string {
  if (!actor) return '#64748B';
  if (AGENT_COLORS[actor]) return AGENT_COLORS[actor];
  if (actor.startsWith('ag2:')) return '#FF9500';
  if (actor.startsWith('hermes-worker')) return '#14B8A6';
  if (actor.startsWith('a2a:')) return '#F472B6';
  if (actor.startsWith('system:')) return '#94A3B8';
  if (actor.startsWith('claude')) return '#7C3AED';
  let hash = 0;
  for (let i = 0; i < actor.length; i++) hash = actor.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 62%)`;
}

function getInitials(actor: string): string {
  if (!actor) return '??';
  const clean = actor.replace(/^(ag2:|a2a:|system:|hermes-)/, '');
  const parts = clean.split(/[-:_]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

interface Message {
  hash: string;
  actor: string;
  category: string;
  message: string;
  ts: string;
  chain_id?: string | null;
  isA2A?: boolean;
  side?: 'left' | 'right';
  showName?: boolean;
}

// Determine which side of the chat a message sits on.
// Outgoing / initiating → RIGHT; response / completion → LEFT.
function computeSide(msg: Message, chainFirstActors: Record<string, string>): 'left' | 'right' {
  const cat = msg.category || '';

  // A2A handoff: the dispatch goes right, the reply goes left
  if (cat === 'agent_handoff') return 'right';
  if (cat === 'agent_handoff_complete') return 'left';

  // Within a named chain: whoever fired first goes right, others go left
  if (msg.chain_id && !msg.chain_id.startsWith('solo_') && chainFirstActors[msg.chain_id]) {
    return msg.actor === chainFirstActors[msg.chain_id] ? 'right' : 'left';
  }

  // Completion / result categories → left (the "answer")
  const resultCats = ['task_completed', 'self_healing', 'platform_health_check',
    'composio_integration_live', 'composio_integration_status_correction', 'sla_check'];
  if (resultCats.includes(cat)) return 'left';

  // Action / dispatch categories → right (the "ask")
  const actionCats = ['composio_action', 'agent_task', 'task_start', 'incident_detected',
    'scan_request', 'email_polling_complete', 'graph_poll_complete'];
  if (actionCats.includes(cat)) return 'right';

  return 'left';
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts.slice(11, 19) || '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ts.slice(11, 19) || ''; }
}

function ChatBubble({ msg }: { msg: Message }) {
  const side = msg.side || 'left';
  const isRight = side === 'right';
  const color = getAgentColor(msg.actor);
  const initials = getInitials(msg.actor);
  const isA2A = msg.isA2A;
  const text = msg.message || msg.category || '';

  return (
    <div style={{
      display: 'flex',
      flexDirection: isRight ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: 2,
      padding: '0 20px',
    }}>
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: '#000',
        flexShrink: 0,
        opacity: msg.showName ? 1 : 0,
        border: isA2A ? '2px solid #F472B6' : '2px solid transparent',
        boxSizing: 'border-box',
      }}>{initials}</div>

      <div style={{
        maxWidth: '68%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isRight ? 'flex-end' : 'flex-start',
      }}>
        {/* Full agent name */}
        {msg.showName && (
          <div style={{
            fontSize: 11, color: color, marginBottom: 4,
            fontWeight: 700, letterSpacing: '0.02em',
            display: 'flex', alignItems: 'center', gap: 6,
            flexDirection: isRight ? 'row-reverse' : 'row',
          }}>
            <span>{msg.actor}</span>
            {isA2A && (
              <span style={{
                background: '#F472B615', color: '#F472B6',
                padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                border: '1px solid #F472B640',
              }}>A2A</span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div style={{
          background: isRight ? `${color}22` : '#1E293B',
          border: `1px solid ${color}40`,
          borderRadius: isRight ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          padding: '9px 14px',
          color: '#CBD5E1',
          fontSize: 13,
          lineHeight: 1.55,
          wordBreak: 'break-word',
          textAlign: isRight ? 'right' : 'left',
        }}>
          {text}
        </div>

        {/* Meta */}
        <div style={{
          fontSize: 10, color: '#475569', marginTop: 3,
          display: 'flex', gap: 8,
          flexDirection: isRight ? 'row-reverse' : 'row',
        }}>
          <span>{formatTime(msg.ts)}</span>
          {msg.category && msg.category !== text && (
            <span style={{ color: '#334155' }}>{msg.category}</span>
          )}
          {msg.hash && (
            <span style={{ color: '#1E3A5F', fontFamily: 'monospace' }}>
              {msg.hash.slice(0, 8)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Drafts ────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: '#1E293B', border: '1px solid #334155', borderRadius: 8,
  padding: '8px 12px', color: '#E2E8F0', fontSize: 13, width: '100%',
  outline: 'none', boxSizing: 'border-box',
};

function DraftsTab() {
  const [to, setTo] = useState('');
  const [context, setContext] = useState('');
  const [tone, setTone] = useState('professional');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!to || !context) return;
    setLoading(true); setError(''); setDraft('');
    try {
      const r = await fetch('/api/agentos/comms/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to, context, tone }),
      });
      const d = await r.json();
      setDraft(d.draft || d.message || JSON.stringify(d));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 680 }}>
      <h3 style={{ color: '#E2E8F0', marginBottom: 8, fontWeight: 600 }}>AI-Drafted Client Communications</h3>
      <p style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>
        Signed as DJuane Jackson, CEO & Founder · iTechSmart
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input value={to} onChange={e => setTo(e.target.value)}
          placeholder="To (client name or company)" style={inputStyle} />
        <textarea value={context} onChange={e => setContext(e.target.value)}
          placeholder="Context / topic / key points..." rows={4}
          style={{ ...inputStyle, resize: 'vertical' }} />
        <select value={tone} onChange={e => setTone(e.target.value)} style={inputStyle}>
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="urgent">Urgent</option>
          <option value="executive">Executive Summary</option>
        </select>
        <button onClick={generate} disabled={loading || !to || !context} style={{
          background: loading ? '#4C1D95' : '#7C3AED', border: 'none', borderRadius: 8,
          padding: '10px 20px', color: '#fff', fontSize: 13,
          cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
          opacity: (!to || !context) ? 0.5 : 1,
        }}>
          {loading ? 'Generating...' : 'Generate Draft'}
        </button>
        {error && <div style={{ color: '#FF4B4B', fontSize: 13 }}>{error}</div>}
        {draft && (
          <div style={{
            background: '#1E293B', border: '1px solid #334155', borderRadius: 8,
            padding: 16, color: '#E2E8F0', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap',
          }}>{draft}</div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Comms() {
  const [tab, setTab] = useState<'chat' | 'drafts'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('');
  const [actors, setActors] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenHashes = useRef(new Set<string>());
  const esRef = useRef<EventSource | null>(null);
  const autoScroll = useRef(true);
  const chatRef = useRef<HTMLDivElement>(null);

  // Build chain→firstActor map so computeSide can check it
  const chainFirstActors = useRef<Record<string, string>>({});

  const addMessages = useCallback((newMsgs: Message[]) => {
    const fresh = newMsgs.filter(m => {
      const key = m.hash ? `h:${m.hash}` : `k:${m.ts}|${m.actor}|${m.message?.slice(0, 30)}`;
      if (seenHashes.current.has(key)) return false;
      seenHashes.current.add(key);
      // Track first actor per chain
      if (m.chain_id && !m.chain_id.startsWith('solo_') && !chainFirstActors.current[m.chain_id]) {
        chainFirstActors.current[m.chain_id] = m.actor;
      }
      return true;
    });
    if (!fresh.length) return;

    setMessages(prev => {
      const combined = [...prev, ...fresh].slice(-600);
      return combined;
    });
    setActors(prev => {
      const s = new Set(prev);
      fresh.forEach(m => { if (m.actor) s.add(m.actor); });
      return Array.from(s).sort();
    });
  }, []);

  // Load history
  useEffect(() => {
    fetch('/api/comms/feed?limit=100')
      .then(r => r.json())
      .then(d => {
        const msgs: Message[] = (d.messages || []).map((m: any) => ({
          hash: m.hash || '',
          actor: m.actor || 'unknown',
          category: m.category || '',
          message: String(m.message || m.action || ''),
          ts: m.ts || '',
          chain_id: m.chain_id || null,
          isA2A: m.category === 'agent_handoff' || m.category === 'agent_handoff_complete',
        }));
        addMessages(msgs);
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 120);
      })
      .catch(() => setLoading(false));
  }, [addMessages]);

  // SSE
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;
    const connect = () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      const es = new EventSource('/api/prooflink/stream');
      esRef.current = es;
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;
        retryTimer = setTimeout(connect, 8000);
      };
      es.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (!d.actor && !d.hash) return;
          addMessages([{
            hash: d.hash || '',
            actor: d.actor || 'unknown',
            category: d.category || '',
            message: String(d.action || d.message || d.category || ''),
            ts: d.ts || new Date().toISOString(),
            chain_id: d.chain_id || null,
            isA2A: d.category === 'agent_handoff' || d.category === 'agent_handoff_complete',
          }]);
        } catch { /* ignore */ }
      };
    };
    connect();
    return () => { clearTimeout(retryTimer); esRef.current?.close(); };
  }, [addMessages]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleScroll = () => {
    const el = chatRef.current;
    if (!el) return;
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const filteredMsgs = filter ? messages.filter(m => m.actor === filter) : messages;

  // Compute side + showName in one pass
  const rendered: Message[] = filteredMsgs.map((m, i) => {
    const side = computeSide(m, chainFirstActors.current);
    const prev = filteredMsgs[i - 1];
    const showName = !prev || prev.actor !== m.actor ||
      computeSide(prev, chainFirstActors.current) !== side;
    return { ...m, side, showName };
  });

  const a2aCount = messages.filter(m => m.isA2A).length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', background: '#0F172A', color: '#E2E8F0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid #1E293B', padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['chat', 'drafts'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? '#1E293B' : 'transparent',
              border: '1px solid ' + (tab === t ? '#334155' : 'transparent'),
              borderRadius: 8, padding: '5px 14px',
              color: tab === t ? '#E2E8F0' : '#64748B',
              cursor: 'pointer', fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
            }}>
              {t === 'chat' ? '💬 Agent Comms' : '✉️ Drafts'}
            </button>
          ))}
        </div>

        {tab === 'chat' && (
          <>
            {a2aCount > 0 && (
              <span style={{
                background: '#F472B615', color: '#F472B6',
                padding: '2px 9px', borderRadius: 12, fontSize: 11,
                border: '1px solid #F472B630', fontWeight: 700,
              }}>{a2aCount} A2A</span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: connected ? '#00E5A0' : '#FF4B4B',
                  boxShadow: connected ? '0 0 6px #00E5A0' : 'none',
                }} />
                <span style={{ fontSize: 11, color: '#64748B' }}>{connected ? 'Live' : 'Reconnecting'}</span>
              </div>
              <select value={filter} onChange={e => setFilter(e.target.value)} style={{
                background: '#1E293B', border: '1px solid #334155', borderRadius: 6,
                padding: '3px 8px', color: '#CBD5E1', fontSize: 12,
                cursor: 'pointer', outline: 'none',
              }}>
                <option value="">All Agents ({messages.length})</option>
                {actors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Body */}
      {tab === 'drafts' ? <DraftsTab /> : (
        <div ref={chatRef} onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', paddingTop: 14, paddingBottom: 14 }}>
          {loading && (
            <div style={{ textAlign: 'center', color: '#64748B', padding: 40, fontSize: 14 }}>
              Loading agent communications...
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#475569', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
              <div style={{ fontSize: 14 }}>No agent communications yet</div>
              <div style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>
                {connected ? 'SSE connected — waiting for activity' : 'Connecting to live stream...'}
              </div>
            </div>
          )}
          {rendered.map((msg, i) => (
            <ChatBubble key={`${msg.hash || i}-${msg.ts}`} msg={msg} />
          ))}
          <div ref={bottomRef} style={{ height: 1 }} />
        </div>
      )}
    </div>
  );
}
