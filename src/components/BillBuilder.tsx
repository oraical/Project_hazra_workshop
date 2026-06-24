import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Calculator, FileDown, Minus, Plus, Trash2 } from "lucide-react";
import {
  db,
  formatCurrency,
  roundQty,
  unitLabel,
  type BillLineItem,
  type BusinessUnit,
  type Customer,
  type InventoryItem,
} from "../db";
import { generateInvoicePDF } from "../utils/invoice";
import Sheet from "./Sheet";

interface BillBuilderProps {
  open: boolean;
  onClose: () => void;
  fixedCustomer?: Customer;
  fixedCustomerId?: number;
}

interface CartDraft {
  qty: string;
  lengthFt: string;
  heightFt: string;
  pieces: string;
}

type BillLineWithStock = BillLineItem & { available: number };

const emptyDraft: CartDraft = { qty: "", lengthFt: "", heightFt: "", pieces: "1" };

function num(value: string): number {
  return Number.parseFloat(value) || 0;
}

function unitOf(item: InventoryItem): BusinessUnit {
  return item.unit ?? "sqft";
}

function calcQty(item: InventoryItem, draft: CartDraft): number {
  const unit = unitOf(item);
  if (unit === "sqft") {
    return roundQty(num(draft.lengthFt) * num(draft.heightFt) * Math.max(1, num(draft.pieces)));
  }
  return roundQty(num(draft.qty));
}

function measurementLabel(item: InventoryItem, draft: CartDraft, qty: number): string {
  const unit = unitOf(item);
  if (unit === "sqft") {
    return `${draft.lengthFt || 0} ft x ${draft.heightFt || 0} ft x ${draft.pieces || 1} pcs = ${qty} Sq Ft`;
  }
  return `${qty} ${unitLabel(unit)}`;
}

export default function BillBuilder({
  open,
  onClose,
  fixedCustomer,
  fixedCustomerId,
}: BillBuilderProps) {
  const inventory = (useLiveQuery(() => db.inventory.toArray(), []) as InventoryItem[] | undefined) ?? [];
  const customers = (useLiveQuery(() => db.customers.toArray(), []) as Customer[] | undefined) ?? [];

  const [selectedCustomerId, setSelectedCustomerId] = useState(fixedCustomerId ? String(fixedCustomerId) : "");
  const [cart, setCart] = useState<Record<number, CartDraft>>({});
  const [workNote, setWorkNote] = useState("");
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstRate, setGstRate] = useState(18);

  useEffect(() => {
    if (open && fixedCustomerId) setSelectedCustomerId(String(fixedCustomerId));
  }, [fixedCustomerId, open]);

  const selectedCustomer = useMemo(() => {
    if (fixedCustomer) return fixedCustomer;
    return customers.find((c) => c.id === Number(selectedCustomerId));
  }, [customers, fixedCustomer, selectedCustomerId]);

  const lineItems: BillLineWithStock[] = useMemo(() => {
    const lines: BillLineWithStock[] = [];
    for (const item of inventory) {
      if (item.id == null) continue;
      const draft = cart[item.id];
      if (!draft) continue;
      const qty = calcQty(item, draft);
      if (qty <= 0) continue;
      lines.push({
        itemId: item.id,
        itemName: item.itemName,
        qty,
        price: item.sellingPrice,
        unit: unitOf(item),
        lengthFt: unitOf(item) === "sqft" ? num(draft.lengthFt) : undefined,
        heightFt: unitOf(item) === "sqft" ? num(draft.heightFt) : undefined,
        pieces: unitOf(item) === "sqft" ? Math.max(1, num(draft.pieces)) : undefined,
        measurementLabel: measurementLabel(item, draft, qty),
        available: item.stockQuantity,
      });
    }
    return lines;
  }, [cart, inventory]);

  const subtotal = lineItems.reduce((s, i) => s + i.qty * i.price, 0);
  const taxAmount = gstEnabled ? (subtotal * gstRate) / 100 : 0;
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;
  const grandTotal = subtotal + taxAmount;
  const hasStockError = lineItems.some((i) => i.qty > i.available);

  function setDraft(item: InventoryItem, patch: Partial<CartDraft>) {
    if (item.id == null) return;
    setCart((current) => ({
      ...current,
      [item.id!]: { ...(current[item.id!] ?? emptyDraft), ...patch },
    }));
  }

  function removeDraft(itemId: number) {
    setCart((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  async function finalizeBill(download: boolean) {
    if (!selectedCustomer?.id || lineItems.length === 0 || hasStockError) return;

    await db.transaction("rw", db.inventory, db.transactions, async () => {
      for (const li of lineItems) {
        if (li.itemId != null) {
          const inv = await db.inventory.get(li.itemId);
          if (inv) {
            await db.inventory.update(li.itemId, {
              stockQuantity: roundQty(Math.max(0, inv.stockQuantity - li.qty)),
            });
          }
        }
      }

      await db.transactions.add({
        customerId: selectedCustomer.id!,
        type: "gave",
        amount: Math.round(grandTotal * 100) / 100,
        note: `${workNote.trim() || "Grill fabrication bill"}: ${lineItems.length} item(s)${
          gstEnabled ? ` incl ${gstRate}% GST` : ""
        }`,
        items: lineItems.map(
          ({ itemId, itemName, qty, price, unit, lengthFt, heightFt, pieces, measurementLabel }) => ({
            itemId,
            itemName,
            qty,
            price,
            unit,
            lengthFt,
            heightFt,
            pieces,
            measurementLabel,
          })
        ),
        createdAt: Date.now(),
      });
    });

    if (download) {
      generateInvoicePDF({
        businessName: "Hazra Workshop",
        businessSubline: "Steel Grill, Gate, Railing & Fabrication - Kolkata, West Bengal",
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        workNote: workNote.trim(),
        items: lineItems.map(({ itemName, qty, price, unit, measurementLabel }) => ({
          itemName,
          qty,
          price,
          unit,
          measurementLabel,
        })),
        subtotal,
        gstEnabled,
        gstRate,
        cgst,
        sgst,
        grandTotal,
      });
    }

    setCart({});
    setWorkNote("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Generate Grill Bill">
      <div className="space-y-4">
        {!fixedCustomer && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-[#1a73e8]"
            >
              <option value="">Select customer</option>
              {customers
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Work / site note</label>
          <input
            value={workNote}
            onChange={(e) => setWorkNote(e.target.value)}
            placeholder="e.g. Behala balcony grill, 2nd floor"
            className="h-12 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#1a73e8]"
          />
        </div>

        {inventory.length === 0 ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
            Add rate-list items in Inventory first. Use Sq Ft for grills, Running Ft for railings,
            Kg for iron material, and Pcs for fittings.
          </p>
        ) : (
          <div className="max-h-[42vh] space-y-2 overflow-y-auto no-scrollbar">
            {inventory.map((item) => {
              const unit = unitOf(item);
              const draft = item.id != null ? cart[item.id] : undefined;
              const qty = draft ? calcQty(item, draft) : 0;
              const amount = qty * item.sellingPrice;
              const exceedsStock = qty > item.stockQuantity;

              return (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a73e8]/10 text-[#1a73e8]">
                      <Calculator size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.itemName}</p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(item.sellingPrice)} / {unitLabel(unit)} | Stock {item.stockQuantity} {unitLabel(unit)}
                      </p>
                    </div>
                    {!draft ? (
                      <button
                        onClick={() => setDraft(item, unit === "sqft" ? { pieces: "1" } : { qty: "1" })}
                        className="rounded-lg bg-[#1a73e8] px-3 py-2 text-xs font-semibold text-white active:bg-blue-700"
                      >
                        Add
                      </button>
                    ) : (
                      <button
                        onClick={() => item.id != null && removeDraft(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {draft && (
                    <div className="mt-3 space-y-2">
                      {unit === "sqft" ? (
                        <div className="grid grid-cols-3 gap-2">
                          <MiniField
                            label="Length ft"
                            value={draft.lengthFt}
                            onChange={(v) => setDraft(item, { lengthFt: v })}
                          />
                          <MiniField
                            label="Height ft"
                            value={draft.heightFt}
                            onChange={(v) => setDraft(item, { heightFt: v })}
                          />
                          <MiniField
                            label="Pcs"
                            value={draft.pieces}
                            onChange={(v) => setDraft(item, { pieces: v })}
                          />
                        </div>
                      ) : (
                        <div className="flex items-end gap-2">
                          <MiniField
                            label={`Qty (${unitLabel(unit)})`}
                            value={draft.qty}
                            onChange={(v) => setDraft(item, { qty: v })}
                          />
                          {unit === "pcs" && (
                            <>
                              <button
                                onClick={() => setDraft(item, { qty: String(Math.max(0, num(draft.qty) - 1)) })}
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"
                              >
                                <Minus size={15} />
                              </button>
                              <button
                                onClick={() => setDraft(item, { qty: String(num(draft.qty) + 1) })}
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"
                              >
                                <Plus size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      <div
                        className={`flex justify-between rounded-lg px-2 py-1.5 text-xs ${
                          exceedsStock ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500"
                        }`}
                      >
                        <span>{measurementLabel(item, draft, qty)}</span>
                        <span className="font-semibold">{formatCurrency(amount)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasStockError && (
          <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
            One or more billed quantities are higher than available stock. Adjust stock or quantity.
          </p>
        )}

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <label className="text-sm font-medium text-slate-700">Apply GST</label>
          <button
            onClick={() => setGstEnabled((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${gstEnabled ? "bg-[#1a73e8]" : "bg-slate-300"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                gstEnabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {gstEnabled && (
          <div className="flex gap-2">
            {[5, 12, 18, 28].map((r) => (
              <button
                key={r}
                onClick={() => setGstRate(r)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                  gstRate === r
                    ? "border-[#1a73e8] bg-[#1a73e8]/10 text-[#1a73e8]"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                {r}%
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
          <Row label="Subtotal" value={formatCurrency(subtotal)} />
          {gstEnabled && (
            <>
              <Row label={`CGST (${gstRate / 2}%)`} value={formatCurrency(cgst)} />
              <Row label={`SGST (${gstRate / 2}%)`} value={formatCurrency(sgst)} />
            </>
          )}
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-800">
            <span>Grand Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => finalizeBill(false)}
            disabled={!selectedCustomer || lineItems.length === 0 || hasStockError}
            className="h-12 rounded-xl border border-[#1a73e8] font-semibold text-[#1a73e8] disabled:opacity-40"
          >
            Save Bill
          </button>
          <button
            onClick={() => finalizeBill(true)}
            disabled={!selectedCustomer || lineItems.length === 0 || hasStockError}
            className="flex h-12 items-center justify-center gap-1 rounded-xl bg-[#1a73e8] font-semibold text-white disabled:opacity-40"
          >
            <FileDown size={16} /> PDF
          </button>
        </div>

        {!selectedCustomer && (
          <p className="text-center text-xs text-slate-400">Select a customer before saving the bill.</p>
        )}
      </div>
    </Sheet>
  );
}

function MiniField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[11px] font-medium text-slate-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="0"
        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-[#1a73e8]"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-500">
      <span>{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}