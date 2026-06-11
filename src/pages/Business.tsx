import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Plus,
  Send,
  Ticket as TicketIcon,
  Trash2,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";
import { AnimatedNumber, Badge, GlassCard, NeonButton, SectionTitle } from "../components/ui";
import { api, timeAgo, type Client, type Invoice, type Ticket } from "../lib/api";

type Tab = "tickets" | "clients" | "invoices";

const prioTone: Record<string, string> = {
  low: "slate",
  medium: "cyan",
  high: "amber",
  critical: "rose",
};
const ticketStatusTone: Record<string, string> = {
  open: "amber",
  in_progress: "cyan",
  resolved: "emerald",
};
const invoiceTone: Record<string, string> = {
  draft: "slate",
  sent: "cyan",
  paid: "emerald",
  overdue: "rose",
};

export default function Business() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("tickets");
  const [clients, setClients] = useState<Client[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [modal, setModal] = useState<null | "ticket" | "client" | "invoice">(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = () => {
    api.list<Client>("clients").then(setClients).catch(() => {});
    api.list<Ticket>("tickets").then(setTickets).catch(() => {});
    api.list<Invoice>("invoices").then(setInvoices).catch(() => {});
  };
  useEffect(refresh, []);

  useEffect(() => {
    const n = params.get("new");
    if (n === "ticket" || n === "client" || n === "invoice") {
      setModal(n);
      setTab(n === "client" ? "clients" : n === "invoice" ? "invoices" : "tickets");
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const mrr = useMemo(() => clients.reduce((s, c) => s + c.mrr, 0), [clients]);
  const outstanding = useMemo(
    () => invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.amount, 0),
    [invoices]
  );
  const openCount = tickets.filter((t) => t.status !== "resolved").length;

  async function cycleTicket(t: Ticket) {
    const next = t.status === "open" ? "in_progress" : t.status === "in_progress" ? "resolved" : "open";
    await api.updateRec<Ticket>("tickets", t.id, { status: next });
    notify(`Ticket → ${next.replace("_", " ")}`);
    refresh();
  }

  async function advanceInvoice(inv: Invoice) {
    const next = inv.status === "draft" ? "sent" : "paid";
    await api.updateRec<Invoice>("invoices", inv.id, { status: next });
    notify(next === "sent" ? `Invoice ${inv.id} sent` : `Invoice ${inv.id} marked paid`);
    refresh();
  }

  async function del(col: string, id: string, label: string) {
    await api.deleteRec(col, id);
    notify(`${label} deleted`);
    refresh();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* header + KPIs */}
      <div className="grid gap-4 lg:grid-cols-4">
        <GlassCard hover={false} className="flex items-center gap-4 p-5 lg:col-span-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-600/20 ring-1 ring-white/10">
            <Briefcase size={20} className="text-cyan-300" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-white">MSP Business</div>
            <div className="text-xs text-slate-400">iTechSmart operations</div>
          </div>
        </GlassCard>
        <Kpi icon={<CircleDollarSign size={15} className="text-emerald-300" />} label="MRR" value={<AnimatedNumber value={mrr} prefix="$" />} delay={0.05} />
        <Kpi icon={<Send size={15} className="text-amber-300" />} label="Outstanding A/R" value={<AnimatedNumber value={outstanding} prefix="$" />} delay={0.1} />
        <Kpi icon={<TicketIcon size={15} className="text-rose-300" />} label="Open tickets" value={<AnimatedNumber value={openCount} />} delay={0.15} />
      </div>

      {/* tabs */}
      <GlassCard hover={false} className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="glass flex rounded-xl p-1">
            {(
              [
                ["tickets", "Tickets", TicketIcon],
                ["clients", "Clients", Users],
                ["invoices", "Invoices", CircleDollarSign],
              ] as [Tab, string, typeof Users][]
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  "relative flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors",
                  tab === id ? "text-white" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {tab === id && (
                  <motion.span
                    layoutId="biz-tab"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/25 to-purple-600/20 ring-1 ring-cyan-400/30"
                  />
                )}
                <Icon size={13} className="relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>
          <NeonButton
            className="ml-auto"
            onClick={() => setModal(tab === "clients" ? "client" : tab === "invoices" ? "invoice" : "ticket")}
          >
            <Plus size={15} /> New {tab.slice(0, -1)}
          </NeonButton>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "tickets" && (
              <div className="space-y-2">
                {tickets.map((t) => (
                  <div key={t.id} className="glass glass-hover flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
                    <Badge tone={prioTone[t.priority]}>{t.priority}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-100">{t.subject}</div>
                      <div className="text-[11px] text-slate-500">
                        {t.client} · {t.assignee} · opened {timeAgo(t.created)}
                      </div>
                    </div>
                    <Badge tone={ticketStatusTone[t.status]}>{t.status.replace("_", " ")}</Badge>
                    <button
                      onClick={() => cycleTicket(t)}
                      title="Advance status"
                      className="glass rounded-lg p-1.5 text-cyan-300 transition-colors hover:border-cyan-400/40"
                    >
                      {t.status === "in_progress" ? <CheckCircle2 size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <button
                      onClick={() => del("tickets", t.id, "Ticket")}
                      title="Delete"
                      className="glass rounded-lg p-1.5 text-slate-500 transition-colors hover:border-rose-400/40 hover:text-rose-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {tickets.length === 0 && <Empty label="No tickets — enjoy the silence." />}
              </div>
            )}

            {tab === "clients" && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clients.map((c) => (
                  <div key={c.id} className="glass glass-hover rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-100">{c.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.contact} · {c.email}
                        </div>
                      </div>
                      <button
                        onClick={() => del("clients", c.id, "Client")}
                        className="text-slate-600 transition-colors hover:text-rose-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone="violet">{c.plan}</Badge>
                      <Badge tone="cyan">{c.devices} devices</Badge>
                      <Badge tone="emerald">SLA {c.sla}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-bold text-white">${c.mrr.toLocaleString()}/mo</span>
                      <span className="text-[11px] text-slate-500">since {c.since}</span>
                    </div>
                  </div>
                ))}
                {clients.length === 0 && <Empty label="No clients yet." />}
              </div>
            )}

            {tab === "invoices" && (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="glass glass-hover flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
                    <span className="font-mono text-xs text-slate-400">{inv.id}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-100">{inv.client}</div>
                      <div className="text-[11px] text-slate-500">
                        issued {inv.issued} · due {inv.due}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white tabular-nums">
                      ${inv.amount.toLocaleString()}
                    </span>
                    <Badge tone={invoiceTone[inv.status]}>{inv.status}</Badge>
                    {inv.status !== "paid" && (
                      <NeonButton variant="ghost" onClick={() => advanceInvoice(inv)} className="!px-3 !py-1.5 text-xs">
                        {inv.status === "draft" ? "Send" : "Mark paid"}
                      </NeonButton>
                    )}
                    <button
                      onClick={() => del("invoices", inv.id, "Invoice")}
                      className="glass rounded-lg p-1.5 text-slate-500 transition-colors hover:border-rose-400/40 hover:text-rose-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {invoices.length === 0 && <Empty label="No invoices." />}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </GlassCard>

      {/* create modal */}
      <CreateModal
        kind={modal}
        clients={clients}
        onClose={() => setModal(null)}
        onCreated={(label) => {
          setModal(null);
          notify(`${label} created`);
          refresh();
        }}
      />

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className="glass flex items-center gap-2 rounded-xl border-emerald-400/30 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 size={15} /> {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Kpi({ icon, label, value, delay }: { icon: React.ReactNode; label: string; value: React.ReactNode; delay: number }) {
  return (
    <GlassCard className="p-5" delay={delay}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {icon} {label}
      </div>
      <div className="mt-1.5 text-2xl font-extrabold text-white">{value}</div>
    </GlassCard>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="col-span-full py-10 text-center text-sm text-slate-500">{label}</div>;
}

function CreateModal({
  kind,
  clients,
  onClose,
  onCreated,
}: {
  kind: null | "ticket" | "client" | "invoice";
  clients: Client[];
  onClose: () => void;
  onCreated: (label: string) => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "");
    if (kind === "ticket") {
      await api.createRec("tickets", {
        subject: v("subject"),
        client: v("client"),
        priority: v("priority") as Ticket["priority"],
        status: "open",
        assignee: v("assignee") || "Unassigned",
        created: new Date().toISOString(),
        sla_due: new Date(Date.now() + 86400000).toISOString(),
      });
      onCreated("Ticket");
    } else if (kind === "client") {
      await api.createRec("clients", {
        name: v("name"),
        contact: v("contact"),
        email: v("email"),
        plan: v("plan"),
        mrr: Number(v("mrr")) || 0,
        devices: Number(v("devices")) || 0,
        sla: "99.5%",
        health: 100,
        since: new Date().toISOString().slice(0, 10),
      });
      onCreated("Client");
    } else if (kind === "invoice") {
      await api.createRec("invoices", {
        id: `INV-${Math.floor(2000 + Math.random() * 8000)}`,
        client: v("client"),
        amount: Number(v("amount")) || 0,
        status: "draft",
        issued: new Date().toISOString().slice(0, 10),
        due: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      });
      onCreated("Invoice");
    }
  }

  const input =
    "glass w-full rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40";

  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ duration: 0.2 }}
            className="glass w-[440px] space-y-3 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold capitalize text-white">New {kind}</h3>
              <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {kind === "ticket" && (
              <>
                <input name="subject" required placeholder="Subject" className={input} />
                <select name="client" className={input}>
                  {clients.map((c) => (
                    <option key={c.id} className="bg-ink-800">{c.name}</option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <select name="priority" className={input}>
                    {["low", "medium", "high", "critical"].map((p) => (
                      <option key={p} className="bg-ink-800">{p}</option>
                    ))}
                  </select>
                  <input name="assignee" placeholder="Assignee" className={input} />
                </div>
              </>
            )}
            {kind === "client" && (
              <>
                <input name="name" required placeholder="Company name" className={input} />
                <div className="flex gap-3">
                  <input name="contact" placeholder="Primary contact" className={input} />
                  <input name="email" type="email" placeholder="Email" className={input} />
                </div>
                <div className="flex gap-3">
                  <select name="plan" className={input}>
                    {["Managed Pro", "Managed Core", "Co-Managed"].map((p) => (
                      <option key={p} className="bg-ink-800">{p}</option>
                    ))}
                  </select>
                  <input name="mrr" type="number" placeholder="MRR $" className={input} />
                  <input name="devices" type="number" placeholder="Devices" className={input} />
                </div>
              </>
            )}
            {kind === "invoice" && (
              <>
                <select name="client" className={input}>
                  {clients.map((c) => (
                    <option key={c.id} className="bg-ink-800">{c.name}</option>
                  ))}
                </select>
                <input name="amount" type="number" required placeholder="Amount $" className={input} />
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <NeonButton variant="ghost" onClick={onClose}>Cancel</NeonButton>
              <NeonButton type="submit">
                <Plus size={14} /> Create
              </NeonButton>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
