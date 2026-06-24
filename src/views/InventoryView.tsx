import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Package, AlertTriangle, Trash2, Pencil, Search } from "lucide-react";
import { BUSINESS_UNITS, db, formatCurrency, unitLabel, type InventoryItem } from "../db";
import Sheet from "../components/Sheet";

const blank = {
  itemName: "",
  unit: "sqft",
  stockQuantity: "",
  purchasePrice: "",
  sellingPrice: "",
  lowStockThreshold: "",
};

export default function InventoryView() {
  const items = useLiveQuery(() => db.inventory.toArray(), []) as InventoryItem[] | undefined;
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(blank);

  const list = useMemo(() => {
    const sorted = [...(items ?? [])].sort((a, b) => a.itemName.localeCompare(b.itemName));
    const q = search.trim().toLowerCase();
    return q ? sorted.filter((i) => i.itemName.toLowerCase().includes(q)) : sorted;
  }, [items, search]);

  const lowCount = useMemo(
    () => (items ?? []).filter((i) => i.stockQuantity <= i.lowStockThreshold).length,
    [items]
  );

  function openAdd() {
    setEditId(null);
    setForm(blank);
    setSheetOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditId(item.id!);
    setForm({
      itemName: item.itemName,
      unit: item.unit ?? "sqft",
      stockQuantity: String(item.stockQuantity),
      purchasePrice: String(item.purchasePrice),
      sellingPrice: String(item.sellingPrice),
      lowStockThreshold: String(item.lowStockThreshold),
    });
    setSheetOpen(true);
  }

  async function save() {
    if (!form.itemName.trim()) return;
    const payload = {
      itemName: form.itemName.trim(),
      unit: form.unit as InventoryItem["unit"],
      stockQuantity: Number(form.stockQuantity) || 0,
      purchasePrice: Number(form.purchasePrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      lowStockThreshold: Number(form.lowStockThreshold) || 0,
    };
    if (editId != null) {
      await db.inventory.update(editId, payload);
    } else {
      await db.inventory.add({ ...payload, createdAt: Date.now() });
    }
    setSheetOpen(false);
    setForm(blank);
  }

  async function remove(id: number) {
    if (!confirm("Delete this item?")) return;
    await db.inventory.delete(id);
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <div className="bg-[#1a73e8] px-4 pb-5 pt-5 text-white">
        <h1 className="text-xl font-bold">Inventory</h1>
        <p className="text-sm text-blue-100">
          Grill rate list and stock · {items?.length ?? 0} items · {lowCount} low
        </p>
      </div>

      <div className="sticky top-0 z-10 bg-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="h-11 w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="px-4">
        {list.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center text-slate-400">
            <Package size={48} className="mb-3" />
            <p className="font-medium">No items yet</p>
            <p className="text-sm">Tap + to add inventory items.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((item) => {
              const low = item.stockQuantity <= item.lowStockThreshold;
              const margin = item.sellingPrice - item.purchasePrice;
              return (
                <li key={item.id} className="rounded-2xl bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        low ? "bg-amber-100 text-amber-600" : "bg-[#1a73e8]/10 text-[#1a73e8]"
                      }`}
                    >
                      <Package size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-slate-800">{item.itemName}</p>
                        {low && (
                          <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <AlertTriangle size={10} /> Low
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Buy {formatCurrency(item.purchasePrice)} / {unitLabel(item.unit)} · Sell{" "}
                        {formatCurrency(item.sellingPrice)} / {unitLabel(item.unit)} ·{" "}
                        <span className={margin >= 0 ? "text-emerald-600" : "text-red-500"}>
                          {margin >= 0 ? "+" : ""}
                          {formatCurrency(margin)} margin
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-lg font-bold ${
                          low ? "text-amber-600" : "text-slate-700"
                        }`}
                      >
                        {item.stockQuantity}
                      </span>
                      <span className="text-[10px] text-slate-400">{unitLabel(item.unit)} stock</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[#1a73e8] active:bg-blue-50"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => remove(item.id!)}
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 active:bg-red-50"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        onClick={openAdd}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1a73e8] text-white shadow-lg shadow-blue-500/40 active:scale-95"
        aria-label="Add item"
      >
        <Plus size={26} />
      </button>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editId != null ? "Edit Item" : "Add Item"}
      >
        <div className="space-y-3">
          <Field
            label="Item name"
            value={form.itemName}
            onChange={(v) => setForm((f) => ({ ...f, itemName: v }))}
            placeholder="e.g. MS Window Grill"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Business unit</label>
            <select
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1a73e8]"
            >
              {BUSINESS_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label} - {u.hint}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Stock (${unitLabel(form.unit as InventoryItem["unit"])})`}
              value={form.stockQuantity}
              onChange={(v) => setForm((f) => ({ ...f, stockQuantity: v }))}
              type="number"
              placeholder="0"
            />
            <Field
              label={`Low alert (${unitLabel(form.unit as InventoryItem["unit"])})`}
              value={form.lowStockThreshold}
              onChange={(v) => setForm((f) => ({ ...f, lowStockThreshold: v }))}
              type="number"
              placeholder="5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Purchase rate ₹ / ${unitLabel(form.unit as InventoryItem["unit"])}`}
              value={form.purchasePrice}
              onChange={(v) => setForm((f) => ({ ...f, purchasePrice: v }))}
              type="number"
              placeholder="0"
            />
            <Field
              label={`Selling rate ₹ / ${unitLabel(form.unit as InventoryItem["unit"])}`}
              value={form.sellingPrice}
              onChange={(v) => setForm((f) => ({ ...f, sellingPrice: v }))}
              type="number"
              placeholder="0"
            />
          </div>
          <button
            onClick={save}
            disabled={!form.itemName.trim()}
            className="h-12 w-full rounded-xl bg-[#1a73e8] font-semibold text-white disabled:opacity-40"
          >
            {editId != null ? "Update Item" : "Save Item"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        inputMode={type === "number" ? "decimal" : "text"}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#1a73e8]"
      />
    </div>
  );
}
