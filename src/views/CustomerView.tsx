import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  FileText,
  Trash2,
  Phone,
  Plus,
  Minus,
} from "lucide-react";
import {
  db,
  formatCurrency,
  netBalance,
  unitLabel,
  type Customer,
  type Transaction,
} from "../db";
import Sheet from "../components/Sheet";
import BillBuilder from "../components/BillBuilder";
import { openWhatsAppReminder, openWhatsAppStatementLink } from "../utils/whatsapp";
import { generateStatementPDF } from "../utils/statement";

interface Props {
  customerId: number;
  onBack: () => void;
}

export default function CustomerView({ customerId, onBack }: Props) {
  const customer = useLiveQuery(() => db.customers.get(customerId), [customerId]) as
    | Customer
    | undefined;
  const txns = useLiveQuery(
    () => db.transactions.where("customerId").equals(customerId).toArray(),
    [customerId]
  ) as Transaction[] | undefined;

  const [entryType, setEntryType] = useState<"gave" | "got" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [billOpen, setBillOpen] = useState(false);

  const sorted = useMemo(
    () => [...(txns ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [txns]
  );
  const balance = useMemo(() => netBalance(txns ?? []), [txns]);

  async function saveEntry() {
    const amt = parseFloat(amount);
    if (!entryType || !amt || amt <= 0) return;
    await db.transactions.add({
      customerId,
      type: entryType,
      amount: amt,
      note: note.trim(),
      createdAt: Date.now(),
    });
    setAmount("");
    setNote("");
    setEntryType(null);
  }

  async function deleteTxn(id: number) {
    if (!confirm("Delete this entry?")) return;
    await db.transactions.delete(id);
  }

  function sendReminder() {
    if (!customer) return;
    openWhatsAppReminder(customer, Math.abs(balance));
  }

  function sendFullStatement() {
    if (!customer || !txns || txns.length === 0) return;
    const fileName = generateStatementPDF({
      customer,
      transactions: txns,
      businessName: "Kolkata Grill Works",
      businessSubline: "Steel Grill, Gate, Railing & Fabrication - Kolkata, West Bengal",
    });
    openWhatsAppStatementLink(customer, fileName, Math.abs(balance));
  }

  if (!customer) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">Loading...</div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Header */}
      <div className="bg-[#1a73e8] px-4 pb-5 pt-4 text-white">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="touch-target -ml-2 flex items-center justify-center rounded-full p-2 active:bg-white/20">
            <ArrowLeft size={22} />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-semibold">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{customer.name}</p>
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-1 text-xs text-blue-100"
              >
                <Phone size={11} /> {customer.phone}
              </a>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/15 p-4 backdrop-blur">
          <p className="text-xs text-blue-100">
            {balance > 0 ? "Customer owes you" : balance < 0 ? "You owe customer" : "All settled"}
          </p>
          <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {balance !== 0 && (
              <button
                onClick={sendReminder}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#1a73e8] active:bg-blue-50"
              >
                <Send size={14} /> WhatsApp Reminder
              </button>
            )}
            {sorted.length > 0 && (
              <button
                onClick={sendFullStatement}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white active:bg-emerald-600"
              >
                <FileText size={14} /> Send Full Ledger PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ledger list */}
      <div className="flex-1 overflow-y-auto px-4 pb-44 pt-4 no-scrollbar">
        {sorted.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-400">
            No transactions yet. Use the buttons below to record entries.
          </p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    t.type === "gave"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {t.type === "gave" ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {t.type === "gave" ? "You Gave (Diya)" : "You Got (Liya)"}
                  </p>
                  {t.note && <p className="truncate text-xs text-slate-400">{t.note}</p>}
                  {t.items && t.items.length > 0 && (
                    <p className="truncate text-[11px] text-slate-400">
                      {t.items.map((i) => `${i.itemName} x ${i.qty} ${unitLabel(i.unit)}`).join(", ")}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400">
                    {new Date(t.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p
                  className={`font-semibold ${
                    t.type === "gave" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(t.amount)}
                </p>
                <button
                  onClick={() => deleteTxn(t.id!)}
                  className="touch-target flex items-center justify-center p-1 text-slate-300 active:text-red-500"
                  aria-label="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-slate-200 bg-white p-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => setBillOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#1a73e8] text-sm font-semibold text-[#1a73e8] active:bg-blue-50"
        >
          <FileText size={16} /> Create Bill / GST Invoice
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setEntryType("got")}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 font-semibold text-white active:bg-red-700"
          >
            <Minus size={18} /> Got / Liya
          </button>
          <button
            onClick={() => setEntryType("gave")}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white active:bg-emerald-700"
          >
            <Plus size={18} /> Gave / Diya
          </button>
        </div>
      </div>

      {/* Entry sheet */}
      <Sheet
        open={entryType !== null}
        onClose={() => setEntryType(null)}
        title={entryType === "gave" ? "You Gave (Diya)" : "You Got (Liya)"}
        accent={entryType === "gave" ? "green" : "red"}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount (₹)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoFocus
              placeholder="0"
              className="h-14 w-full rounded-xl border border-slate-200 px-3 text-2xl font-bold outline-none focus:border-[#1a73e8]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. payment for groceries"
              className="h-12 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#1a73e8]"
            />
          </div>
          <button
            onClick={saveEntry}
            disabled={!amount || parseFloat(amount) <= 0}
            className={`h-12 w-full rounded-xl font-semibold text-white disabled:opacity-40 ${
              entryType === "gave" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            Save Entry
          </button>
        </div>
      </Sheet>

      {/* Bill builder sheet */}
      <BillBuilder
        open={billOpen}
        onClose={() => setBillOpen(false)}
        fixedCustomer={customer}
        fixedCustomerId={customerId}
      />
    </div>
  );
}
