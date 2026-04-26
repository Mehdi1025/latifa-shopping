"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/** Coupures en euros (billets + pièces) — comptage détaillé (blind count). */
export const COUPURES_BILLETS = [200, 100, 50, 20, 10, 5] as const;
export const COUPURES_PIECES = [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] as const;

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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (totalDeclare: number) => void;
  loading: boolean;
  fond: number;
};

export default function ComptageCaisseModal({
  open,
  onOpenChange,
  onSubmit,
  loading,
  fond,
}: Props) {
  const [quantities, setQuantities] = useState<Record<DenomKey, string>>(
    () => buildInitialQuantities()
  );

  const parseQty = (raw: string): number => {
    const s = raw.trim().replace(/\s/g, "");
    if (s === "") return 0;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

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
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[200] cursor-default bg-gray-900/50 backdrop-blur-sm"
            aria-label="Fermer"
          />
          <motion.div
            data-skip-ean-capture
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="fixed left-1/2 top-1/2 z-[210] max-h-[min(92dvh,720px)] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-gray-100"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Comptage de caisse</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Comptage détaillé (billets et pièces) — le total est calculé
                  automatiquement.
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  Fond de caisse (référence) : {formatMoneyFr(fond)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-2 text-sm font-medium text-gray-800">Billets</p>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {COUPURES_BILLETS.map((d) => (
                <label
                  key={d}
                  className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 px-2.5 py-2"
                >
                  <span className="text-xs font-medium text-gray-600">
                    {formatCoupureLabel(d)}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantities[String(d)]}
                    onChange={(e) => setQty(String(d), e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900"
                    placeholder="0"
                  />
                </label>
              ))}
            </div>

            <p className="mb-2 text-sm font-medium text-gray-800">Pièces</p>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {COUPURES_PIECES.map((d) => (
                <label
                  key={d}
                  className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/50 px-2.5 py-2"
                >
                  <span className="text-xs font-medium text-gray-600">
                    {formatCoupureLabel(d)}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantities[String(d)]}
                    onChange={(e) => setQty(String(d), e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900"
                    placeholder="0"
                  />
                </label>
              ))}
            </div>

            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                Total déclaré
              </p>
              <p className="text-2xl font-bold tabular-nums text-emerald-900">
                {formatMoneyFr(totalDeclare)}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => onSubmit(totalDeclare)}
                className="rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? "Validation…" : "Valider la clôture"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
