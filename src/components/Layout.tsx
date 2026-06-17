import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Target,
  LayoutDashboard,
  BrainCircuit,
  TerminalSquare,
  Radar,
  Briefcase,
  KeyRound,
  Search,
  Command,
  Zap,
  CloudCog,
  DollarSign,
  ClipboardList,
  TrendingUp,
  Rocket,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Lock,
  Bot,
  MessageSquare,
  CheckSquare,
  Wand2,
  Settings,
  Building2,
} from "lucide-react";
import clsx from "clsx";
import { Background, NeonButton, StatusDot } from "./ui";
import { api, getToken, setToken, type TunnelInfo } from "../lib/api";

const NAV = [
  { to: "/", label: "Mission Control", icon: LayoutDashboard, kbd: "1" },
  { to: "/orchestrator", label: "AI Fleet", icon: BrainCircuit, kbd: "2" },
  { to: "/terminal", label: "Terminal", icon: TerminalSquare, kbd: "3" },
  { to: "/noc", label: "Autonomous NOC", icon: Radar, kbd: "4" },
  { to: "/business", label: "MSP Business", icon: Briefcase, kbd: "5" },
  { to: "/revenue", label: "Revenue", icon: DollarSign, kbd: "6" },
  { to: "/audit", label: "Audit", icon: ClipboardList, kbd: "7" },
  { to: "/leads", label: "Leads & Pipeline", icon: Target, kbd: "L" },
  { to: "/pipeline", label: "Pipeline", icon: TrendingUp, kbd: "8" },
  { to: "/fundraise", label: "Fundraise", icon: Rocket, kbd: "9" },
  { to: "/compliance", label: "Compliance", icon: ShieldCheck, kbd: "0" },
  { to: "/vault", label: "Vault & Settings", icon: KeyRound, kbd: "-" },
  { to: "/shield", label: "Shield", icon: Lock, kbd: "S" },
  { to: "/devices", label: "Devices", icon: Monitor, kbd: "D" },
  { to: "/tenants", label: "Tenants", icon: Building2, kbd: "T" },
  { to: "/agents", label: "Agents", icon: Bot, kbd: "A" },
  { to: "/comms", label: "Agent Comms", icon: MessageSquare, kbd: "C" },
  { to: "/approvals", label: "Approvals", icon: CheckSquare, kbd: "P" },
  { to: "/ai-studio", label: "AI Studio", icon: Wand2, kbd: "I" },
  { to: "/admin", label: "Admin", icon: Settings, kbd: "G" },
];

export default function Layout() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tunnel, setTunnel] = useState<TunnelInfo | null>(null);
  const [clock, setClock] = useState(new Date());
  const [selftest, setSelftest] = useState<{ ok: boolean } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    api.tunnel().then(setTunnel).catch(() => {});
    const t2 = setInterval(() => api.tunnel().then(setTunnel).catch(() => {}), 30000);
    // self-test badge
    fetch("/api/selftest").then((r) => r.json()).then((d) => setSelftest({ ok: d.ok })).catch(() => {});
    return () => { clearInterval(t); clearInterval(t2); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && /^[1-9\-0]$/.test(e.key)) {
        e.preventDefault();
        const map: Record<string, string> = { "1": "/", "2": "/orchestrator", "3": "/terminal", "4": "/noc", "5": "/business", "6": "/revenue", "7": "/audit", "8": "/pipeline", "9": "/fundraise", "0": "/compliance", "-": "/vault" };
        if (map[e.key]) navigate(map[e.key]);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="flex h-full bg-ink-900 text-slate-200">
      <Background />

      {/* sidebar */}
      <aside className="relative z-10 flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/60 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-600 shadow-[0_0_24px_rgba(34,211,238,0.4)]">
              <Zap size={18} className="text-white" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">iTechSmart</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-400/80">
              UAIO Mission Control
            </div>
          </div>
        </div>
        <div className="glow-line mx-4" />

        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {NAV.map(({ to, label, icon: Icon, kbd }) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {({ isActive }) => (
                <motion.div
                  whileHover={{ x: 3 }}
                  className={clsx(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "text-white" : "text-slate-400 hover:text-slate-100"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/15 to-purple-600/10"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon size={16} className={clsx("relative z-10 shrink-0", isActive && "text-cyan-300")} />
                  <span className="relative z-10 flex-1 truncate">{label}</span>
                  <kbd className="relative z-10 rounded border border-white/10 px-1 py-0.5 text-[9px] text-slate-500 group-hover:text-slate-400">
                    ⌘{kbd}
                  </kbd>
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* tunnel status */}
        <div className="m-3 rounded-xl glass p-3">
          <div className="flex items-center gap-2 text-xs">
            <CloudCog size={14} className="text-cyan-400" />
            <span className="font-semibold text-slate-300">CF Zero Trust</span>
            <span className="ml-auto">
              <StatusDot up={tunnel?.active ?? false} />
            </span>
          </div>
          <div className="mt-1.5 font-mono text-[10px] text-slate-500">
            tunnel {tunnel?.id ?? "3525b90f"} · {tunnel?.state ?? "probing…"}
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.06] bg-ink-950/40 px-6 backdrop-blur-xl">
          <button
            onClick={() => setPaletteOpen(true)}
            className="glass flex w-72 items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm text-slate-500 transition-colors hover:border-cyan-400/30 hover:text-slate-300"
          >
            <Search size={14} />
            <span>Jump to anything…</span>
            <kbd className="ml-auto flex items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 text-[10px]">
              <Command size={10} /> K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-4">
            {/* self-test badge */}
            {selftest !== null && (
              <div className={clsx("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                selftest.ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
                {selftest.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                {selftest.ok ? "all systems go" : "check selftest"}
              </div>
            )}
            <div className="font-mono text-xs text-slate-400 tabular-nums">
              {clock.toLocaleTimeString([], { hour12: false })}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <StatusDot up />
              <span className="hidden sm:inline">ssh.itechsmart.dev</span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/80 to-purple-600/80 text-xs font-bold text-white ring-2 ring-white/10">
              iT
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <AuthGate />
    </div>
  );
}

/* ---------- auth gate ---------- */
function AuthGate() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("mc:unauthorized", show);
    return () => window.removeEventListener("mc:unauthorized", show);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass w-[400px] rounded-2xl p-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/25 to-purple-600/25 ring-1 ring-cyan-400/30">
            <KeyRound size={18} className="text-cyan-300" />
          </div>
          <div>
            <div className="text-base font-bold text-white">Access token required</div>
            <div className="text-xs text-slate-400">
              This deployment has <code className="font-mono">MC_AUTH_TOKEN</code> enabled.
            </div>
          </div>
        </div>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && value && (setToken(value), location.reload())}
          placeholder="Paste token…"
          className="glass mt-4 w-full rounded-xl px-3 py-2.5 font-mono text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          {getToken() && (
            <NeonButton variant="ghost" onClick={() => { setToken(""); location.reload(); }}>
              Clear saved token
            </NeonButton>
          )}
          <NeonButton disabled={!value} onClick={() => { setToken(value); location.reload(); }}>
            Unlock
          </NeonButton>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- command palette ---------- */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const commands = [
    ...NAV.map((n) => ({ label: `Go to ${n.label}`, run: () => navigate(n.to) })),
    { label: "Open SSH session to OVH server", run: () => navigate("/terminal?mode=ssh") },
    { label: "Open local VM shell", run: () => navigate("/terminal?mode=local") },
    { label: "New AI chat — Claude", run: () => navigate("/orchestrator?provider=claude") },
    { label: "New AI chat — Nemotron", run: () => navigate("/orchestrator?provider=nemotron") },
    { label: "New AI chat — Hermes SEMI_AUTO", run: () => navigate("/orchestrator?provider=hermes") },
    { label: "Create ticket", run: () => navigate("/business?new=ticket") },
    { label: "Create client", run: () => navigate("/business?new=client") },
    { label: "Export ProofLink receipts CSV", run: () => window.open("/api/audit/csv", "_blank") },
  ];
  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => { if (!open) setQ(""); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[18vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.18 }}
            className="glass w-[540px] overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <Search size={16} className="text-cyan-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filtered[0]) { filtered[0].run(); onClose(); }
                }}
                placeholder="Type a command…"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {filtered.map((c) => (
                <button key={c.label} onClick={() => { c.run(); onClose(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-white">
                  <Zap size={13} className="text-purple-400" />
                  {c.label}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-6 text-center text-sm text-slate-500">No matches</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
