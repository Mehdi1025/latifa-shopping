"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import type { Produit } from "@/types/produit";
import {
  CAISSE_COULEUR_DEFAUT,
  labelCouleurProduit,
  labelTailleProduit,
} from "@/lib/caisse/catalogue-groupes";

type StockVarianteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modeleNom: string;
  variantes: Produit[];
  formatPrix: (n: number) => string;
};

export default function StockVarianteSheet({
  open,
  onOpenChange,
  modeleNom,
  variantes,
  formatPrix,
}: StockVarianteSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [colorSelected, setColorSelected] = useState<string | null>(null);

  const couleursToutes = useMemo(() => {
    const set = new Set<string>();
    for (const v of variantes) {
      set.add(labelCouleurProduit(v));
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
  }, [variantes]);

  const prixAffiche = useMemo(() => {
    if (variantes.length === 0) return { kind: "single" as const, value: 0 };
    const ps = variantes.map((v) => v.prix);
    const a = Math.min(...ps);
    const b = Math.max(...ps);
    if (a === b) return { kind: "single" as const, value: a };
    return { kind: "range" as const, min: a, max: b };
  }, [variantes]);

  const variantesPourCouleur = useMemo(() => {
    if (colorSelected == null) return [];
    return variantes
      .filter((v) => labelCouleurProduit(v) === colorSelected)
      .sort((a, b) =>
        labelTailleProduit(a).localeCompare(labelTailleProduit(b), "fr", {
          numeric: true,
          sensitivity: "base",
        })
      );
  }, [variantes, colorSelected]);

  const reset = useCallback(() => {
    setStep(1);
    setColorSelected(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (couleursToutes.length === 1) {
      setColorSelected(couleursToutes[0]!);
      setStep(2);
    } else {
      setStep(1);
      setColorSelected(null);
    }
  }, [open, couleursToutes, reset]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const handleFermer = () => onOpenChange(false);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200]">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
            aria-label="Fermer"
            onClick={handleFermer}
          />
          <motion.aside
            data-skip-ean-capture
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-modele-titre"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.6 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-gray-200/80 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 p-4 pb-3 sm:p-5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Inventaire — lecture seule
                </p>
                <h2
                  id="stock-modele-titre"
                  className="mt-1 text-lg font-bold tracking-tight text-gray-900 sm:text-xl"
                >
                  {modeleNom}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {prixAffiche.kind === "range" ? (
                    <>
                      {formatPrix(prixAffiche.min)} — {formatPrix(prixAffiche.max)}
                    </>
                  ) : (
                    formatPrix(prixAffiche.value)
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleFermer}
                className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl text-gray-500 transition hover:bg-gray-100"
                aria-label="Fermer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {step === 2 && couleursToutes.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setColorSelected(null);
                  }}
                  className="mb-4 flex min-h-12 items-center gap-2 rounded-2xl px-1 text-sm font-semibold text-gray-600 transition hover:text-gray-900"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Changer de couleur
                </button>
              )}

              {step === 1 && (
                <div>
                  <p className="mb-3 text-sm font-semibold text-gray-700">Couleur</p>
                  {couleursToutes.length === 0 ? (
                    <p className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                      Aucune variante pour ce modèle.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {couleursToutes.map((c) => {
                        const stockCouleur = variantes
                          .filter((v) => labelCouleurProduit(v) === c)
                          .reduce((s, v) => s + v.stock, 0);
                        return (
                          <li key={c}>
                            <button
                              type="button"
                              onClick={() => {
                                setColorSelected(c);
                                setStep(2);
                              }}
                              className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-gray-200 bg-gray-50/80 px-4 py-3 text-center transition hover:border-gray-900 hover:bg-white active:scale-[0.99]"
                            >
                              <span className="text-base font-semibold text-gray-900">
                                {c === CAISSE_COULEUR_DEFAUT ? (
                                  <span className="text-gray-600">{c}</span>
                                ) : (
                                  c
                                )}
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  stockCouleur > 0 ? "text-emerald-600" : "text-red-600"
                                }`}
                              >
                                Σ stock {stockCouleur}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {step === 2 && colorSelected != null && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-700">Tailles & stock</p>
                  <p className="mb-4 text-xs text-gray-500">
                    Couleur :{" "}
                    <span className="font-medium text-gray-800">{colorSelected}</span>
                  </p>
                  {variantesPourCouleur.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucune ligne pour cette couleur.</p>
                  ) : (
                    <ul className="space-y-3">
                      {variantesPourCouleur.map((produit) => {
                        const st = produit.stock;
                        const ok = st > 0;
                        return (
                          <li
                            key={produit.id}
                            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3"
                          >
                            <div
                              className={`h-3 w-3 shrink-0 rounded-full ${
                                ok ? "bg-emerald-500" : "bg-red-500"
                              }`}
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900">
                                Taille {labelTailleProduit(produit)}
                              </p>
                              <p className="text-xs text-gray-500">
                                EAN {produit.code_barre?.trim() || "—"}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p
                                className={`text-2xl font-black tabular-nums ${
                                  ok ? "text-emerald-700" : "text-red-600"
                                }`}
                              >
                                {st}
                              </p>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                                en stock
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
