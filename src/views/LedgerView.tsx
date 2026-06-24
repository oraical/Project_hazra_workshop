import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import {
  db,
  formatCurrency,
  unitLabel,
  type Customer,
  type Transaction,
  type InventoryItem,
} from "../db";
import Sheet from "../components/Sheet";

interface Props {
  onOpenCustomer: (id: number) => void;
}

export default function LedgerView({ onOpenCustomer }: Props) {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const customers = useLiveQuery(() => db.customers.toArray(), []) as Customer[] | undefined;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) as
    | Transaction[]
    | undefined;
  const inventory = useLiveQuery(() => db.inventory.toArray(), []) as InventoryItem[] | undefined;

  const balancesByCustomer = useMemo(() => {
    const map = new Map<number, number>();
    (transactions ?? []).forEach((t) => {
      map.set(t.customerId, (map.get(t.customerId) ?? 0) + (t.type === "gave" ? t.amount : -t.amount));
    });
    return map;
  }, [transactions]);

  const { totalCreditGiven, totalCreditOwed } = useMemo(() => {
    let given = 0;
    let owed = 0;
    balancesByCustomer.forEach((bal) => {
      if (bal > 0) given += bal; // customers owe you
      else if (bal < 0) owed += -bal; // you owe customers
    });
    return { totalCreditGiven: given, totalCreditOwed: owed };
  }, [balancesByCustomer]);

  const lowStockItems = useMemo(
    () => (inventory ?? []).filter((i) => i.stockQuantity <= i.lowStockThreshold),
    [inventory]
  );

  const filtered = useMemo(() => {
    const list = [...(customers ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, search]);

  async function addCustomer() {
    if (!name.trim()) return;
    await db.customers.add({ name: name.trim(), phone: phone.trim(), createdAt: Date.now() });
    setName("");
    setPhone("");
    setAddOpen(false);
  }

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="bg-[#1a73e8] px-4 pb-6 pt-5 text-white">
        <h1 className="text-xl font-bold">Hazra Workshop</h1>
        <p className="text-sm text-blue-100">Offline ledger for grill, gate and railing work</p>

        {/* Summary cards */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
            <div className="flex items-center gap-1.5 text-emerald-200">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">Credit Given (Sale/Receivable)</span>
            </div>
            <p className="mt-1 text-lg font-bold">{formatCurrency(totalCreditGiven)}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
            <div className="flex items-center gap-1.5 text-red-200">
              <TrendingDown size={16} />
              <span className="text-xs font-medium">Credit Owed(Payments/Payable)</span>
            </div>
            <p className="mt-1 text-lg font-bold">{formatCurrency(totalCreditOwed)}</p>
          </div>
        </div>
      </div>

      {/* Low stock banner */}
      {lowStockItems.length > 0 && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Low stock alert:</span>{" "}
            {lowStockItems
              .slice(0, 3)
              .map((i) => `${i.itemName} (${i.stockQuantity} ${unitLabel(i.unit)})`)
              .join(", ")}
            {lowStockItems.length > 3 && ` +${lowStockItems.length - 3} more`}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="sticky top-0 z-10 bg-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="h-11 w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      {/* Customer list */}
      <div className="px-4">
        {filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center text-slate-400">
            <UserPlus size={48} className="mb-3" />
            <p className="font-medium">No customers yet</p>
            <p className="text-sm">Tap the + button to add your first customer.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm">
            {filtered.map((c) => {
              const bal = balancesByCustomer.get(c.id!) ?? 0;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => onOpenCustomer(c.id!)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a73e8]/10 font-semibold text-[#1a73e8]">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{c.name}</p>
                      {c.phone && <p className="truncate text-xs text-slate-400">{c.phone}</p>}
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          bal > 0 ? "text-emerald-600" : bal < 0 ? "text-red-600" : "text-slate-400"
                        }`}
                      >
                        {formatCurrency(bal)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        {bal > 0 ? "owes you" : bal < 0 ? "you owe" : "settled"}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a73e8] text-white shadow-lg shadow-blue-500/40 active:scale-95"
        aria-label="Add customer"
      >
        <Plus size={26} />
      </button>

      {/* Add customer sheet */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Customer">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              className="h-12 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#1a73e8]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone (optional)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="98765 43210"
              className="h-12 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#1a73e8]"
            />
          </div>
          <button
            onClick={addCustomer}
            disabled={!name.trim()}
            className="h-12 w-full rounded-xl bg-[#1a73e8] font-semibold text-white disabled:opacity-40"
          >
            Save Customer
          </button>
        </div>
      </Sheet>
    </div>
  );
}
