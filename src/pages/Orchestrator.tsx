import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  ChevronDown,
  CircleStop,
  Eraser,
  Send,
  Sparkles,
  SplitSquareHorizontal,
} from "lucide-react";
import clsx from "clsx";
import { Badge, GlassCard, NeonButton, StatusDot } from "../components/ui";
import {
  api,
  streamChat,
  type ChatMessage,
  type ProviderId,
  type ProviderInfo,
} from "../lib/api";

const PROVIDER_COLORS: Record<ProviderId, string> = {
  claude: "#d97757",
  codex: "#10a37f",
  gemini: "#4285f4",
  nemotron: "#76b900",
  octoai: "#22d3ee",
  hermes: "#a855f7",
};

const QUICK_PROMPTS = [
  "Summarize today's open tickets and recommend a triage order.",
  "Draft a client-facing RFO for the Crestline ransomware canary event.",
  "Write an Ansible playbook to patch all Ubuntu fleet servers safely.",
  "Generate a QBR talking-points doc for Atlas Manufacturing.",
];

interface Turn extends ChatMessage {
  provider?: ProviderId;
  ms?: number;
  error?: string;
}

export default function Orchestrator() {
  const [params] = useSearchParams();
  const [providers, setProviders] = useState<Record<ProviderId, ProviderInfo> | null>(null);
  const [keys, setKeys] = useState<Record<ProviderId, boolean> | null>(null);
  const [provider, setProvider] = useState<ProviderId>(
    (params.get("provider") as ProviderId) || "claude"
  );
  const [model, setModel] = useState<string>("");
  const [system, setSystem] = useState(
    "You are the iTechSmart MSP operations copilot. Be precise, practical, and concise. You support a managed-services business running on an OVH server behind Cloudflare Zero Trust."
  );
  const [compare, setCompare] = useState(false);
  const [compareWith, setCompareWith] = useState<ProviderId>("nemotron");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .providers()
      .then((p) => {
        setProviders(p.providers);
        setKeys(p.keys);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (providers) setModel(providers[provider]?.defaultModel ?? "");
  }, [provider, providers]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function runOne(target: ProviderId, history: ChatMessage[], slot: number) {
    let acc = "";
    const res = await streamChat(
      {
        provider: target,
        model: target === provider ? model : undefined,
        system,
        messages: history,
      },
      (d) => {
        acc += d;
        setTurns((t) => {
          const copy = [...t];
          copy[slot] = { ...copy[slot], content: acc };
          return copy;
        });
      },
      abortRef.current?.signal
    );
    setTurns((t) => {
      const copy = [...t];
      copy[slot] = { ...copy[slot], ms: res.ms, error: res.error };
      return copy;
    });
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    abortRef.current = new AbortController();

    const history: ChatMessage[] = [
      ...turns.filter((t) => !t.error).map(({ role, content }) => ({ role, content })),
      { role: "user", content },
    ];

    const base: Turn[] = [...turns, { role: "user", content }];
    const slots: number[] = [];
    const targets: ProviderId[] = compare ? [provider, compareWith] : [provider];
    for (const p of targets) {
      slots.push(base.length);
      base.push({ role: "assistant", content: "", provider: p });
    }
    setTurns(base);

    try {
      await Promise.all(targets.map((p, i) => runOne(p, history, slots[i])));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setBusy(false);
  }

  const ready = keys?.[provider] ?? false;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
      {/* control deck */}
      <GlassCard hover={false} className="shrink-0 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <BrainCircuit size={18} className="text-cyan-400" />
            <span className="text-sm font-bold text-white">AI Orchestrator</span>
          </div>

          {/* provider pills */}
          <div className="flex flex-wrap gap-1.5">
            {providers &&
              (Object.keys(providers) as ProviderId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => setProvider(id)}
                  className={clsx(
                    "relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                    provider === id
                      ? "border-transparent text-white"
                      : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200"
                  )}
                  style={
                    provider === id
                      ? {
                          background: `linear-gradient(135deg, ${PROVIDER_COLORS[id]}33, ${PROVIDER_COLORS[id]}11)`,
                          boxShadow: `0 0 16px ${PROVIDER_COLORS[id]}40`,
                          borderColor: `${PROVIDER_COLORS[id]}66`,
                        }
                      : undefined
                  }
                >
                  <StatusDot up={keys?.[id] ?? false} size={6} />
                  {providers[id].label}
                </button>
              ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* model select */}
            {providers && (
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="glass appearance-none rounded-xl py-1.5 pl-3 pr-8 font-mono text-xs text-slate-300 outline-none hover:border-cyan-400/30"
                >
                  {providers[provider]?.models.map((m) => (
                    <option key={m} value={m} className="bg-ink-800">
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-2 text-slate-500" />
              </div>
            )}
            <button
              onClick={() => setCompare((v) => !v)}
              title="Compare two models side by side"
              className={clsx(
                "glass flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                compare ? "border-purple-400/50 text-purple-300" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <SplitSquareHorizontal size={13} /> Compare
            </button>
            {compare && providers && (
              <select
                value={compareWith}
                onChange={(e) => setCompareWith(e.target.value as ProviderId)}
                className="glass appearance-none rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none"
              >
                {(Object.keys(providers) as ProviderId[])
                  .filter((p) => p !== provider)
                  .map((p) => (
                    <option key={p} value={p} className="bg-ink-800">
                      vs {providers[p].label}
                    </option>
                  ))}
              </select>
            )}
            <button
              onClick={() => setTurns([])}
              title="Clear conversation"
              className="glass rounded-xl p-2 text-slate-400 transition-colors hover:text-rose-300"
            >
              <Eraser size={14} />
            </button>
          </div>
        </div>

        {!ready && keys && (
          <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
            No API key detected for this provider. Add it to <code className="font-mono">~/.secrets</code> or
            the vault on the OVH server, then reload keys from Vault &amp; Settings.
          </div>
        )}
      </GlassCard>

      {/* transcript */}
      <GlassCard hover={false} className="flex min-h-0 flex-1 flex-col p-0">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <motion.div
                animate={{ rotate: [0, 6, -6, 0] }}
                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-600/20 ring-1 ring-white/10"
              >
                <Sparkles size={26} className="text-cyan-300" />
              </motion.div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">Command your AI fleet</div>
                <div className="mt-1 text-sm text-slate-400">
                  Route work to Claude, Codex, Gemini, Nemotron, Hermes or OctoAI — or compare two side-by-side.
                </div>
              </div>
              <div className="grid max-w-2xl gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="glass glass-hover rounded-xl px-4 py-3 text-left text-xs text-slate-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {turns.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={clsx("flex", t.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={clsx(
                    "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    t.role === "user"
                      ? "bg-gradient-to-br from-cyan-500/25 to-purple-600/20 text-white ring-1 ring-cyan-400/20"
                      : "glass text-slate-200"
                  )}
                >
                  {t.role === "assistant" && (
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: PROVIDER_COLORS[t.provider ?? "claude"] }}
                      />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {t.provider}
                      </span>
                      {t.ms != null && (
                        <Badge tone="cyan">{(t.ms / 1000).toFixed(1)}s</Badge>
                      )}
                    </div>
                  )}
                  {t.error ? (
                    <span className="text-rose-300">⚠ {t.error}</span>
                  ) : t.content ? (
                    <span className="whitespace-pre-wrap">{t.content}</span>
                  ) : (
                    <span className="shimmer-text">thinking…</span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* composer */}
        <div className="border-t border-white/[0.07] p-4">
          <div className="glass flex items-end gap-2 rounded-2xl p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={Math.min(5, Math.max(1, input.split("\n").length))}
              placeholder={`Message ${providers?.[provider]?.label ?? "AI"}${compare ? ` + ${providers?.[compareWith]?.label}` : ""}…  (Enter to send)`}
              className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />
            {busy ? (
              <NeonButton variant="danger" onClick={stop}>
                <CircleStop size={15} /> Stop
              </NeonButton>
            ) : (
              <NeonButton onClick={() => send()} disabled={!input.trim()}>
                <Send size={15} /> Send
              </NeonButton>
            )}
          </div>
          <details className="mt-2 px-1">
            <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
              System prompt
            </summary>
            <textarea
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={2}
              className="glass mt-2 w-full resize-none rounded-xl p-3 text-xs text-slate-300 outline-none"
            />
          </details>
        </div>
      </GlassCard>
    </div>
  );
}
