import { useEffect, useRef, useState, useCallback } from "react";
import {
  Brain, Search, BookOpen, FileText, Network, Zap, Plus,
  RefreshCw, ChevronDown, ChevronRight, Cpu, Globe, Shield,
  TrendingUp, Database, Server, Star, Clock, Tag, Users,
  ArrowRight, Hash, AlertCircle, CheckCircle, Layers,
  MessageSquare, GitBranch, Eye, BarChart3, Map, Loader2,
} from "lucide-react";

const BRAIN_API = "/api/brain-proxy";

// ── Types ─────────────────────────────────────────────────────────────────
interface BrainNode { id: number; label: string; type: string; team?: string; slug?: string; category?: string; gtype?: string; count?: number; destination?: string; }
interface BrainEdge { source: number; target: number; rel: string; }
interface WikiArticle { id: number; slug: string; title: string; category: string; author: string; tags: string; view_count: number; updated_at: string; }
interface MdFile { path: string; category: string; size: number; updated_at: string; }
interface Note { id: number; agent: string; title: string; body: string; tags: string; created_at: string; }
interface GrowEntry { id: number; agent: string; type: string; title: string; body: string; tags: string; created_at: string; }
interface Route { id: number; name: string; pattern: string; destination: string; method: string; description: string; active: number; }
interface SearchResult { level: number; type: string; path?: string; slug?: string; title?: string; category?: string; snippet?: string; content?: string; agent?: string; source?: string; target?: string; relationship?: string; score?: number; }
interface BrainStats { md_files_indexed: number; wiki_articles: number; notes: number; grow_entries: number; routing_rules: number; agents_registered: number; keeper_runs: number; last_keeper_runs: Record<string, string>; status: string; }

// ── Colors ─────────────────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  agent: "#06b6d4", letta_agent: "#0891b2", wiki: "#3b82f6",
  md_category: "#a855f7", notes: "#10b981", route: "#f59e0b",
  grow: "#ec4899", brain_core: "#f97316", skill: "#8b5cf6", default: "#6b7280",
};
const LEVEL_COLORS = ["#6b7280","#a855f7","#3b82f6","#06b6d4","#10b981","#f59e0b"];
const LEVEL_NAMES = ["All Levels","L1: .md Files","L2: Wiki","L3: Vector DB","L4: Graph","L5: Auto"];

// ── Force simulation ────────────────────────────────────────────────────────
interface SimNode extends BrainNode { x: number; y: number; vx: number; vy: number; }

function useForceGraph(nodes: BrainNode[], edges: BrainEdge[]) {
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!nodes.length) { setSimNodes([]); return; }
    const W = 900, H = 600;
    const sn: SimNode[] = nodes.map((n, i) => ({
      ...n,
      x: W / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * 200 + (Math.random() - 0.5) * 60,
      y: H / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * 200 + (Math.random() - 0.5) * 60,
      vx: 0, vy: 0,
    }));
    const edgeMap: Record<number, number[]> = {};
    edges.forEach(e => { (edgeMap[e.source] ||= []).push(e.target); (edgeMap[e.target] ||= []).push(e.source); });

    let running = true;
    const tick = () => {
      if (!running) return;
      let maxVel = 0;
      for (let i = 0; i < sn.length; i++) {
        let fx = 0, fy = 0;
        // Repulsion
        for (let j = 0; j < sn.length; j++) {
          if (i === j) continue;
          const dx = sn[i].x - sn[j].x, dy = sn[i].y - sn[j].y;
          const d2 = dx * dx + dy * dy + 1;
          const f = 2500 / d2;
          fx += (dx / Math.sqrt(d2)) * f; fy += (dy / Math.sqrt(d2)) * f;
        }
        // Spring attraction for connected nodes
        const neighbors = edgeMap[sn[i].id] || [];
        for (const nid of neighbors) {
          const nb = sn.find(n => n.id === nid);
          if (!nb) continue;
          const dx = nb.x - sn[i].x, dy = nb.y - sn[i].y;
          const d = Math.sqrt(dx * dx + dy * dy) + 1;
          const target = 120;
          const f = (d - target) * 0.04;
          fx += (dx / d) * f; fy += (dy / d) * f;
        }
        // Center gravity
        fx += (W / 2 - sn[i].x) * 0.005;
        fy += (H / 2 - sn[i].y) * 0.005;
        sn[i].vx = (sn[i].vx + fx) * 0.82;
        sn[i].vy = (sn[i].vy + fy) * 0.82;
        sn[i].x = Math.max(30, Math.min(W - 30, sn[i].x + sn[i].vx));
        sn[i].y = Math.max(30, Math.min(H - 30, sn[i].y + sn[i].vy));
        maxVel = Math.max(maxVel, Math.abs(sn[i].vx) + Math.abs(sn[i].vy));
      }
      setSimNodes([...sn]);
      if (maxVel > 0.15) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [nodes.length, edges.length]);

  return simNodes;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BrainPage() {
  const [activeTab, setActiveTab] = useState<"map"|"search"|"wiki"|"md"|"notes"|"routes"|"grow"|"agents">("map");
  const [searchLevel, setSearchLevel] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [mapNodes, setMapNodes] = useState<BrainNode[]>([]);
  const [mapEdges, setMapEdges] = useState<BrainEdge[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>([]);
  const [selectedWikiSlug, setSelectedWikiSlug] = useState<string | null>(null);
  const [wikiReader, setWikiReader] = useState<any>(null);
  const [wikiReaderLoading, setWikiReaderLoading] = useState(false);
  const [mdFiles, setMdFiles] = useState<MdFile[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [growEntries, setGrowEntries] = useState<GrowEntry[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<BrainStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [keeperRunning, setKeeperRunning] = useState("");

  // Forms
  const [noteForm, setNoteForm] = useState({ agent: "", title: "", body: "", tags: "" });
  const [wikiForm, setWikiForm] = useState({ slug: "", title: "", body: "", category: "general", author: "user" });
  const [growForm, setGrowForm] = useState({ agent: "", type: "decision", title: "", body: "", tags: "" });
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showWikiForm, setShowWikiForm] = useState(false);
  const [showGrowForm, setShowGrowForm] = useState(false);

  const simNodes = useForceGraph(activeTab === "map" ? mapNodes : [], activeTab === "map" ? mapEdges : []);

  const apiFetch = async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${BRAIN_API}${path}`, opts);
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json();
  };

  const loadStats = useCallback(async () => {
    try { setStats(await apiFetch("/api/brain/stats")); } catch {}
  }, []);

  const loadMap = useCallback(async () => {
    setMapLoading(true);
    try {
      const d = await apiFetch("/api/brain/map");
      setMapNodes(d.nodes || []);
      setMapEdges(d.edges || []);
    } catch {} finally { setMapLoading(false); }
  }, []);

  useEffect(() => {
    loadStats();
    loadMap();
  }, []);

  useEffect(() => {
    if (activeTab === "wiki") apiFetch("/api/brain/wiki/articles").then(setWikiArticles).catch(() => {});
    if (activeTab === "md") apiFetch("/api/brain/md/list").then(setMdFiles).catch(() => {});
    if (activeTab === "notes") apiFetch("/api/brain/notes").then(setNotes).catch(() => {});
    if (activeTab === "grow") apiFetch("/api/brain/grow").then(setGrowEntries).catch(() => {});
    if (activeTab === "routes") apiFetch("/api/brain/routes").then(setRoutes).catch(() => {});
    if (activeTab === "agents") apiFetch("/api/brain/agents").then(setAgents).catch(() => {});
  }, [activeTab]);

  const loadWikiArticle = async (slug: string) => {
    if (selectedWikiSlug === slug) { setSelectedWikiSlug(null); setWikiReader(null); return; }
    setSelectedWikiSlug(slug);
    setWikiReaderLoading(true);
    try {
      const d = await apiFetch(`/api/brain/wiki/article/${slug}`);
      setWikiReader(d);
    } catch { setWikiReader(null); } finally { setWikiReaderLoading(false); }
  };

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const d = await apiFetch(`/api/brain/search?q=${encodeURIComponent(searchQuery)}&level=${searchLevel}`);
      setSearchResults(d.results || []);
    } catch { setSearchResults([]); } finally { setSearching(false); }
  };

  const saveNote = async () => {
    try {
      await apiFetch("/api/brain/note", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...noteForm, tags: noteForm.tags.split(",").map(t => t.trim()).filter(Boolean) }),
      });
      setShowNoteForm(false); setNoteForm({ agent: "", title: "", body: "", tags: "" });
      apiFetch("/api/brain/notes").then(setNotes).catch(() => {});
    } catch {}
  };

  const saveWiki = async () => {
    try {
      await apiFetch("/api/brain/wiki", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...wikiForm, slug: wikiForm.slug || wikiForm.title.toLowerCase().replace(/[^a-z0-9]+/g,"-") }),
      });
      setShowWikiForm(false); setWikiForm({ slug: "", title: "", body: "", category: "general", author: "user" });
      apiFetch("/api/brain/wiki/articles").then(setWikiArticles).catch(() => {});
    } catch {}
  };

  const saveGrow = async () => {
    try {
      await apiFetch("/api/brain/grow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...growForm, tags: growForm.tags.split(",").map(t => t.trim()).filter(Boolean) }),
      });
      setShowGrowForm(false); setGrowForm({ agent: "", type: "decision", title: "", body: "", tags: "" });
      apiFetch("/api/brain/grow").then(setGrowEntries).catch(() => {});
    } catch {}
  };

  const triggerScan = async () => {
    setScanning(true);
    try { await apiFetch("/api/brain/scan", { method: "POST" }); setTimeout(() => { setScanning(false); loadStats(); }, 3000); }
    catch { setScanning(false); }
  };

  const runKeeper = async (keeper: string) => {
    setKeeperRunning(keeper);
    try { await apiFetch("/api/brain/keeper/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keeper }) }); setTimeout(() => { setKeeperRunning(""); loadStats(); }, 3000); }
    catch { setKeeperRunning(""); }
  };

  // ── Visual Map ─────────────────────────────────────────────────────────
  const MapView = () => (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">Brain Map — {mapNodes.length} nodes, {mapEdges.length} edges</span>
        </div>
        <button onClick={loadMap} className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">
          <RefreshCw size={12} className={mapLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {Object.entries(NODE_COLORS).filter(([k]) => !["default"].includes(k)).slice(0, 8).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1 text-xs text-slate-400">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            {type.replace("_", " ")}
          </div>
        ))}
      </div>

      {/* SVG Graph */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden" style={{ height: 500 }}>
        {mapLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={32} className="animate-spin text-cyan-400" />
          </div>
        ) : (
          <svg width="100%" height="500" viewBox="0 0 900 500">
            {/* Edges */}
            {mapEdges.map((e, i) => {
              const s = simNodes.find(n => n.id === e.source);
              const t = simNodes.find(n => n.id === e.target);
              if (!s || !t) return null;
              return (
                <g key={i}>
                  <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                    stroke="#1e293b" strokeWidth={1} strokeOpacity={0.8} />
                  <text x={(s.x + t.x) / 2} y={(s.y + t.y) / 2 - 3}
                    fontSize={7} fill="#475569" textAnchor="middle">{e.rel}</text>
                </g>
              );
            })}
            {/* Nodes */}
            {simNodes.map(n => {
              const color = NODE_COLORS[n.type] || NODE_COLORS.default;
              const isSelected = selectedNode?.id === n.id;
              const r = n.type === "brain_core" ? 18 : 10;
              return (
                <g key={n.id} style={{ cursor: "pointer" }} onClick={() => setSelectedNode(isSelected ? null : n)}>
                  <circle cx={n.x} cy={n.y} r={r + (isSelected ? 4 : 0)}
                    fill={color} fillOpacity={isSelected ? 1 : 0.8}
                    stroke={isSelected ? "#fff" : color} strokeWidth={isSelected ? 2 : 0} />
                  <text x={n.x} y={n.y + r + 10} fontSize={8} fill="#94a3b8"
                    textAnchor="middle" style={{ pointerEvents: "none" }}>
                    {n.label.slice(0, 20)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Selected Node Detail */}
      {selectedNode && (
        <div className="mt-3 p-3 bg-slate-900 border border-cyan-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[selectedNode.type] || NODE_COLORS.default }} />
            <span className="text-sm font-bold text-white">{selectedNode.label}</span>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{selectedNode.type}</span>
          </div>
          {selectedNode.team && <div className="text-xs text-slate-400">Team: {selectedNode.team}</div>}
          {selectedNode.category && <div className="text-xs text-slate-400">Category: {selectedNode.category}</div>}
          {selectedNode.destination && <div className="text-xs text-slate-400">→ {selectedNode.destination}</div>}
          <div className="text-xs text-slate-500 mt-1">
            Connected to: {mapEdges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length} nodes
          </div>
        </div>
      )}
    </div>
  );

  // ── Search View ────────────────────────────────────────────────────────
  const SearchView = () => (
    <div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Search the brain..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none" />
        </div>
        <select value={searchLevel} onChange={e => setSearchLevel(+e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg text-sm text-white px-3 focus:border-cyan-500 focus:outline-none">
          {LEVEL_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
        </select>
        <button onClick={doSearch} disabled={searching}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
          {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </div>

      {/* Level pills */}
      <div className="flex gap-2 mb-4">
        {LEVEL_NAMES.map((name, i) => (
          <button key={i} onClick={() => setSearchLevel(i)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${searchLevel === i ? "text-white" : "text-slate-400 bg-slate-800 hover:bg-slate-700"}`}
            style={searchLevel === i ? { backgroundColor: LEVEL_COLORS[i] } : {}}>
            {name}
          </button>
        ))}
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 mb-2">{searchResults.length} results</div>
          {searchResults.map((r, i) => (
            <div key={i} className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LEVEL_COLORS[r.level || 0] }} />
                <span className="text-xs text-slate-400">{LEVEL_NAMES[r.level || 0]}</span>
                <span className="text-xs text-slate-600">·</span>
                <span className="text-xs text-slate-400">{r.type}</span>
                {r.score !== undefined && (
                  <span className="ml-auto text-xs text-slate-500">{(r.score * 100).toFixed(0)}%</span>
                )}
              </div>
              {r.title && <div className="text-sm font-semibold text-white">{r.title}</div>}
              {r.path && <div className="text-xs text-cyan-400 font-mono">{r.path}</div>}
              {r.snippet && <div className="text-xs text-slate-300 mt-1" dangerouslySetInnerHTML={{ __html: r.snippet.replace(/\{/g,"<mark class='bg-cyan-900/50 text-cyan-300 px-0.5 rounded'>").replace(/\}/g,"</mark>") }} />}
              {r.content && <div className="text-xs text-slate-300 mt-1">{r.content.slice(0, 120)}...</div>}
              {r.source && <div className="text-xs text-slate-300 mt-1">{r.source} <ArrowRight size={10} className="inline" /> {r.target} <span className="text-slate-500">[{r.relationship}]</span></div>}
            </div>
          ))}
        </div>
      )}
      {searchResults.length === 0 && searchQuery && !searching && (
        <div className="text-center text-slate-500 py-8 text-sm">No results for "{searchQuery}"</div>
      )}
    </div>
  );

  // ── Wiki View ────────────────────────────────────────────────────────
  const WikiView = () => {
    const categories = [...new Set(wikiArticles.map(a => a.category))];
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-white">{wikiArticles.length} Articles</div>
          <button onClick={() => setShowWikiForm(!showWikiForm)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg">
            <Plus size={12} /> New Article
          </button>
        </div>
        {showWikiForm && (
          <div className="mb-4 p-4 bg-slate-900 border border-blue-500/30 rounded-xl space-y-3">
            <input placeholder="Title" value={wikiForm.title} onChange={e => setWikiForm(f => ({...f, title: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
            <input placeholder="Slug (auto)" value={wikiForm.slug} onChange={e => setWikiForm(f => ({...f, slug: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono" />
            <input placeholder="Category" value={wikiForm.category} onChange={e => setWikiForm(f => ({...f, category: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
            <textarea placeholder="Body (markdown)" value={wikiForm.body} onChange={e => setWikiForm(f => ({...f, body: e.target.value}))}
              rows={6} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono" />
            <div className="flex gap-2">
              <button onClick={saveWiki} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">Save Article</button>
              <button onClick={() => setShowWikiForm(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}
        {categories.map(cat => (
          <div key={cat} className="mb-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Tag size={10} /> {cat}
              <span className="text-slate-600">({wikiArticles.filter(a => a.category === cat).length})</span>
            </div>
            <div className="space-y-1">
              {wikiArticles.filter(a => a.category === cat).map(a => (
                <div key={a.id} onClick={() => loadWikiArticle(a.slug)} className="flex items-center gap-3 p-2.5 bg-slate-900 border border-slate-800 rounded-lg hover:border-blue-500/30 cursor-pointer group" style={selectedWikiSlug === a.slug ? {borderColor:"rgba(59,130,246,0.5)",background:"rgba(59,130,246,0.06)"} : {}}>
                  <BookOpen size={13} className="text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{a.title}</div>
                    <div className="text-xs text-slate-500">{a.author} · {new Date(a.updated_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Eye size={10} /> {a.view_count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── Wiki Article Reader ── */}
        {(wikiReader || wikiReaderLoading) && (
          <div className="mt-4 rounded-xl border border-blue-500/30 bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-500/20 bg-blue-950/20">
              <div>
                <div className="text-sm font-bold text-white">{wikiReader?.title ?? "Loading…"}</div>
                {wikiReader && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {wikiReader.author} · {wikiReader.category} · {new Date(wikiReader.updated_at).toLocaleDateString()}
                    {(() => { try { const _t = JSON.parse(wikiReader.tags || '[]'); return Array.isArray(_t) && _t.length > 0 ? <span className="ml-2">{_t.map((t: string) => <span key={t} className="inline-block bg-blue-900/40 text-blue-300 text-xs px-1.5 py-0.5 rounded mr-1">{t}</span>)}</span> : null; } catch { return null; } })()}
                  </div>
                )}
              </div>
              <button
                onClick={() => { setSelectedWikiSlug(null); setWikiReader(null); }}
                className="text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1"
              >
                <Eye size={11} /> Close
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {wikiReaderLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-blue-400" />
                </div>
              ) : (
                <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {wikiReader?.body ?? ""}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── MD Files View ────────────────────────────────────────────────────
  const MdView = () => {
    const categories = [...new Set(mdFiles.map(f => f.category))];
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-white">{mdFiles.length} .md files indexed</div>
          <button onClick={triggerScan} disabled={scanning}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg">
            {scanning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Scan Filesystem
          </button>
        </div>
        {categories.map(cat => (
          <div key={cat} className="mb-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText size={10} /> {cat}
              <span className="text-slate-600">({mdFiles.filter(f => f.category === cat).length} files)</span>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {mdFiles.filter(f => f.category === cat).map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                  <FileText size={11} className="text-purple-400 flex-shrink-0" />
                  <span className="text-slate-300 font-mono truncate flex-1">{f.path.split("/").slice(-2).join("/")}</span>
                  <span className="text-slate-500">{Math.round(f.size / 1024 * 10) / 10}KB</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Notes View ────────────────────────────────────────────────────────
  const NotesView = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-white">{notes.length} Notes</div>
        <button onClick={() => setShowNoteForm(!showNoteForm)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg">
          <Plus size={12} /> New Note
        </button>
      </div>
      {showNoteForm && (
        <div className="mb-4 p-4 bg-slate-900 border border-green-500/30 rounded-xl space-y-3">
          <input placeholder="Agent name" value={noteForm.agent} onChange={e => setNoteForm(f => ({...f, agent: e.target.value}))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
          <input placeholder="Title" value={noteForm.title} onChange={e => setNoteForm(f => ({...f, title: e.target.value}))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
          <textarea placeholder="Body" value={noteForm.body} onChange={e => setNoteForm(f => ({...f, body: e.target.value}))}
            rows={4} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
          <input placeholder="Tags (comma separated)" value={noteForm.tags} onChange={e => setNoteForm(f => ({...f, tags: e.target.value}))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
          <div className="flex gap-2">
            <button onClick={saveNote} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm">Save Note</button>
            <button onClick={() => setShowNoteForm(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {notes.map(n => (
          <div key={n.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-green-400 font-medium">{n.agent}</span>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</span>
            </div>
            <div className="text-sm font-semibold text-white mb-1">{n.title}</div>
            <div className="text-xs text-slate-400">{n.body.slice(0, 200)}{n.body.length > 200 ? "..." : ""}</div>
            {n.tags && JSON.parse(n.tags || "[]").length > 0 && (
              <div className="flex gap-1 mt-2">
                {JSON.parse(n.tags).map((t: string) => (
                  <span key={t} className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Growth View ────────────────────────────────────────────────────────
  const GrowView = () => {
    const TYPE_COLORS: Record<string, string> = { decision: "#06b6d4", product: "#a855f7", reference: "#f59e0b", context: "#10b981" };
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-white">{growEntries.length} Growth Entries</div>
          <button onClick={() => setShowGrowForm(!showGrowForm)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg">
            <TrendingUp size={12} /> Grow Brain
          </button>
        </div>
        {showGrowForm && (
          <div className="mb-4 p-4 bg-slate-900 border border-pink-500/30 rounded-xl space-y-3">
            <input placeholder="Your agent name" value={growForm.agent} onChange={e => setGrowForm(f => ({...f, agent: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
            <select value={growForm.type} onChange={e => setGrowForm(f => ({...f, type: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
              {["decision","product","reference","context"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Title / what you learned" value={growForm.title} onChange={e => setGrowForm(f => ({...f, title: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
            <textarea placeholder="Full details" value={growForm.body} onChange={e => setGrowForm(f => ({...f, body: e.target.value}))}
              rows={4} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
            <input placeholder="Tags (comma separated)" value={growForm.tags} onChange={e => setGrowForm(f => ({...f, tags: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" />
            <div className="flex gap-2">
              <button onClick={saveGrow} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-sm">Save Growth</button>
              <button onClick={() => setShowGrowForm(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {growEntries.map(g => (
            <div key={g.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${TYPE_COLORS[g.type]}20`, color: TYPE_COLORS[g.type] }}>{g.type}</span>
                <span className="text-xs text-slate-400">{g.agent}</span>
                <span className="text-xs text-slate-500 ml-auto">{new Date(g.created_at).toLocaleDateString()}</span>
              </div>
              <div className="text-sm font-semibold text-white">{g.title}</div>
              <div className="text-xs text-slate-400 mt-1">{g.body.slice(0, 150)}{g.body.length > 150 ? "..." : ""}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Routes View ────────────────────────────────────────────────────────
  const RoutesView = () => (
    <div>
      <div className="text-sm font-semibold text-white mb-4">{routes.length} Routing Rules</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-2 px-3 text-slate-400">Name</th>
              <th className="text-left py-2 px-3 text-slate-400">Pattern</th>
              <th className="text-left py-2 px-3 text-slate-400">Destination</th>
              <th className="text-left py-2 px-3 text-slate-400">Method</th>
            </tr>
          </thead>
          <tbody>
            {routes.map(r => (
              <tr key={r.id} className="border-b border-slate-900 hover:bg-slate-900/50">
                <td className="py-2 px-3 text-white font-medium">{r.name}</td>
                <td className="py-2 px-3 text-cyan-400 font-mono">{r.pattern}</td>
                <td className="py-2 px-3 text-slate-300 font-mono text-xs">{r.destination}</td>
                <td className="py-2 px-3"><span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-xs">{r.method}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Agents View ────────────────────────────────────────────────────────
  const AgentsView = () => {
    const teams = [...new Set(agents.map(a => a.team))];
    return (
      <div>
        <div className="text-sm font-semibold text-white mb-4">{agents.length} Agents Registered</div>
        {teams.map(team => (
          <div key={team} className="mb-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{team}</div>
            <div className="space-y-1">
              {agents.filter(a => a.team === team).map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{a.name}</div>
                    <div className="text-xs text-slate-500">{a.type}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {JSON.parse(a.capabilities || "[]").slice(0, 3).map((c: string) => (
                      <span key={c} className="text-xs bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };


  const FourCsView = () => {
    const CS = [
      { num: "C1", name: "Context", desc: "What is happening now? What do we know?", layer: "L1 .md + L2 Wiki", color: "#a855f7", action: "GET /api/brain/search?q=TOPIC" },
      { num: "C2", name: "Connections", desc: "How does this relate to everything else?", layer: "L4 Knowledge Graph", color: "#06b6d4", action: "GET /api/brain/graph/knowledge?root=TOPIC" },
      { num: "C3", name: "Capabilities", desc: "What can I do? What skills exist?", layer: "Agent Registry + SKILL.md", color: "#10b981", action: "GET /api/brain/agents" },
      { num: "C4", name: "Cadence", desc: "When do I act? How often do I check in?", layer: "L5 Keeper Agents + Timers", color: "#f59e0b", action: "POST /api/brain/invocation" },
    ];
    const PROTOCOL = [
      "1. Read BRAIN.md (bootstrap - you are doing this now)",
      "2. POST /api/brain/invocation - announce yourself, log context",
      "3. GET /api/brain/search?q=YOUR_TASK - get Context (C1)",
      "4. GET /api/brain/graph/knowledge?root=YOUR_TASK - check Connections (C2)",
      "5. GET /api/brain/agents - check Capabilities (C3)",
      "6. Act with Cadence (C4) - seal every action with ProofLink",
    ];
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white mb-1">The Four Cs — How the Brain Thinks</h2>
          <p className="text-sm text-slate-400">Every agent runs these four checks before acting. The brain is organized around them.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {CS.map(c => (
            <div key={c.num} className="p-4 bg-slate-900 border rounded-xl transition-colors" style={{ borderColor: c.color + "40" }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ backgroundColor: c.color }}>
                  {c.num}
                </div>
                <div>
                  <div className="text-base font-bold text-white">{c.name}</div>
                  <div className="text-xs font-mono" style={{ color: c.color }}>{c.layer}</div>
                </div>
              </div>
              <p className="text-sm text-slate-300 mb-3">{c.desc}</p>
              <code className="text-xs bg-slate-800 text-cyan-400 px-2 py-1 rounded block">{c.action}</code>
            </div>
          ))}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-sm font-bold text-white">Four Cs Invocation Protocol</span>
            <span className="text-xs text-slate-500 ml-2">30-second brain check every agent runs on startup</span>
          </div>
          <div className="space-y-2">
            {PROTOCOL.map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                <code className="text-slate-300 font-mono text-xs">{step}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };


  const KnowledgeGraphView = () => {
    const [kgNodes, setKgNodes] = useState<BrainNode[]>([]);
    const [kgEdges, setKgEdges] = useState<BrainEdge[]>([]);
    const [kgLoading, setKgLoading] = useState(false);
    const [kgFilter, setKgFilter] = useState("");
    const [showForms, setShowForms] = useState(false);
    const [addNodeForm, setAddNodeForm] = useState({ label: "", type: "concept" });
    const [addEdgeForm, setAddEdgeForm] = useState({ source_label: "", target_label: "", relationship: "RELATED_TO" });

    const NODE_TYPE_COLORS: Record<string, string> = {
      agent: "#06b6d4", team: "#3b82f6", wiki_category: "#a855f7",
      route: "#f59e0b", concept: "#10b981", product: "#ec4899",
      service: "#f97316", document: "#8b5cf6", decision: "#ef4444",
      skill: "#14b8a6", brain_core: "#f97316",
    };

    const loadKg = async () => {
      setKgLoading(true);
      try {
        const d = await apiFetch("/api/brain/graph/knowledge");
        setKgNodes(d.nodes || []);
        setKgEdges(d.edges || []);
      } catch {} finally { setKgLoading(false); }
    };

    useEffect(() => { loadKg(); }, []);

    const kgSim = useForceGraph(kgNodes, kgEdges);

    const addNode = async () => {
      try {
        await apiFetch("/api/brain/graph/node", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addNodeForm) });
        setAddNodeForm({ label: "", type: "concept" }); loadKg();
      } catch {}
    };
    const addEdge = async () => {
      try {
        await apiFetch("/api/brain/graph/edge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addEdgeForm) });
        setAddEdgeForm({ source_label: "", target_label: "", relationship: "RELATED_TO" }); loadKg();
      } catch {}
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Knowledge Graph — C2: Connections</h2>
            <p className="text-xs text-slate-400">{kgNodes.length} nodes · {kgEdges.length} edges · Brain DB + Neo4j</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForms(!showForms)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:border-cyan-500/40">
              <Plus size={11} /> Add
            </button>
            <button onClick={loadKg} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg">
              <RefreshCw size={11} className={kgLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {showForms && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-slate-900 border border-cyan-500/20 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-cyan-400">Add Knowledge Node</div>
              <input placeholder="Label (e.g. Shield Product)" value={addNodeForm.label} onChange={e => setAddNodeForm(f => ({...f, label: e.target.value}))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white" />
              <select value={addNodeForm.type} onChange={e => setAddNodeForm(f => ({...f, type: e.target.value}))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white">
                {["concept","agent","product","service","document","decision","skill","team"].map(t => <option key={t}>{t}</option>)}
              </select>
              <button onClick={addNode} className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs">Add to Graph</button>
            </div>
            <div className="p-3 bg-slate-900 border border-purple-500/20 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-purple-400">Add Relationship</div>
              <input placeholder="From (label)" value={addEdgeForm.source_label} onChange={e => setAddEdgeForm(f => ({...f, source_label: e.target.value}))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white" />
              <input placeholder="To (label)" value={addEdgeForm.target_label} onChange={e => setAddEdgeForm(f => ({...f, target_label: e.target.value}))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white" />
              <input placeholder="Relationship (USES, MANAGES, PRODUCES)" value={addEdgeForm.relationship} onChange={e => setAddEdgeForm(f => ({...f, relationship: e.target.value}))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white" />
              <button onClick={addEdge} className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs">Add Relationship</button>
            </div>
          </div>
        )}

        {/* Node type legend */}
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(NODE_TYPE_COLORS).slice(0, 9).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {type}
            </div>
          ))}
        </div>

        <div className="bg-slate-950 rounded-xl border border-slate-800" style={{ height: 420 }}>
          {kgLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 size={28} className="animate-spin text-cyan-400" /></div>
          ) : (
            <svg width="100%" height="420" viewBox="0 0 900 420">
              {kgEdges.map((e, i) => {
                const s = kgSim.find(n => n.id === e.source);
                const t = kgSim.find(n => n.id === e.target);
                if (!s || !t) return null;
                return (
                  <g key={i}>
                    <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#1e3a5f" strokeWidth={1.5} strokeOpacity={0.7} />
                    <text x={(s.x+t.x)/2} y={(s.y+t.y)/2-3} fontSize={7} fill="#334155" textAnchor="middle">{e.rel}</text>
                  </g>
                );
              })}
              {kgSim.map(n => {
                const color = NODE_TYPE_COLORS[n.type] || "#6b7280";
                return (
                  <g key={n.id}>
                    <circle cx={n.x} cy={n.y} r={n.gtype === "brain" && n.type === "team" ? 14 : 9} fill={color} fillOpacity={0.85} />
                    <text x={n.x} y={n.y + 19} fontSize={8} fill="#94a3b8" textAnchor="middle" style={{ pointerEvents: "none" }}>
                      {n.label.slice(0, 16)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {(["agent","team","wiki_category","route"] as const).map(type => {
            const count = kgNodes.filter(n => n.type === type).length;
            return (
              <div key={type} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-center">
                <div className="text-lg font-bold" style={{ color: NODE_TYPE_COLORS[type] }}>{count}</div>
                <div className="text-xs text-slate-500">{type}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };


  const TABS = [
    { id: "map", label: "Brain Map", icon: Network },
    { id: "search", label: "Search", icon: Search },
    { id: "wiki", label: "Wiki (L2)", icon: BookOpen },
    { id: "md", label: ".md Files (L1)", icon: FileText },
    { id: "notes", label: "Notes", icon: MessageSquare },
    { id: "grow", label: "Grow", icon: TrendingUp },
    { id: "routes", label: "Routes", icon: Globe },
    { id: "agents", label: "Agents", icon: Users },
    { id: "graph", label: "Knowledge Graph", icon: GitBranch },
    { id: "four-cs", label: "Four Cs", icon: Layers },
  ] as const;

  const KEEPERS = ["brain-keeper", "md-keeper", "wiki-keeper", "vector-keeper"];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Brain className="text-cyan-400" size={28} />
          <h1 className="text-2xl font-bold text-white">Agent Brain</h1>
          <span className="text-xs bg-cyan-900/30 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full ml-2">
            iTechSmart Inc. Knowledge System
          </span>
        </div>
        <p className="text-slate-400 text-sm">5-layer memory: L1 .md Files → L2 Wiki → L3 Vector DB → L4 Graph → L5 Auto-Consolidation</p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          {[
            { label: ".md Files", value: stats.md_files_indexed, color: "text-purple-400", icon: FileText },
            { label: "Wiki Articles", value: stats.wiki_articles, color: "text-blue-400", icon: BookOpen },
            { label: "Notes", value: stats.notes, color: "text-green-400", icon: MessageSquare },
            { label: "Growth", value: stats.grow_entries, color: "text-pink-400", icon: TrendingUp },
            { label: "Routes", value: stats.routing_rules, color: "text-yellow-400", icon: Globe },
            { label: "Agents", value: stats.agents_registered, color: "text-cyan-400", icon: Users },
            { label: "Keeper Runs", value: stats.keeper_runs, color: "text-orange-400", icon: Cpu },
            { label: "Status", value: stats.status === "operational" ? "OK" : "ERR", color: stats.status === "operational" ? "text-green-400" : "text-red-400", icon: CheckCircle },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col">
              <div className="flex items-center gap-1 mb-1">
                <s.icon size={11} className="text-slate-500" />
                <span className="text-xs text-slate-500">{s.label}</span>
              </div>
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Keeper controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        {KEEPERS.map(k => (
          <button key={k} onClick={() => runKeeper(k)} disabled={keeperRunning === k}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-cyan-500/40 text-slate-300 rounded-lg transition-colors">
            {keeperRunning === k ? <Loader2 size={11} className="animate-spin" /> : <Cpu size={11} className="text-cyan-400" />}
            {k}
            {stats?.last_keeper_runs[k] && stats.last_keeper_runs[k] !== "never" && (
              <span className="text-slate-600 ml-1">· {new Date(stats.last_keeper_runs[k]).toLocaleTimeString()}</span>
            )}
          </button>
        ))}
        <button onClick={loadStats} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-cyan-500/40 text-slate-400 rounded-lg">
          <RefreshCw size={11} /> Refresh Stats
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left: Tab navigation */}
        <div className="xl:col-span-1">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  activeTab === t.id ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}>
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Level guide */}
          <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Memory Levels</div>
            {LEVEL_NAMES.slice(1).map((name, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: LEVEL_COLORS[i+1] }}>{i+1}</span>
                <span className="text-xs text-slate-300">{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Content */}
        <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-5">
          {activeTab === "map" && <MapView />}
          {activeTab === "search" && <SearchView />}
          {activeTab === "wiki" && <WikiView />}
          {activeTab === "md" && <MdView />}
          {activeTab === "notes" && <NotesView />}
          {activeTab === "grow" && <GrowView />}
          {activeTab === "routes" && <RoutesView />}
          {activeTab === "agents" && <AgentsView />}
          {activeTab === "graph" && <KnowledgeGraphView />}
          {activeTab === "four-cs" && <FourCsView />}
        </div>
      </div>
    </div>
  );
}
