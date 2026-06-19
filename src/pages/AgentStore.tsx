import React, { useEffect, useState, useCallback, useRef } from "react";
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

type RiskLevel = "low" | "medium" | "high";

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  risk: RiskLevel;
  icon?: string;
  tools?: string[];
  hitl: boolean;
  receipts?: number;
}

interface Deployment {
  skill_id: string;
  tenant: string;
  deployed_at: string;
}

interface StoreData {
  skills: Skill[];
  categories: string[];
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: T.green,
  medium: T.gold,
  high: T.red,
};

const TENANTS = [
  "default",
  "Northwind Logistics",
  "Atlas Manufacturing",
  "Bayview Dental",
  "Crestline Realty",
  "Lumen Law Partners",
];

interface Toast {
  id: number;
  message: string;
  skillId: string;
}

export default function AgentStore() {
  const navigate = useNavigate();
  const [storeData, setStoreData] = useState<StoreData>({ skills: [], categories: [] });
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [dropdownSkillId, setDropdownSkillId] = useState<string | null>(null);
  const [selectedTenants, setSelectedTenants] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [storeRes, depRes] = await Promise.all([
        fetch("/api/agentos/agent-store"),
        fetch("/api/agentos/agent-store/deployments"),
      ]);
      if (!storeRes.ok) throw new Error(`Store fetch failed: ${storeRes.status}`);
      const store: StoreData = await storeRes.json();
      setStoreData(store);

      if (depRes.ok) {
        const dep = await depRes.json();
        setDeployments(Array.isArray(dep) ? dep : dep.deployments ?? []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load agent store");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownSkillId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addToast = (message: string, skillId: string) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, skillId }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleDeploy = async (skill: Skill) => {
    const tenant = selectedTenants[skill.id] || TENANTS[0];
    setDeployingId(skill.id);
    try {
      const res = await fetch(`/api/agentos/agent-store/${skill.id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant }),
      });
      if (!res.ok) throw new Error(`Deploy failed: ${res.status}`);
      const dep: Deployment = await res.json();
      setDeployments((prev) => [...prev, dep]);
      setDropdownSkillId(null);
      addToast(`Deployed! Check /agents for live status`, skill.id);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Deploy failed", skill.id);
    } finally {
      setDeployingId(null);
    }
  };

  const allCategories = ["All", ...storeData.categories];

  const filteredSkills = storeData.skills.filter((skill) => {
    const catMatch = activeCategory === "All" || skill.category === activeCategory;
    const q = search.toLowerCase();
    const textMatch =
      !q ||
      skill.name.toLowerCase().includes(q) ||
      skill.description.toLowerCase().includes(q);
    return catMatch && textMatch;
  });

  const deployedCount = deployments.length;

  const s = {
    page: {
      minHeight: "100vh",
      background: T.darkNav,
      padding: "32px 24px",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: T.white,
      position: "relative" as const,
    } as React.CSSProperties,
    header: {
      marginBottom: "8px",
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
    statsBar: {
      display: "flex",
      gap: "20px",
      alignItems: "center",
      marginTop: "20px",
      marginBottom: "24px",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    statChip: {
      background: T.card,
      border: `1px solid ${T.card2}`,
      borderRadius: "8px",
      padding: "8px 16px",
      display: "flex",
      gap: "8px",
      alignItems: "center",
    } as React.CSSProperties,
    statLabel: {
      fontSize: "12px",
      color: T.gray,
      textTransform: "uppercase" as const,
      letterSpacing: "0.4px",
    } as React.CSSProperties,
    statValue: {
      fontSize: "18px",
      fontWeight: 700,
      color: T.teal,
    } as React.CSSProperties,
    toolbarRow: {
      display: "flex",
      gap: "12px",
      marginBottom: "20px",
      alignItems: "center",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    searchBox: {
      background: T.card,
      border: `1px solid ${T.gray}44`,
      borderRadius: "8px",
      color: T.white,
      padding: "9px 14px",
      fontSize: "14px",
      outline: "none",
      width: "280px",
      boxSizing: "border-box" as const,
    } as React.CSSProperties,
    catTabs: {
      display: "flex",
      gap: "6px",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    catTab: (active: boolean) =>
      ({
        background: active ? T.teal : T.card,
        color: active ? T.navy : T.gray,
        border: active ? `1px solid ${T.teal}` : `1px solid ${T.gray}44`,
        borderRadius: "20px",
        padding: "5px 14px",
        fontSize: "12px",
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap" as const,
        transition: "all 0.15s",
      } as React.CSSProperties),
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      gap: "16px",
    } as React.CSSProperties,
    skillCard: {
      background: T.card,
      border: `1px solid ${T.card2}`,
      borderRadius: "12px",
      padding: "20px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "12px",
      position: "relative" as const,
    } as React.CSSProperties,
    cardTop: {
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
    } as React.CSSProperties,
    iconBox: {
      width: "40px",
      height: "40px",
      borderRadius: "10px",
      background: T.card2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
      flexShrink: 0,
    } as React.CSSProperties,
    skillName: {
      fontSize: "15px",
      fontWeight: 700,
      color: T.white,
      margin: 0,
    } as React.CSSProperties,
    skillDesc: {
      fontSize: "13px",
      color: T.gray,
      margin: 0,
      marginTop: "4px",
      lineHeight: 1.5,
    } as React.CSSProperties,
    badgeRow: {
      display: "flex",
      gap: "6px",
      flexWrap: "wrap" as const,
      alignItems: "center",
    } as React.CSSProperties,
    badge: (color: string) =>
      ({
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 9px",
        borderRadius: "20px",
        fontSize: "10px",
        fontWeight: 700,
        background: `${color}22`,
        color: color,
        border: `1px solid ${color}55`,
        textTransform: "uppercase" as const,
        letterSpacing: "0.3px",
      } as React.CSSProperties),
    toolsList: {
      display: "flex",
      gap: "5px",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,
    toolPill: {
      background: `${T.navy}bb`,
      border: `1px solid ${T.gray}33`,
      borderRadius: "10px",
      padding: "2px 8px",
      fontSize: "10px",
      color: T.gray,
    } as React.CSSProperties,
    cardFooter: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: "4px",
    } as React.CSSProperties,
    receiptsTag: {
      fontSize: "11px",
      color: T.gray,
    } as React.CSSProperties,
    deployWrap: {
      position: "relative" as const,
    } as React.CSSProperties,
    deployBtn: (loading: boolean) =>
      ({
        background: loading ? T.card2 : T.teal,
        color: loading ? T.gray : T.navy,
        border: "none",
        borderRadius: "8px",
        padding: "7px 16px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        whiteSpace: "nowrap" as const,
        transition: "background 0.15s",
      } as React.CSSProperties),
    dropdown: {
      position: "absolute" as const,
      bottom: "calc(100% + 6px)",
      right: 0,
      background: T.card2,
      border: `1px solid ${T.gray}44`,
      borderRadius: "10px",
      padding: "8px",
      zIndex: 100,
      minWidth: "220px",
      boxShadow: "0 8px 32px #00000066",
    } as React.CSSProperties,
    dropdownLabel: {
      fontSize: "11px",
      color: T.gray,
      padding: "4px 8px 8px",
      textTransform: "uppercase" as const,
      letterSpacing: "0.4px",
      display: "block",
    } as React.CSSProperties,
    tenantSelect: {
      background: T.card,
      border: `1px solid ${T.gray}44`,
      borderRadius: "6px",
      color: T.white,
      padding: "7px 10px",
      fontSize: "13px",
      width: "100%",
      outline: "none",
      marginBottom: "8px",
      boxSizing: "border-box" as const,
      cursor: "pointer",
    } as React.CSSProperties,
    confirmDeployBtn: (loading: boolean) =>
      ({
        background: loading ? T.card2 : T.green,
        color: loading ? T.gray : T.navy,
        border: "none",
        borderRadius: "6px",
        padding: "7px 14px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        width: "100%",
      } as React.CSSProperties),
    toastContainer: {
      position: "fixed" as const,
      bottom: "24px",
      right: "24px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "10px",
      zIndex: 9999,
    } as React.CSSProperties,
    toast: {
      background: T.card2,
      border: `1px solid ${T.green}55`,
      borderRadius: "10px",
      padding: "12px 18px",
      color: T.white,
      fontSize: "13px",
      fontWeight: 600,
      minWidth: "280px",
      maxWidth: "360px",
      boxShadow: "0 6px 24px #00000066",
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px",
    } as React.CSSProperties,
    toastLink: {
      color: T.teal,
      fontSize: "12px",
      cursor: "pointer",
      background: "none",
      border: "none",
      padding: 0,
      textDecoration: "underline",
      textDecorationColor: `${T.teal}55`,
      textAlign: "left" as const,
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
    loadingWrap: {
      textAlign: "center" as const,
      padding: "60px 20px",
      color: T.gray,
      fontSize: "14px",
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
  };

  const skillIcon = (skill: Skill) => skill.icon || "⚙";

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Agent Skill Store</h1>
        <p style={s.subtitle}>
          Pre-built autonomous skills. Deploy to any tenant — evidence-sealed by design.
        </p>
      </div>

      <div style={s.statsBar}>
        <div style={s.statChip}>
          <div>
            <div style={s.statLabel}>Deployed</div>
            <div style={s.statValue}>{deployedCount}</div>
          </div>
          <span style={{ fontSize: "11px", color: T.gray, alignSelf: "flex-end", paddingBottom: "2px" }}>
            active skill{deployedCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={s.statChip}>
          <div>
            <div style={s.statLabel}>Available</div>
            <div style={{ ...s.statValue, color: T.purple }}>{storeData.skills.length}</div>
          </div>
          <span style={{ fontSize: "11px", color: T.gray, alignSelf: "flex-end", paddingBottom: "2px" }}>
            in library
          </span>
        </div>
      </div>

      <div style={s.toolbarRow}>
        <input
          style={s.searchBox}
          type="text"
          placeholder="Search skills…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div style={{ ...s.catTabs, marginBottom: "20px" }}>
        {allCategories.map((cat) => (
          <button
            key={cat}
            style={s.catTab(cat === activeCategory)}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <div style={s.errorState}>
          <span>{error}</span>
          <button style={s.retryBtn} onClick={fetchAll}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={s.loadingWrap}>
          <p>Loading agent store…</p>
        </div>
      ) : !error && filteredSkills.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📦</div>
          <p>
            {storeData.skills.length === 0
              ? "No skills in the store yet."
              : "No skills match your filter."}
          </p>
        </div>
      ) : (
        <div style={s.grid}>
          {filteredSkills.map((skill) => {
            const isOpen = dropdownSkillId === skill.id;
            const isDeploying = deployingId === skill.id;
            const tenant = selectedTenants[skill.id] || TENANTS[0];

            return (
              <div key={skill.id} style={s.skillCard}>
                <div style={s.cardTop}>
                  <div style={s.iconBox}>{skillIcon(skill)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={s.skillName}>{skill.name}</h3>
                    <p style={s.skillDesc}>{skill.description}</p>
                  </div>
                </div>

                <div style={s.badgeRow}>
                  <span
                    style={s.badge(T.purple)}
                  >
                    {skill.category}
                  </span>
                  <span
                    style={s.badge(RISK_COLORS[skill.risk] ?? T.gray)}
                  >
                    {skill.risk} risk
                  </span>
                  {skill.hitl ? (
                    <span style={s.badge(T.red)}>HITL Required</span>
                  ) : (
                    <span style={s.badge(T.green)}>Auto</span>
                  )}
                </div>

                {skill.tools && skill.tools.length > 0 && (
                  <div style={s.toolsList}>
                    {skill.tools.slice(0, 6).map((tool) => (
                      <span key={tool} style={s.toolPill}>
                        {tool}
                      </span>
                    ))}
                    {skill.tools.length > 6 && (
                      <span style={s.toolPill}>+{skill.tools.length - 6}</span>
                    )}
                  </div>
                )}

                <div style={s.cardFooter}>
                  {skill.receipts !== undefined ? (
                    <span style={s.receiptsTag}>
                      {skill.receipts.toLocaleString()} receipt{skill.receipts !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span />
                  )}

                  <div style={s.deployWrap} ref={isOpen ? dropdownRef : null}>
                    <button
                      style={s.deployBtn(isDeploying)}
                      onClick={() => {
                        if (isDeploying) return;
                        setDropdownSkillId(isOpen ? null : skill.id);
                      }}
                      disabled={isDeploying}
                    >
                      {isDeploying ? "Deploying…" : "Deploy to Tenant ▾"}
                    </button>

                    {isOpen && (
                      <div style={s.dropdown}>
                        <span style={s.dropdownLabel}>Select Tenant</span>
                        <select
                          style={s.tenantSelect}
                          value={tenant}
                          onChange={(e) =>
                            setSelectedTenants((prev) => ({
                              ...prev,
                              [skill.id]: e.target.value,
                            }))
                          }
                        >
                          {TENANTS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <button
                          style={s.confirmDeployBtn(isDeploying)}
                          onClick={() => handleDeploy(skill)}
                          disabled={isDeploying}
                        >
                          {isDeploying ? "Deploying…" : `Deploy to "${tenant}"`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={s.footerLinks}>
        <button style={s.navLink} onClick={() => navigate("/agents")}>
          → View live agent registry
        </button>
      </div>

      <div style={s.toastContainer}>
        {toasts.map((toast) => (
          <div key={toast.id} style={s.toast}>
            <span>✓ {toast.message}</span>
            <button style={s.toastLink} onClick={() => navigate("/agents")}>
              → Go to /agents
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
