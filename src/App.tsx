import { useState } from "react";
import BottomNav, { type Tab } from "./components/BottomNav";
import LedgerView from "./views/LedgerView";
import CustomerView from "./views/CustomerView";
import InventoryView from "./views/InventoryView";
import SettingsView from "./views/SettingsView";

export default function App() {
  const [tab, setTab] = useState<Tab>("ledger");
  const [openCustomer, setOpenCustomer] = useState<number | null>(null);

  // Customer detail is a full-screen overlay over the ledger tab
  if (openCustomer !== null) {
    return (
      <div className="mx-auto min-h-screen max-w-md overflow-x-hidden bg-slate-100">
        <CustomerView customerId={openCustomer} onBack={() => setOpenCustomer(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md overflow-x-hidden bg-slate-100">
      {tab === "ledger" && <LedgerView onOpenCustomer={(id) => setOpenCustomer(id)} />}
      {tab === "inventory" && <InventoryView />}
      {tab === "settings" && <SettingsView />}

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
