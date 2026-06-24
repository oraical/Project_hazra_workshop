import Dexie, { type Table } from "dexie";

// ----------------------------------------------------------------------------
// Data Models
// ----------------------------------------------------------------------------

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  createdAt: number;
}

export type TxnType = "gave" | "got"; // gave = Diya (credit given), got = Liya (received)

export type BusinessUnit = "sqft" | "rft" | "pcs" | "kg" | "meter";

export const BUSINESS_UNITS: { value: BusinessUnit; label: string; hint: string }[] = [
  { value: "sqft", label: "Sq Ft", hint: "Window grill, balcony grill, gate panel" },
  { value: "rft", label: "Running Ft", hint: "Railing, pipe, angle, channel" },
  { value: "pcs", label: "Pcs", hint: "Locks, hinges, frames, fitting charges" },
  { value: "kg", label: "Kg", hint: "MS rod, flat bar, iron material" },
  { value: "meter", label: "Meter", hint: "Long materials measured in meter" },
];

export interface Transaction {
  id?: number;
  customerId: number;
  type: TxnType;
  amount: number;
  note: string;
  // Optional line items linked to inventory
  items?: BillLineItem[];
  createdAt: number;
}

export interface BillLineItem {
  itemId?: number;
  itemName: string;
  qty: number;
  price: number; // selling price at time of sale
  unit?: BusinessUnit;
  lengthFt?: number;
  heightFt?: number;
  pieces?: number;
  measurementLabel?: string;
}

export interface InventoryItem {
  id?: number; // itemId
  itemName: string;
  unit?: BusinessUnit;
  stockQuantity: number;
  purchasePrice: number;
  sellingPrice: number;
  lowStockThreshold: number;
  createdAt: number;
}

// ----------------------------------------------------------------------------
// Dexie Database
// ----------------------------------------------------------------------------

export class KhataDB extends Dexie {
  customers!: Table<Customer, number>;
  transactions!: Table<Transaction, number>;
  inventory!: Table<InventoryItem, number>;

  constructor() {
    super("MeraKhataDB");
    this.version(1).stores({
      customers: "++id, name, phone, createdAt",
      transactions: "++id, customerId, type, createdAt",
      inventory: "++id, itemName, stockQuantity, createdAt",
    });
  }
}

export const db = new KhataDB();

// ----------------------------------------------------------------------------
// Backup / Restore utilities
// ----------------------------------------------------------------------------

export interface BackupPayload {
  meta: {
    app: "MeraKhata";
    version: number;
    exportedAt: string;
  };
  customers: Customer[];
  transactions: Transaction[];
  inventory: InventoryItem[];
}

export async function exportAllData(): Promise<BackupPayload> {
  const [customers, transactions, inventory] = await Promise.all([
    db.customers.toArray(),
    db.transactions.toArray(),
    db.inventory.toArray(),
  ]);

  return {
    meta: {
      app: "MeraKhata",
      version: 1,
      exportedAt: new Date().toISOString(),
    },
    customers,
    transactions,
    inventory,
  };
}

export async function importAllData(payload: BackupPayload): Promise<void> {
  if (!payload || payload.meta?.app !== "MeraKhata") {
    throw new Error("Invalid backup file. This does not look like a MeraKhata backup.");
  }

  await db.transaction("rw", db.customers, db.transactions, db.inventory, async () => {
    // Wipe out stale collections
    await Promise.all([db.customers.clear(), db.transactions.clear(), db.inventory.clear()]);

    // Populate fresh arrays
    if (payload.customers?.length) await db.customers.bulkAdd(payload.customers);
    if (payload.transactions?.length) await db.transactions.bulkAdd(payload.transactions);
    if (payload.inventory?.length) await db.inventory.bulkAdd(payload.inventory);
  });
}

export async function clearAllData(): Promise<void> {
  await db.transaction("rw", db.customers, db.transactions, db.inventory, async () => {
    await Promise.all([db.customers.clear(), db.transactions.clear(), db.inventory.clear()]);
  });
}

// ----------------------------------------------------------------------------
// Domain helpers
// ----------------------------------------------------------------------------

/**
 * Net balance for a customer based on their transactions.
 * Positive => customer OWES you (you gave more credit than you got back).
 * Negative => YOU owe the customer (advance).
 */
export function netBalance(txns: Transaction[]): number {
  return txns.reduce((acc, t) => acc + (t.type === "gave" ? t.amount : -t.amount), 0);
}

export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  return "₹" + abs.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function unitLabel(unit?: BusinessUnit): string {
  const found = BUSINESS_UNITS.find((u) => u.value === unit);
  return found?.label ?? "Sq Ft";
}

export function roundQty(n: number): number {
  return Math.round(n * 100) / 100;
}
