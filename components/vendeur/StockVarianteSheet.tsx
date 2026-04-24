"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
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
};

export default function StockVarianteSheet({
  open,
  onOpenChange,
  modeleNom,
  variantes,
}: StockVarianteSheetProps) {
  const lignesTriees = useMemo(() => {
    return [...variantes].sort((a, b) => {
      const ca = labelCouleurProduit(a);
      const cb = labelCouleurProduit(b);
      const cmpC = ca.localeCompare(cb, "fr", { sensitivity: "base" });
      if (cmpC !== 0) return cmpC;
      return labelTailleProduit(a).localeCompare(labelTailleProduit(b), "fr", {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [variantes]);

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
                <p className="mt-1 text-xs text-amber-800/90">
                  Fermez ce panneau pour scanner un autre article.
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
              <p className="mb-3 text-sm font-semibold text-gray-700">
                Variantes (couleur · taille)
              </p>
              {lignesTriees.length === 0 ? (
                <p className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                  Aucune variante pour ce modèle.
                </p>
              ) : (
                <ul className="space-y-3">
                  {lignesTriees.map((produit) => {
                    const st = produit.stock;
                    const ok = st > 0;
                    const couleur = labelCouleurProduit(produit);
                    const couleurAff =
                      couleur === CAISSE_COULEUR_DEFAUT ? (
                        <span className="text-gray-600">{couleur}</span>
                      ) : (
                        couleur
                      );
                    return (
                      <li
                        key={produit.id}
                        className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3"
                      >
                        <div
                          className={`h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white ${
                            ok ? "bg-emerald-500" : "bg-red-600"
                          }`}
                          aria-hidden
                          title={ok ? "En stock" : "Rupture"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            <span>{couleurAff}</span>
                            <span className="text-gray-400"> · </span>
                            <span>Taille {labelTailleProduit(produit)}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            EAN {produit.code_barre?.trim() || "—"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-3xl font-black tabular-nums leading-none ${
                              ok ? "text-emerald-700" : "text-red-600"
                            }`}
                          >
                            {st}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            stock
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
