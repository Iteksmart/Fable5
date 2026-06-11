import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpenText,
  Check,
  Copy,
  FolderKey,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Vault as VaultIcon,
} from "lucide-react";
import clsx from "clsx";
import { Badge, GlassCard, NeonButton, SectionTitle, StatusDot } from "../components/ui";
import { api, type ProviderId, type ProviderInfo } from "../lib/api";

const KEY_ENV: Record<ProviderId, string> = {
  claude: "ANTHROPIC_API_KEY",
  codex: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  nemotron: "NVIDIA_API_KEY",
  octoai: "OCTOAI_API_KEY",
  hermes: "HERMES_API_KEY (optional — local service)",
};

export default function Vault() {
  const [providers, setProviders] = useState<Record<ProviderId, ProviderInfo> | null>(null);
  const [keys, setKeys] = useState<Record<ProviderId, boolean> | null>(null);
  const [reloading, setReloading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.providers().then((p) => {
      setProviders(p.providers);
      setKeys(p.keys);
    }).catch(() => {});
  }, []);

  async function reload() {
    setReloading(true);
    try {
      const r = await api.reloadSecrets();
      setKeys(r.keys);
    } finally {
      setReloading(false);
    }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GlassCard hover={false} className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-purple-600/20 ring-1 ring-amber-400/25">
            <VaultIcon size={22} className="text-amber-300" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Vault &amp; Settings</h1>
            <p className="text-sm text-slate-400">
              Keys live on the OVH server — <code className="font-mono text-xs">~/.secrets</code> or{" "}
              <code className="font-mono text-xs">/opt/itechsmart/vault/secrets.json</code>. They never leave the box.
            </p>
          </div>
        </div>
        <NeonButton onClick={reload} disabled={reloading}>
          <RefreshCw size={14} className={clsx(reloading && "animate-spin")} /> Reload keys
        </NeonButton>
      </GlassCard>

      {/* provider key matrix */}
      <GlassCard className="p-5" delay={0.05}>
        <SectionTitle
          right={<Badge tone="emerald"><ShieldCheck size={11} /> server-side only</Badge>}
        >
          <span className="inline-flex items-center gap-2"><KeyRound size={13} /> Provider Credentials</span>
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {providers &&
            (Object.keys(providers) as ProviderId[]).map((id, i) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass glass-hover flex items-center gap-3 rounded-xl p-4"
              >
                <StatusDot up={keys?.[id] ?? false} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-100">
                    {providers[id].label}
                    <span className="ml-2 text-[11px] font-medium text-slate-500">{providers[id].vendor}</span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{KEY_ENV[id]}</div>
                </div>
                <Badge tone={keys?.[id] ? "emerald" : "rose"}>
                  {keys?.[id] ? "configured" : "missing"}
                </Badge>
              </motion.div>
            ))}
        </div>
      </GlassCard>

      {/* runbook */}
      <GlassCard className="p-5" delay={0.1}>
        <SectionTitle>
          <span className="inline-flex items-center gap-2"><BookOpenText size={13} /> Access Runbook</span>
        </SectionTitle>
        <div className="space-y-3">
          {[
            {
              id: "ssh",
              title: "SSH to the OVH server (Cloudflare Zero Trust only — port 22 is closed)",
              cmd: "ssh ssh.itechsmart.dev",
            },
            {
              id: "claude",
              title: "Launch the agent CLI once connected",
              cmd: "claude",
            },
            {
              id: "status",
              title: "Verify platform connectivity",
              cmd: "curl -s https://api.itechsmart.dev/v1/status/live",
            },
            {
              id: "deploy",
              title: "Run Mission Control on the server (UI + API + terminal bridge)",
              cmd: "npm install && npm run build && PORT=8443 npm start",
            },
            {
              id: "tunnel",
              title: "Expose it via the existing tunnel (add ingress for mission.itechsmart.dev → :8443)",
              cmd: "cloudflared tunnel route dns 3525b90f mission.itechsmart.dev",
            },
          ].map((step) => (
            <div key={step.id} className="glass rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-300">{step.title}</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-ink-950/80 px-3 py-2 font-mono text-xs text-cyan-300">
                  $ {step.cmd}
                </code>
                <button
                  onClick={() => copy(step.cmd, step.id)}
                  className="glass shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
                  title="Copy"
                >
                  {copied === step.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* env reference */}
      <GlassCard className="p-5" delay={0.15}>
        <SectionTitle>
          <span className="inline-flex items-center gap-2"><FolderKey size={13} /> Server Environment Reference</span>
        </SectionTitle>
        <div className="grid gap-2 font-mono text-[12px] text-slate-400 sm:grid-cols-2">
          {[
            ["PORT", "8443 — API + UI port"],
            ["SECRETS_FILE", "~/.secrets (dotenv format)"],
            ["VAULT_FILE", "/opt/itechsmart/vault/secrets.json"],
            ["SSH_TARGET", "ssh.itechsmart.dev"],
            ["HERMES_URL", "http://localhost:8089"],
            ["CF_TUNNEL_ID", "3525b90f"],
            ["SERVICES_JSON", "override NOC probe list"],
            ["DATA_DIR", "business data store location"],
          ].map(([k, v]) => (
            <div key={k} className="glass flex items-center justify-between gap-3 rounded-lg px-3 py-2">
              <span className="text-cyan-300">{k}</span>
              <span className="truncate text-right text-slate-500">{v}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
