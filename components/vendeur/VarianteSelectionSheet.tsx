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

type VarianteSelectionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modeleNom: string;
  variantes: Produit[];
  formatPrix: (n: number) => string;
  onChoisirVariante: (p: Produit) => void;
  /** Affiche toutes les couleurs/tailles y compris rupture (scan « Info stock »). */
  modeConsultationStock?: boolean;
};

export default function VarianteSelectionSheet({
  open,
  onOpenChange,
  modeleNom,
  variantes,
  formatPrix,
  onChoisirVariante,
  modeConsultationStock = false,
}: VarianteSelectionSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [colorSelected, setColorSelected] = useState<string | null>(null);

  const couleursDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const v of variantes) {
      if (modeConsultationStock || v.stock > 0) set.add(labelCouleurProduit(v));
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
  }, [variantes, modeConsultationStock]);

  const prixAffiche = useMemo(() => {
    if (variantes.length === 0) return { kind: "single" as const, value: 0 };
    const ps = variantes.map((v) => v.prix);
    const a = Math.min(...ps);
    const b = Math.max(...ps);
    if (a === b) return { kind: "single" as const, value: a };
    return { kind: "range" as const, min: a, max: b };
  }, [variantes]);

  const variantesPourTaille = useMemo(() => {
    if (colorSelected == null) return [];
    return variantes.filter((v) => {
      if (labelCouleurProduit(v) !== colorSelected) return false;
      return modeConsultationStock || v.stock > 0;
    });
  }, [variantes, colorSelected, modeConsultationStock]);

  const tailleEntries = useMemo(() => {
    const map = new Map<string, Produit>();
    for (const v of variantesPourTaille) {
      const t = labelTailleProduit(v);
      if (!map.has(t)) map.set(t, v);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "fr", { numeric: true, sensitivity: "base" })
    );
  }, [variantesPourTaille]);

  const reset = useCallback(() => {
    setStep(1);
    setColorSelected(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const couleurs = new Set<string>();
    for (const v of variantes) {
      if (modeConsultationStock || v.stock > 0) couleurs.add(labelCouleurProduit(v));
    }
    const arr = Array.from(couleurs).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
    if (arr.length === 1) {
      setColorSelected(arr[0]!);
      setStep(2);
    } else {
      setStep(1);
      setColorSelected(null);
    }
  }, [open, variantes, reset, modeConsultationStock]);

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

  const handleFermer = () => {
    onOpenChange(false);
  };

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
            aria-label="Fermer le panneau"
            onClick={handleFermer}
          />
          <motion.aside
            data-skip-ean-capture
            role="dialog"
            aria-modal="true"
            aria-labelledby="caisse-modele-titre"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.6 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-gray-200/80 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 p-4 pb-3 sm:p-5">
              <div className="min-w-0 flex-1">
                <h2
                  id="caisse-modele-titre"
                  className="text-lg font-bold tracking-tight text-gray-900 sm:text-xl"
                >
                  {modeleNom}
                  {modeConsultationStock && (
                    <span className="ml-2 align-middle text-xs font-semibold normal-case text-blue-600">
                      · Info stock
                    </span>
                  )}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {prixAffiche.kind === "range" ? (
                    <>
                      À partir de{" "}
                      <span className="font-semibold text-gray-900">
                        {formatPrix(prixAffiche.min)}
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-gray-900">
                      {formatPrix(prixAffiche.value)}
                    </span>
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
              {step === 2 && couleursDisponibles.length > 1 && (
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
                  <p className="mb-3 text-sm font-semibold text-gray-700">
                    1. Couleur
                  </p>
                  {couleursDisponibles.length === 0 ? (
                    <p className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                      Aucune variante disponible pour ce modèle.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {couleursDisponibles.map((c) => (
                        <li key={c}>
                          <button
                            type="button"
                            onClick={() => {
                              setColorSelected(c);
                              setStep(2);
                            }}
                            className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-gray-200 bg-gray-50/80 px-4 text-base font-semibold text-gray-900 transition hover:border-gray-900 hover:bg-white active:scale-[0.99]"
                          >
                            {c === CAISSE_COULEUR_DEFAUT ? (
                              <span className="text-gray-600">{c}</span>
                            ) : (
                              c
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {step === 2 && colorSelected != null && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-700">
                    2. Taille
                  </p>
                  <p className="mb-3 text-xs text-gray-500">
                    Couleur :{" "}
                    <span className="font-medium text-gray-800">{colorSelected}</span>
                  </p>
                  {tailleEntries.length === 0 ? (
                    <p className="text-sm text-gray-500">Rupture pour cette couleur.</p>
                  ) : (
                    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                      {tailleEntries.map(([taille, produit]) => {
                        const enRupture = produit.stock < 1;
                        return (
                          <li key={taille + produit.id}>
                            <button
                              type="button"
                              disabled={modeConsultationStock && enRupture}
                              onClick={() => {
                                if (enRupture) return;
                                onChoisirVariante(produit);
                                onOpenChange(false);
                              }}
                              className={`flex aspect-square w-full min-h-14 min-w-14 max-w-full flex-col items-center justify-center rounded-2xl border-2 text-center text-base font-bold transition active:scale-[0.98] ${
                                enRupture
                                  ? "cursor-default border-gray-200 bg-gray-100 text-gray-500"
                                  : "border-gray-900 bg-gray-900 text-white hover:bg-gray-800"
                              }`}
                            >
                              <span className="leading-tight">{taille}</span>
                              <span
                                className={`mt-0.5 text-[10px] font-normal ${
                                  enRupture ? "text-amber-700" : "opacity-90"
                                }`}
                              >
                                {produit.stock} st.
                              </span>
                            </button>
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
