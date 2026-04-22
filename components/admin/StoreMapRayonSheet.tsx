"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { Produit } from "@/types/produit";
import { RUPTURE_SEUIL, estRuptureOuUrgent } from "@/lib/admin/store-map-zones";

type StoreMapRayonSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sousTitre?: string;
  produits: Produit[];
};

function formatPrix(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export default function StoreMapRayonSheet({
  open,
  onOpenChange,
  title,
  sousTitre,
  produits,
}: StoreMapRayonSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200]">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-label="Fermer"
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200/80 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            data-skip-ean-capture
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                {sousTitre && (
                  <p className="mt-0.5 text-sm text-slate-500">{sousTitre}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 pb-6">
              {produits.length === 0 ? (
                <p className="px-2 py-10 text-center text-sm text-slate-500">
                  Aucun article dans ce périmètre.
                </p>
              ) : (
                <ul className="space-y-2">
                  {produits.map((p) => {
                    const urgent = estRuptureOuUrgent(p.stock);
                    return (
                      <li key={p.id}>
                        <div
                          className={[
                            "rounded-2xl border px-3 py-3 transition-colors",
                            urgent
                              ? "border-amber-300/80 bg-amber-50/90 ring-1 ring-amber-200/60"
                              : "border-slate-100 bg-slate-50/50",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-sm font-semibold text-slate-900">
                              {p.nom}
                            </p>
                            <span
                              className={[
                                "shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums",
                                urgent
                                  ? "bg-red-100 text-red-800"
                                  : "bg-emerald-100/80 text-emerald-800",
                              ].join(" ")}
                            >
                              {p.stock} u.
                            </span>
                          </div>
                          {(p.couleur || p.taille) && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {[p.couleur, p.taille].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {p.categorie && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {p.categorie}
                            </p>
                          )}
                          {urgent && (
                            <p className="mt-2 text-xs font-medium text-amber-900/90">
                              {p.stock === 0
                                ? "Réassort requis — rupture"
                                : "Réassort requis — stock critique"}
                            </p>
                          )}
                          <p className="mt-1 text-right text-xs text-slate-500">
                            {formatPrix(p.prix)}
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
