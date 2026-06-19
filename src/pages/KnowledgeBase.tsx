import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Search,
  ChevronRight,
  X,
  Tag,
  User,
  RefreshCw,
  Loader2,
  FileText,
} from "lucide-react";

interface Article {
  slug: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  author: string;
  updated_at?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  company:      { bg: "bg-purple-500/10",  text: "text-purple-300",  border: "border-purple-500/25" },
  architecture: { bg: "bg-blue-500/10",    text: "text-blue-300",    border: "border-blue-500/25" },
  prooflink:    { bg: "bg-green-500/10",   text: "text-green-300",   border: "border-green-500/25" },
  compliance:   { bg: "bg-yellow-500/10",  text: "text-yellow-300",  border: "border-yellow-500/25" },
  security:     { bg: "bg-red-500/10",     text: "text-red-300",     border: "border-red-500/25" },
  infrastructure: { bg: "bg-cyan-500/10", text: "text-cyan-300",    border: "border-cyan-500/25" },
  ai:           { bg: "bg-violet-500/10",  text: "text-violet-300",  border: "border-violet-500/25" },
  agents:       { bg: "bg-indigo-500/10",  text: "text-indigo-300",  border: "border-indigo-500/25" },
  integrations: { bg: "bg-orange-500/10",  text: "text-orange-300",  border: "border-orange-500/25" },
  platform:     { bg: "bg-teal-500/10",    text: "text-teal-300",    border: "border-teal-500/25" },
  default:      { bg: "bg-slate-500/10",   text: "text-slate-300",   border: "border-slate-500/25" },
};

function catStyle(cat: string) {
  return CATEGORY_COLORS[cat?.toLowerCase()] ?? CATEGORY_COLORS.default;
}

function CategoryBadge({ cat }: { cat: string }) {
  const s = catStyle(cat);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${s.bg} ${s.text} ${s.border} capitalize`}>
      {cat}
    </span>
  );
}

function ArticleReader({ article, onClose }: { article: Article; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  function renderBody(text: string) {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("# "))  return <h2 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(2)}</h2>;
      if (line.startsWith("## ")) return <h3 key={i} className="text-base font-semibold text-cyan-300 mt-3 mb-1">{line.slice(3)}</h3>;
      if (line.startsWith("### ")) return <h4 key={i} className="text-sm font-semibold text-violet-300 mt-2 mb-1">{line.slice(4)}</h4>;
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return <li key={i} className="text-sm text-slate-300 ml-4 list-disc">{line.slice(2)}</li>;
      }
      if (/^\d+\./.test(line)) {
        return <li key={i} className="text-sm text-slate-300 ml-4 list-decimal">{line.replace(/^\d+\.\s*/, "")}</li>;
      }
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm text-slate-300 leading-relaxed">{line}</p>;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
      <div
        ref={ref}
        className="h-full w-full max-w-2xl overflow-y-auto bg-slate-900 border-l border-slate-700 shadow-2xl"
      >
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CategoryBadge cat={article.category} />
            </div>
            <h2 className="text-lg font-bold text-white leading-snug">{article.title}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
              {article.author && (
                <span className="flex items-center gap-1"><User size={10} />{article.author}</span>
              )}
              {article.tags?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Tag size={10} />{article.tags.slice(0, 3).join(", ")}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-white transition-colors mt-1">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-1">
          {renderBody(article.body || "")}
        </div>
        {article.tags?.length > 0 && (
          <div className="px-6 pb-8 flex flex-wrap gap-1.5">
            {article.tags.map(t => (
              <span key={t} className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 rounded px-2 py-0.5">#{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Article | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = () => {
    setLoading(true);
    setError(null);
    fetch("/api/kb/articles")
      .then(r => r.json())
      .then(d => setArticles(d.articles || []))
      .catch(() => setError("Failed to load knowledge base."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) { loadAll(); return; }
    searchTimer.current = setTimeout(() => {
      setSearching(true);
      fetch(`/api/kb/search?q=${encodeURIComponent(search.trim())}`)
        .then(r => r.json())
        .then(d => { setArticles(d.results || []); setActiveCategory(null); })
        .catch(() => setError("Search failed."))
        .finally(() => setSearching(false));
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const categories = Array.from(new Set(articles.map(a => a.category).filter(Boolean))).sort();

  const displayed = activeCategory
    ? articles.filter(a => a.category === activeCategory)
    : articles;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-cyan-400" />
            Knowledge Base
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {articles.length} article{articles.length !== 1 ? "s" : ""} in the iTechSmart wiki
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* search */}
      <div className="relative max-w-lg">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400 animate-spin" />}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search articles, topics, tags…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
        />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="flex gap-6">
        {/* category sidebar */}
        {!search.trim() && (
          <aside className="w-44 shrink-0 space-y-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                !activeCategory ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              All Articles
              <span className="ml-1 text-slate-500 font-normal">({articles.length})</span>
            </button>
            {categories.map(cat => {
              const count = articles.filter(a => a.category === cat).length;
              const s = catStyle(cat);
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(isActive ? null : cat)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
                    isActive ? `${s.bg} ${s.text} border ${s.border}` : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {cat}
                  <span className="ml-1 font-normal opacity-60">({count})</span>
                </button>
              );
            })}
          </aside>
        )}

        {/* article grid */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 size={22} className="animate-spin mr-2" />
              <span className="text-sm">Loading articles…</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <FileText size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "No articles match your search." : "No articles yet."}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {displayed.map(article => {
                const s = catStyle(article.category);
                return (
                  <button
                    key={article.slug}
                    onClick={() => setSelected(article)}
                    className="text-left bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-4 space-y-2 transition-all hover:bg-slate-800/80 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <CategoryBadge cat={article.category} />
                      <ChevronRight size={13} className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 mt-0.5" />
                    </div>
                    <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-cyan-100 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {article.body?.split("\n").find(l => l.trim() && !l.startsWith("#")) || ""}
                    </p>
                    {article.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {article.tags.slice(0, 3).map(t => (
                          <span key={t} className="text-[9px] bg-slate-700/60 text-slate-500 rounded px-1.5 py-0.5">#{t}</span>
                        ))}
                      </div>
                    )}
                    {article.author && (
                      <div className="text-[9px] text-slate-600 flex items-center gap-1 pt-0.5">
                        <User size={9} />{article.author}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selected && <ArticleReader article={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
