import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  accent?: "blue" | "green" | "red";
}

const accentMap = {
  blue: "bg-[#1a73e8]",
  green: "bg-emerald-600",
  red: "bg-red-600",
};

export default function Sheet({ open, onClose, title, children, accent = "blue" }: SheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl animate-slide-up no-scrollbar">
        <div
          className={`sticky top-0 z-10 flex items-center justify-between px-5 py-4 text-white ${accentMap[accent]}`}
        >
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="touch-target -mr-2 flex items-center justify-center rounded-full p-2 active:bg-white/20"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>
        <div className="px-5 pb-8 pt-5">{children}</div>
      </div>
    </div>
  );
}
