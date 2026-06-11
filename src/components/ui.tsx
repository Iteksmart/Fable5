import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

/* ---------- animated aurora background ---------- */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
        }}
      />
      <div className="absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-cyan-500/12 blur-[120px] animate-float" />
      <div
        className="absolute top-1/3 -right-48 h-[40rem] w-[40rem] rounded-full bg-purple-600/12 blur-[140px] animate-float"
        style={{ animationDelay: "-5s" }}
      />
      <div
        className="absolute -bottom-48 left-1/3 h-[30rem] w-[30rem] rounded-full bg-emerald-500/8 blur-[120px] animate-float"
        style={{ animationDelay: "-9s" }}
      />
    </div>
  );
}

/* ---------- glass card ---------- */
export function GlassCard({
  children,
  className,
  hover = true,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={clsx("glass rounded-2xl", hover && "glass-hover", className)}
    >
      {children}
    </motion.div>
  );
}

/* ---------- animated number ---------- */
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const target = useRef(value);
  useEffect(() => {
    target.current = value;
    const start = display;
    const t0 = performance.now();
    const dur = 700;
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (target.current - start) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span className="tabular-nums">
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ---------- status dot with pulse ring ---------- */
export function StatusDot({ up, size = 8 }: { up: boolean; size?: number }) {
  const color = up ? "bg-emerald-400" : "bg-rose-400";
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      {up && <span className={clsx("absolute inset-0 rounded-full animate-pulse-ring", color)} />}
      <span className={clsx("relative rounded-full w-full h-full", color)} />
    </span>
  );
}

/* ---------- badge ---------- */
const badgeTones: Record<string, string> = {
  cyan: "bg-cyan-400/10 text-cyan-300 border-cyan-400/25",
  violet: "bg-purple-400/10 text-purple-300 border-purple-400/25",
  emerald: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
  amber: "bg-amber-400/10 text-amber-300 border-amber-400/25",
  rose: "bg-rose-400/10 text-rose-300 border-rose-400/25",
  slate: "bg-slate-400/10 text-slate-300 border-slate-400/25",
};

export function Badge({ tone = "slate", children }: { tone?: string; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        badgeTones[tone] ?? badgeTones.slate
      )}
    >
      {children}
    </span>
  );
}

/* ---------- buttons ---------- */
export function NeonButton({
  children,
  onClick,
  className,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.96 }}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
        variant === "primary" &&
          "bg-gradient-to-r from-cyan-500/90 to-purple-600/90 text-white shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_28px_rgba(34,211,238,0.4)]",
        variant === "ghost" &&
          "glass text-slate-200 hover:border-cyan-400/40 hover:text-white",
        variant === "danger" && "bg-rose-500/15 border border-rose-400/30 text-rose-300 hover:bg-rose-500/25",
        disabled && "opacity-40 pointer-events-none",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

/* ---------- sparkline (pure SVG, no deps) ---------- */
export function Sparkline({
  data,
  color = "#22d3ee",
  height = 36,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return <div style={{ height }} />;
  const w = 120;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map(
    (v, i) => `${(i / (data.length - 1)) * w},${height - 4 - ((v - min) / range) * (height - 8)}`
  );
  return (
    <svg width={w} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(" ")} ${w},${height}`} fill={`url(#sg-${color})`} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------- section heading ---------- */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {children}
      </h2>
      {right}
    </div>
  );
}
