import { BookOpen, Package, Settings } from "lucide-react";

export type Tab = "ledger" | "inventory" | "settings";

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
}

const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
  { key: "ledger", label: "Ledger", icon: BookOpen },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-md">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="touch-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5"
            >
              <Icon
                size={22}
                className={isActive ? "text-[#1a73e8]" : "text-slate-400"}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span
                className={`text-[11px] font-medium ${
                  isActive ? "text-[#1a73e8]" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
