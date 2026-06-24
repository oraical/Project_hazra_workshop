import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Download,
  Upload,
  Database,
  Users,
  Receipt,
  Package,
  Trash2,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  FileText,
  MessageCircle,
  Send,
  CheckCircle,
} from "lucide-react";
import {
  db,
  exportAllData,
  importAllData,
  clearAllData,
  formatCurrency,
  type Customer,
  type Transaction,
} from "../db";
import BillBuilder from "../components/BillBuilder";
import { openWhatsAppReminder } from "../utils/whatsapp";

export default function SettingsView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [reminderRunning, setReminderRunning] = useState(false);
  const [reminderIndex, setReminderIndex] = useState(0);

  const customersCount = useLiveQuery(() => db.customers.count(), []);
  const allCustomers = useLiveQuery(() => db.customers.toArray(), []) as Customer[] | undefined;
  const txnsCount = useLiveQuery(() => db.transactions.count(), []);
  const itemsCount = useLiveQuery(() => db.inventory.count(), []);
  const txns = useLiveQuery(() => db.transactions.toArray(), []) as Transaction[] | undefined;

  const reminderRows = useMemo(() => {
    const map = new Map<number, number>();
    (txns ?? []).forEach((t) =>
      map.set(t.customerId, (map.get(t.customerId) ?? 0) + (t.type === "gave" ? t.amount : -t.amount))
    );
    return (allCustomers ?? [])
      .map((customer) => ({ customer, balance: map.get(customer.id!) ?? 0 }))
      .filter((row) => row.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [allCustomers, txns]);

  const { given, owed } = (() => {
    const map = new Map<number, number>();
    (txns ?? []).forEach((t) =>
      map.set(t.customerId, (map.get(t.customerId) ?? 0) + (t.type === "gave" ? t.amount : -t.amount))
    );
    let g = 0;
    let o = 0;
    map.forEach((b) => (b > 0 ? (g += b) : (o += -b)));
    return { given: g, owed: o };
  })();

  function flash(msg: string, ok = true) {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 4000);
  }

  async function handleBackup() {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `khata_backup_${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      flash("Backup downloaded successfully.");
    } catch (e) {
      flash("Backup failed: " + (e as Error).message, false);
    }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("Restoring will REPLACE all current data. Continue?")) {
      e.target.value = "";
      return;
    }
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await importAllData(payload);
      flash("Data restored successfully.");
    } catch (err) {
      flash("Restore failed: " + (err as Error).message, false);
    } finally {
      e.target.value = "";
    }
  }

  async function handleWipe() {
    if (!confirm("This permanently deletes ALL data. Are you sure?")) return;
    if (!confirm("Really delete everything? This cannot be undone.")) return;
    await clearAllData();
    flash("All data cleared.");
  }

  function startAutoWhatsAppRun() {
    if (reminderRows.length === 0) {
      flash("No customers have pending balances.");
      return;
    }
    setReminderRunning(true);
    setReminderIndex(0);
    openWhatsAppReminder(reminderRows[0].customer, reminderRows[0].balance);
  }

  function openCurrentWhatsApp() {
    const row = reminderRows[reminderIndex];
    if (!row) return;
    openWhatsAppReminder(row.customer, row.balance);
  }

  function nextWhatsAppReminder() {
    const next = reminderIndex + 1;
    if (next >= reminderRows.length) {
      setReminderRunning(false);
      setReminderIndex(0);
      flash("WhatsApp reminder run completed.");
      return;
    }
    setReminderIndex(next);
    openWhatsAppReminder(reminderRows[next].customer, reminderRows[next].balance);
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <div className="bg-[#1a73e8] px-4 pb-5 pt-5 text-white">
        <h1 className="text-xl font-bold">Settings & Reports</h1>
        <p className="text-sm text-blue-100">Backup, restore & business summary</p>
      </div>

      {status && (
        <div
          className={`mx-4 mt-4 rounded-xl p-3 text-sm font-medium ${
            status.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {status.msg}
        </div>
      )}

      {/* Reports */}
      <div className="px-4 pt-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Business Summary
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">Receivable</span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(given)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-red-600">
              <TrendingDown size={16} />
              <span className="text-xs font-medium">Payable</span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(owed)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat icon={<Users size={18} />} label="Customers" value={customersCount ?? 0} />
          <Stat icon={<Receipt size={18} />} label="Entries" value={txnsCount ?? 0} />
          <Stat icon={<Package size={18} />} label="Items" value={itemsCount ?? 0} />
        </div>
      </div>

      {/* Generate bill */}
      <div className="px-4 pt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Generate Bill
        </h2>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1a73e8]/10 text-[#1a73e8]">
              <FileText size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">Grill Measurement Bill</p>
              <p className="mt-1 text-xs text-slate-400">
                Select customer, add Sq Ft, Running Ft, Kg or Pcs items, save to ledger and download PDF.
              </p>
            </div>
          </div>
          <button
            onClick={() => setBillOpen(true)}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1a73e8] font-semibold text-white active:bg-blue-700"
          >
            <FileText size={18} /> Generate New Bill
          </button>
        </div>
      </div>

      {/* WhatsApp reminders */}
      <div className="px-4 pt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Automated WhatsApp Reminders
        </h2>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <MessageCircle size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">
                {reminderRows.length} pending customer{reminderRows.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Opens WhatsApp with a ready payment message. WhatsApp requires your final tap to send.
              </p>
            </div>
          </div>

          {reminderRows.length > 0 && (
            <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3">
              {reminderRows.slice(0, 3).map((row) => (
                <div key={row.customer.id} className="flex justify-between text-xs text-slate-600">
                  <span className="truncate pr-2">{row.customer.name}</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(row.balance)}</span>
                </div>
              ))}
              {reminderRows.length > 3 && (
                <p className="text-xs text-slate-400">+{reminderRows.length - 3} more customers</p>
              )}
            </div>
          )}

          {!reminderRunning ? (
            <button
              onClick={startAutoWhatsAppRun}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white active:bg-emerald-700"
            >
              <Send size={18} /> Start Reminder Run
            </button>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <p className="font-semibold">
                  {reminderIndex + 1} of {reminderRows.length}: {reminderRows[reminderIndex]?.customer.name}
                </p>
                <p>{formatCurrency(reminderRows[reminderIndex]?.balance ?? 0)} pending</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={openCurrentWhatsApp}
                  className="h-12 rounded-xl border border-emerald-600 font-semibold text-emerald-600"
                >
                  Reopen
                </button>
                <button
                  onClick={nextWhatsAppReminder}
                  className="flex h-12 items-center justify-center gap-1 rounded-xl bg-emerald-600 font-semibold text-white"
                >
                  <CheckCircle size={16} /> Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data security */}
      <div className="px-4 pt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Data Security
        </h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
            <ShieldCheck size={16} className="text-emerald-500" />
            All data is stored locally on this device (IndexedDB). Nothing is uploaded.
          </div>

          <button
            onClick={handleBackup}
            className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-slate-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a73e8]/10 text-[#1a73e8]">
              <Download size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-800">Backup Data</p>
              <p className="text-xs text-slate-400">Download a JSON file of everything</p>
            </div>
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-4 text-left active:bg-slate-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Upload size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-800">Restore Data</p>
              <p className="text-xs text-slate-400">Import from a backup JSON file</p>
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestore}
            className="hidden"
          />

          <button
            onClick={handleWipe}
            className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-4 text-left active:bg-red-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Trash2 size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-red-600">Clear All Data</p>
              <p className="text-xs text-slate-400">Permanently delete everything</p>
            </div>
          </button>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Database size={14} /> Hazra Workshop · Offline-First Ledger PWA
      </div>
      <BillBuilder open={billOpen} onClose={() => setBillOpen(false)} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </div>
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}
