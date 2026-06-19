import { useState, useEffect } from "react";
import {
  FileText,
  File,
  Presentation,
  Download,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
} from "lucide-react";

type DocType = "Training Memo" | "SOP" | "Custom Report" | "Policy Document" | "Incident Report" | "Meeting Notes";
type OutputFormat = "pdf" | "docx" | "pptx";

interface GenerateResult {
  filename: string;
  title: string;
  sections: number;
  format: string;
}

interface DocFile {
  filename: string;
  size: number;
  created: number;
}

const DOC_TYPES: DocType[] = ["Training Memo", "SOP", "Custom Report", "Policy Document", "Incident Report", "Meeting Notes"];

const FORMAT_META: Record<OutputFormat, { icon: typeof FileText; color: string; bg: string; border: string; label: string }> = {
  pdf:  { icon: FileText,     color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/50",    label: "PDF" },
  docx: { icon: File,         color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/50",   label: "DOCX" },
  pptx: { icon: Presentation, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/50", label: "PPTX" },
};

function FormatBadge({ format }: { format: string }) {
  const m = FORMAT_META[format as OutputFormat] || FORMAT_META.pdf;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${m.bg} ${m.color} border ${m.border}`}>
      <Icon size={11} />{m.label}
    </span>
  );
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fileExt(fn: string): string {
  return fn.split(".").pop()?.toLowerCase() || "pdf";
}

export default function DocsPage() {
  const [docType, setDocType] = useState<DocType>("SOP");
  const [format, setFormat] = useState<OutputFormat>("pdf");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DocFile[]>([]);

  const loadHistory = () => {
    fetch("/api/docgen/list").then(r => r.json()).then(d => setHistory(d.files || [])).catch(() => {});
  };

  useEffect(() => { loadHistory(); }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError("Please enter a prompt describing the document."); return; }
    setGenerating(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/docgen/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), format, docType, title: title.trim() || undefined }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); } else { setResult(d); loadHistory(); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally { setGenerating(false); }
  };

  return (
    <div className="flex h-full min-h-screen bg-slate-900 text-slate-100">
      {/* Sidebar — Recent Docs */}
      <aside className="w-72 shrink-0 border-r border-slate-700 bg-slate-800/50 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-700 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-300">Recent Documents</span>
          <span className="ml-auto text-xs text-slate-500">{history.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {history.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs">No documents yet.</div>
          )}
          {history.map(doc => (
            <div key={doc.filename} className="mx-2 my-1 p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors group">
              <p className="text-xs font-medium text-slate-200 line-clamp-2 mb-1.5">
                {doc.filename.replace(/_\d{13}\.(pdf|docx|pptx)$/, "").replace(/_/g, " ")}
              </p>
              <div className="flex items-center gap-2 mb-2">
                <FormatBadge format={fileExt(doc.filename)} />
                <span className="text-xs text-slate-500">{fmtSize(doc.size)}</span>
              </div>
              <p className="text-xs text-slate-600 mb-2">{fmtDate(doc.created)}</p>
              <a
                href={`/api/docgen/download/${encodeURIComponent(doc.filename)}`}
                download
                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                <Download size={11} />Download
              </a>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Sparkles size={20} className="text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">AI Document Generator</h1>
          </div>
          <p className="text-slate-400 text-sm ml-12">Generate professional SOPs, reports, policies, training memos and more.</p>
        </div>

        <div className="max-w-3xl space-y-5">
          {/* Step 1: Type */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">1 · Document Type</h2>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map(dt => (
                <button key={dt} onClick={() => setDocType(dt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    docType === dt ? "bg-cyan-500/20 border-cyan-500 text-cyan-300" : "bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  }`}>
                  {dt}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Format */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">2 · Output Format</h2>
            <div className="flex gap-3">
              {(Object.entries(FORMAT_META) as [OutputFormat, typeof FORMAT_META[OutputFormat]][]).map(([f, m]) => {
                const Icon = m.icon;
                return (
                  <button key={f} onClick={() => setFormat(f)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      format === f ? `${m.bg} ${m.border} ${m.color}` : "bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    }`}>
                    <Icon size={15} />{m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Prompt */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">3 · Describe Your Document</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Custom Title <span className="text-slate-600">(optional)</span></label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Incident Response SOP v2.0"
                className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-all" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Prompt <span className="text-red-400">*</span></label>
              <textarea rows={5} value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder={`Describe what you want in this ${docType}. Include key topics, audience, and any specific requirements…`}
                className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-all resize-none" />
            </div>
          </div>

          {/* Generate */}
          <button onClick={handleGenerate} disabled={generating}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm transition-all shadow-lg shadow-cyan-900/30">
            {generating ? <><Loader2 size={17} className="animate-spin" />Generating… (15–30 seconds)</> : <><Sparkles size={17} />Generate Document</>}
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-slate-800 border border-green-500/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={18} className="text-green-400" />
                <span className="text-green-400 font-semibold text-sm">Document Ready</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <p className="text-white font-semibold text-base truncate">{result.title || result.filename}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <FormatBadge format={result.format} />
                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">{docType}</span>
                    {result.sections > 0 && <span className="text-xs text-slate-400">{result.sections} sections</span>}
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{result.filename}</p>
                </div>
                <a href={`/api/docgen/download/${encodeURIComponent(result.filename)}`} download
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-all shrink-0">
                  <Download size={15} />Download
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
