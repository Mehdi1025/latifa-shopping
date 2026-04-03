"use client";

import { CreditCard, Banknote, Smartphone } from "lucide-react";

export type MethodePaiement = "carte" | "especes" | "paypal";

const OPTIONS: {
  id: MethodePaiement;
  label: string;
  /** Libellé court pour badges admin */
  shortLabel: string;
  icon: typeof CreditCard;
  selectedRing: string;
  selectedBg: string;
  idleBorder: string;
  idleBg: string;
  iconClass: string;
}[] = [
  {
    id: "carte",
    label: "Carte Bancaire",
    shortLabel: "CB",
    icon: CreditCard,
    selectedRing: "ring-2 ring-blue-500 ring-offset-2 ring-offset-white",
    selectedBg: "bg-gradient-to-br from-blue-50 to-indigo-50/90",
    idleBorder: "border border-blue-100/80",
    idleBg: "bg-white hover:bg-blue-50/50",
    iconClass: "text-blue-600",
  },
  {
    id: "especes",
    label: "Espèces",
    shortLabel: "Esp.",
    icon: Banknote,
    selectedRing: "ring-2 ring-emerald-500 ring-offset-2 ring-offset-white",
    selectedBg: "bg-gradient-to-br from-emerald-50 to-teal-50/80",
    idleBorder: "border border-emerald-100/80",
    idleBg: "bg-white hover:bg-emerald-50/50",
    iconClass: "text-emerald-600",
  },
  {
    id: "paypal",
    label: "PayPal",
    shortLabel: "PayPal",
    icon: Smartphone,
    selectedRing: "ring-2 ring-[#003087] ring-offset-2 ring-offset-white",
    selectedBg: "bg-gradient-to-br from-[#e6f0ff] to-[#cfe2ff]/90",
    idleBorder: "border border-sky-200/80",
    idleBg: "bg-white hover:bg-sky-50/60",
    iconClass: "text-[#003087]",
  },
];

type SelectorProps = {
  value: MethodePaiement;
  onChange: (v: MethodePaiement) => void;
  className?: string;
};

/** Grandes cartes cliquables pour la caisse vendeuse. */
export function MoyenPaiementSelector({ value, onChange, className = "" }: SelectorProps) {
  return (
    <div className={className}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Moyen de paiement
      </p>
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {OPTIONS.map((opt) => {
          const selected = value === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={selected}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3.5 text-center transition-all duration-200 active:scale-[0.98] md:min-h-[112px] md:gap-2 md:px-3 md:py-5 ${
                selected
                  ? `${opt.selectedRing} ${opt.selectedBg} shadow-md`
                  : `${opt.idleBorder} ${opt.idleBg} shadow-sm`
              }`}
            >
              <Icon className={`h-6 w-6 shrink-0 md:h-8 md:w-8 ${opt.iconClass}`} strokeWidth={1.75} />
              <span className="text-[11px] font-semibold leading-tight text-gray-900 md:text-sm">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const BADGE_CLASS: Record<MethodePaiement, string> = {
  carte: "bg-blue-100 text-blue-800 ring-blue-200/60",
  especes: "bg-emerald-100 text-emerald-800 ring-emerald-200/60",
  paypal: "bg-sky-100 text-[#003087] ring-sky-300/50",
};

type BadgeProps = {
  methode: MethodePaiement | string | null | undefined;
  className?: string;
};

/** Badge compact pour listes admin (icône + libellé court). */
export function MethodePaiementBadge({ methode, className = "" }: BadgeProps) {
  const m = methode as MethodePaiement | undefined;
  if (m !== "carte" && m !== "especes" && m !== "paypal") return null;
  const opt = OPTIONS.find((o) => o.id === m)!;
  const Icon = opt.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${BADGE_CLASS[m]} ${className}`}
      title={opt.label}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
      <span className="whitespace-nowrap">{opt.shortLabel}</span>
    </span>
  );
}
