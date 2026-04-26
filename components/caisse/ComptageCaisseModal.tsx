"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/** Coupures (spec POS) — billets et pièces */
export const COUPURES_BILLETS = [100, 50, 20, 10, 5] as const;
export const COUPURES_PIECES = [2, 1, 0.5, 0.2, 0.1] as const;

function formatCoupureLabel(euros: number): string {
  if (euros >= 1) return `${euros} €`;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}

function formatMoneyFr(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

type DenomKey = string;

function buildInitialQuantities(): Record<DenomKey, string> {
  const o: Record<DenomKey, string> = {};
  for (const d of COUPURES_BILLETS) o[String(d)] = "";
  for (const d of COUPURES_PIECES) o[String(d)] = "";
  return o;
}

function parseQty(raw: string): number {
  const s = raw.trim().replace(/\s/g, "");
  if (s === "") return 0;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function buildDetailsComptage(
  quantities: Record<DenomKey, string>
): Record<string, number> {
  const o: Record<string, number> = {};
  for (const d of COUPURES_BILLETS) {
    const n = parseQty(quantities[String(d)] ?? "");
    if (n > 0) o[String(d)] = n;
  }
  for (const d of COUPURES_PIECES) {
    const n = parseQty(quantities[String(d)] ?? "");
    if (n > 0) o[String(d)] = n;
  }
  return o;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (totalDeclare: number, detailsComptage: Record<string, number>) => void;
  loading: boolean;
  fondInitial: number;
};

export default function ComptageCaisseModal({
  open,
  onOpenChange,
  onSubmit,
  loading,
  fondInitial,
}: Props) {
  const [quantities, setQuantities] = useState<Record<DenomKey, string>>(
    () => buildInitialQuantities()
  );

  const totalDeclare = useMemo(() => {
    let s = 0;
    for (const d of COUPURES_BILLETS) {
      s += d * parseQty(quantities[String(d)] ?? "");
    }
    for (const d of COUPURES_PIECES) {
      s += d * parseQty(quantities[String(d)] ?? "");
    }
    return Math.round(s * 100) / 100;
  }, [quantities]);

  const reset = useCallback(() => {
    setQuantities(buildInitialQuantities());
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    reset();
  }, [onOpenChange, reset]);

  const setQty = (key: string, value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setQuantities((prev) => ({ ...prev, [key]: value }));
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-skip-ean-capture
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[220] flex flex-col bg-white"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-gray-900">
                Clôture de Caisse
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Saisissez le nombre de billets et de pièces. Le total est calculé
                automatiquement.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Fond initial de la session :{" "}
                <span className="font-semibold text-gray-900">
                  {formatMoneyFr(fondInitial)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fermer"
            >
              <X className="h-6 w-6" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6">
            <p className="mb-2 text-sm font-medium text-gray-800">Billets</p>
            <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:max-w-2xl">
              {COUPURES_BILLETS.map((d) => (
                <label
                  key={d}
                  className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2.5"
                >
                  <span className="text-xs font-medium text-gray-600">
                    {formatCoupureLabel(d)}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantities[String(d)]}
                    onChange={(e) => setQty(String(d), e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-base text-gray-900"
                    placeholder="0"
                  />
                </label>
              ))}
            </div>

            <p className="mb-2 text-sm font-medium text-gray-800">Pièces</p>
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:max-w-2xl">
              {COUPURES_PIECES.map((d) => (
                <label
                  key={d}
                  className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2.5"
                >
                  <span className="text-xs font-medium text-gray-600">
                    {formatCoupureLabel(d)}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantities[String(d)]}
                    onChange={(e) => setQty(String(d), e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-base text-gray-900"
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </div>

          <footer className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
            <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                Total déclaré
              </p>
              <p className="text-2xl font-bold tabular-nums text-emerald-950">
                {formatMoneyFr(totalDeclare)}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="min-h-12 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  onSubmit(totalDeclare, buildDetailsComptage(quantities))
                }
                className="min-h-12 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? "Validation…" : "Valider la clôture"}
              </button>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
