import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const T = {
  navy: "#0A0F2C",
  darkNav: "#060A1A",
  card: "#141D3B",
  card2: "#1A2550",
  teal: "#00D4FF",
  green: "#00E5A0",
  gold: "#FFB800",
  red: "#FF4B4B",
  purple: "#A78BFA",
  white: "#FFFFFF",
  gray: "#8B9DC3",
  light: "#B8C5E0",
};

type PolicyAction = "require_approval" | "auto_approve" | "require_receipt" | "block";
type PolicyTrigger = "risk_level" | "target_env" | "time_window" | "always";

interface Policy {
  id: string;
  name: string;
  description: string;
  trigger: PolicyTrigger;
  value: string;
  action: PolicyAction;
  agents: string[];
  enabled: boolean;
}

const ACTION_COLORS: Record<PolicyAction, string> = {
  require_approval: T.gold,
  auto_approve: T.green,
  require_receipt: T.teal,
  block: T.red,
};

const ACTION_LABELS: Record<PolicyAction, string> = {
  require_approval: "Require Approval",
  auto_approve: "Auto Approve",
  require_receipt: "Require Receipt",
  block: "Block",
};

const TRIGGER_OPTIONS: { value: PolicyTrigger; label: string }[] = [
  { value: "risk_level", label: "Risk Level" },
  { value: "target_env", label: "Target Environment" },
  { value: "time_window", label: "Time Window" },
  { value: "always", label: "Always" },
];

const ACTION_OPTIONS: { value: PolicyAction; label: string }[] = [
  { value: "require_approval", label: "Require Approval" },
  { value: "auto_approve", label: "Auto Approve" },
  { value: "require_receipt", label: "Require Receipt" },
  { value: "block", label: "Block" },
];

const defaultForm = {
  name: "",
  description: "",
  trigger: "risk_level" as PolicyTrigger,
  value: "",
  action: "require_approval" as PolicyAction,
  agents: "all",
  enabled: true,
};

export default function Policies() {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agentos/policies");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setPolicies(Array.isArray(data) ? data : data.policies ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleToggle = async (policy: Policy) => {
    if (togglingId === policy.id) return;
    setTogglingId(policy.id);
    try {
      const res = await fetch(`/api/agentos/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !policy.enabled }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      setPolicies((prev) =>
        prev.map((p) => (p.id === policy.id ? { ...p, enabled: !p.enabled } : p))
      );
    } catch {
      // silently fail — policy state stays as-is
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this policy? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/agentos/policies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setPolicies((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target;
    const value = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
    setForm((prev) => ({ ...prev, [target.name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        agents: form.agents
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await fetch("/api/agentos/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const created = await res.json();
      setPolicies((prev) => [created, ...prev]);
      setForm({ ...defaultForm });
      setShowForm(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to create policy");
    } finally {
      setSubmitting(false);
    }
  };

  const s = {
    page: {
      minHeight: "100vh",
      background: T.darkNav,
      padding: "32px 24px",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: T.white,
    } as React.CSSProperties,
    header: {
      marginBottom: "28px",
    } as React.CSSProperties,
    title: {
      fontSize: "28px",
      fontWeight: 700,
      color: T.white,
      margin: 0,
      letterSpacing: "-0.5px",
    } as React.CSSProperties,
    subtitle: {
      fontSize: "14px",
      color: T.gray,
      marginTop: "6px",
      marginBottom: 0,
    } as React.CSSProperties,
    topRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: "24px",
      gap: "16px",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    addBtn: {
      background: T.teal,
      color: T.navy,
      border: "none",
      borderRadius: "8px",
      padding: "10px 20px",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
      flexShrink: 0,
    } as React.CSSProperties,
    formCard: {
      background: T.card,
      border: `1px solid ${T.teal}33`,
      borderRadius: "12px",
      padding: "24px",
      marginBottom: "24px",
    } as React.CSSProperties,
    formTitle: {
      fontSize: "16px",
      fontWeight: 700,
      color: T.teal,
      marginBottom: "20px",
      marginTop: 0,
    } as React.CSSProperties,
    formGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px",
    } as React.CSSProperties,
    formGroup: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    } as React.CSSProperties,
    formGroupFull: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
      gridColumn: "1 / -1",
    } as React.CSSProperties,
    label: {
      fontSize: "12px",
      color: T.gray,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
    } as React.CSSProperties,
    input: {
      background: T.card2,
      border: `1px solid ${T.gray}44`,
      borderRadius: "6px",
      color: T.white,
      padding: "9px 12px",
      fontSize: "14px",
      outline: "none",
      width: "100%",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,
    select: {
      background: T.card2,
      border: `1px solid ${T.gray}44`,
      borderRadius: "6px",
      color: T.white,
      padding: "9px 12px",
      fontSize: "14px",
      outline: "none",
      width: "100%",
      boxSizing: "border-box" as const,
      cursor: "pointer",
    } as React.CSSProperties,
    checkRow: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    } as React.CSSProperties,
    formActions: {
      display: "flex",
      gap: "12px",
      marginTop: "20px",
      gridColumn: "1 / -1",
    } as React.CSSProperties,
    submitBtn: {
      background: T.green,
      color: T.navy,
      border: "none",
      borderRadius: "8px",
      padding: "10px 24px",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
    } as React.CSSProperties,
    cancelBtn: {
      background: "transparent",
      color: T.gray,
      border: `1px solid ${T.gray}55`,
      borderRadius: "8px",
      padding: "10px 24px",
      fontSize: "14px",
      fontWeight: 600,
      cursor: "pointer",
    } as React.CSSProperties,
    formError: {
      color: T.red,
      fontSize: "13px",
      gridColumn: "1 / -1",
      marginTop: "4px",
    } as React.CSSProperties,
    policyList: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "14px",
    } as React.CSSProperties,
    policyCard: {
      background: T.card,
      border: `1px solid ${T.card2}`,
      borderRadius: "12px",
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "12px",
    } as React.CSSProperties,
    policyTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: "12px",
    } as React.CSSProperties,
    policyName: {
      fontSize: "16px",
      fontWeight: 700,
      color: T.white,
      margin: 0,
    } as React.CSSProperties,
    policyDesc: {
      fontSize: "13px",
      color: T.gray,
      margin: 0,
      marginTop: "4px",
      lineHeight: 1.5,
    } as React.CSSProperties,
    badgeRow: {
      display: "flex",
      gap: "8px",
      flexWrap: "wrap" as const,
      alignItems: "center",
    } as React.CSSProperties,
    badge: (color: string) =>
      ({
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 700,
        background: `${color}22`,
        color: color,
        border: `1px solid ${color}55`,
        textTransform: "uppercase" as const,
        letterSpacing: "0.3px",
      } as React.CSSProperties),
    metaLabel: {
      fontSize: "11px",
      color: T.gray,
      textTransform: "uppercase" as const,
      letterSpacing: "0.4px",
    } as React.CSSProperties,
    metaValue: {
      fontSize: "13px",
      color: T.light,
    } as React.CSSProperties,
    agentPill: {
      display: "inline-block",
      background: `${T.purple}22`,
      color: T.purple,
      border: `1px solid ${T.purple}44`,
      borderRadius: "12px",
      padding: "2px 9px",
      fontSize: "11px",
      fontWeight: 600,
    } as React.CSSProperties,
    rightControls: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexShrink: 0,
    } as React.CSSProperties,
    toggleTrack: (enabled: boolean) =>
      ({
        width: "40px",
        height: "22px",
        background: enabled ? T.green : `${T.gray}55`,
        borderRadius: "11px",
        cursor: "pointer",
        position: "relative" as const,
        transition: "background 0.2s",
        border: "none",
        outline: "none",
        padding: 0,
        flexShrink: 0,
      } as React.CSSProperties),
    toggleThumb: (enabled: boolean) =>
      ({
        position: "absolute" as const,
        top: "3px",
        left: enabled ? "21px" : "3px",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: T.white,
        transition: "left 0.2s",
      } as React.CSSProperties),
    deleteBtn: {
      background: "transparent",
      border: `1px solid ${T.red}44`,
      color: T.red,
      borderRadius: "6px",
      padding: "5px 12px",
      fontSize: "12px",
      fontWeight: 600,
      cursor: "pointer",
    } as React.CSSProperties,
    emptyState: {
      textAlign: "center" as const,
      padding: "60px 20px",
      color: T.gray,
      fontSize: "15px",
    } as React.CSSProperties,
    errorState: {
      background: `${T.red}18`,
      border: `1px solid ${T.red}44`,
      borderRadius: "10px",
      padding: "16px 20px",
      color: T.red,
      fontSize: "14px",
      marginBottom: "20px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    } as React.CSSProperties,
    retryBtn: {
      background: "transparent",
      border: `1px solid ${T.red}66`,
      color: T.red,
      borderRadius: "6px",
      padding: "5px 14px",
      fontSize: "12px",
      cursor: "pointer",
    } as React.CSSProperties,
    metaRow: {
      display: "flex",
      gap: "24px",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    metaItem: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "2px",
    } as React.CSSProperties,
    footerLinks: {
      marginTop: "36px",
      paddingTop: "24px",
      borderTop: `1px solid ${T.card2}`,
      display: "flex",
      gap: "24px",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    navLink: {
      color: T.teal,
      fontSize: "13px",
      fontWeight: 600,
      cursor: "pointer",
      background: "none",
      border: "none",
      padding: 0,
      textDecoration: "underline",
      textDecorationColor: `${T.teal}55`,
    } as React.CSSProperties,
    loadingDot: {
      display: "inline-block",
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: T.teal,
      margin: "0 3px",
      animation: "pulse 1.2s infinite",
    } as React.CSSProperties,
    loadingWrap: {
      textAlign: "center" as const,
      padding: "60px 20px",
      color: T.gray,
      fontSize: "14px",
    } as React.CSSProperties,
    policyCardDisabled: {
      opacity: 0.65,
    } as React.CSSProperties,
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Agent Guardrails</h1>
        <p style={s.subtitle}>
          Define what agents can do autonomously — and when humans must step in.
        </p>
      </div>

      <div style={s.topRow}>
        <div />
        <button style={s.addBtn} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "✕ Cancel" : "+ Add Policy"}
        </button>
      </div>

      {showForm && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>New Policy</h3>
          <form onSubmit={handleFormSubmit}>
            <div style={s.formGrid}>
              <div style={s.formGroup}>
                <label style={s.label}>Name</label>
                <input
                  style={s.input}
                  name="name"
                  type="text"
                  placeholder="e.g. Block prod deploys after hours"
                  value={form.name}
                  onChange={handleFormChange}
                  autoComplete="off"
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Value</label>
                <input
                  style={s.input}
                  name="value"
                  type="text"
                  placeholder="e.g. high / production / 22:00-06:00"
                  value={form.value}
                  onChange={handleFormChange}
                  autoComplete="off"
                />
              </div>
              <div style={s.formGroupFull}>
                <label style={s.label}>Description</label>
                <input
                  style={s.input}
                  name="description"
                  type="text"
                  placeholder="Describe what this policy enforces"
                  value={form.description}
                  onChange={handleFormChange}
                  autoComplete="off"
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Trigger</label>
                <select
                  style={s.select}
                  name="trigger"
                  value={form.trigger}
                  onChange={handleFormChange}
                >
                  {TRIGGER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Action</label>
                <select
                  style={s.select}
                  name="action"
                  value={form.action}
                  onChange={handleFormChange}
                >
                  {ACTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Agents (comma-separated or "all")</label>
                <input
                  style={s.input}
                  name="agents"
                  type="text"
                  placeholder="all"
                  value={form.agents}
                  onChange={handleFormChange}
                  autoComplete="off"
                />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Enabled</label>
                <div style={s.checkRow}>
                  <input
                    type="checkbox"
                    name="enabled"
                    id="form-enabled"
                    checked={form.enabled}
                    onChange={handleFormChange}
                    style={{ width: "16px", height: "16px", accentColor: T.teal, cursor: "pointer" }}
                  />
                  <label
                    htmlFor="form-enabled"
                    style={{ fontSize: "14px", color: T.light, cursor: "pointer" }}
                  >
                    Active on create
                  </label>
                </div>
              </div>
              {formError && <p style={s.formError}>{formError}</p>}
              <div style={s.formActions}>
                <button type="submit" style={s.submitBtn} disabled={submitting}>
                  {submitting ? "Creating…" : "Create Policy"}
                </button>
                <button
                  type="button"
                  style={s.cancelBtn}
                  onClick={() => {
                    setShowForm(false);
                    setForm({ ...defaultForm });
                    setFormError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div style={s.errorState}>
          <span>{error}</span>
          <button style={s.retryBtn} onClick={fetchPolicies}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={s.loadingWrap}>
          <span style={s.loadingDot} />
          <span style={s.loadingDot} />
          <span style={s.loadingDot} />
          <p style={{ marginTop: "12px" }}>Loading policies…</p>
        </div>
      ) : !error && policies.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🛡</div>
          <p>No policies configured yet. Add one to start governing agent behavior.</p>
        </div>
      ) : (
        <div style={s.policyList}>
          {policies.map((policy) => (
            <div
              key={policy.id}
              style={{
                ...s.policyCard,
                ...(policy.enabled ? {} : s.policyCardDisabled),
              }}
            >
              <div style={s.policyTop}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={s.policyName}>{policy.name}</h3>
                  {policy.description && <p style={s.policyDesc}>{policy.description}</p>}
                </div>
                <div style={s.rightControls}>
                  <span style={{ fontSize: "11px", color: policy.enabled ? T.green : T.gray }}>
                    {policy.enabled ? "ON" : "OFF"}
                  </span>
                  <button
                    style={s.toggleTrack(policy.enabled)}
                    onClick={() => handleToggle(policy)}
                    disabled={togglingId === policy.id}
                    aria-label={policy.enabled ? "Disable policy" : "Enable policy"}
                  >
                    <span style={s.toggleThumb(policy.enabled)} />
                  </button>
                  <button
                    style={s.deleteBtn}
                    onClick={() => handleDelete(policy.id)}
                    disabled={deletingId === policy.id}
                  >
                    {deletingId === policy.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>

              <div style={s.badgeRow}>
                <span style={s.badge(ACTION_COLORS[policy.action] ?? T.gray)}>
                  {ACTION_LABELS[policy.action] ?? policy.action}
                </span>
                <span style={s.badge(T.purple)}>
                  {policy.trigger.replace(/_/g, " ")}
                </span>
                {policy.value && (
                  <span style={s.badge(T.light)}>val: {policy.value}</span>
                )}
              </div>

              <div style={s.metaRow}>
                <div style={s.metaItem}>
                  <span style={s.metaLabel}>Agents</span>
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                    {policy.agents.length === 0 || policy.agents[0] === "all" ? (
                      <span style={s.agentPill}>all</span>
                    ) : (
                      policy.agents.map((a) => (
                        <span key={a} style={s.agentPill}>
                          {a}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={s.footerLinks}>
        <button style={s.navLink} onClick={() => navigate("/audit")}>
          → View Audit trail for policy violations
        </button>
        <button style={s.navLink} onClick={() => navigate("/approvals")}>
          → Review pending approvals
        </button>
      </div>
    </div>
  );
}
