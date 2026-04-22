"use client";

import { useMemo } from "react";
import { PackagePlus } from "lucide-react";
import type { AlertItem } from "@/hooks/useAlerts";
import type { Produit } from "@/types/produit";

type ReceptionStockQuickLinksProps = {
  alerts: AlertItem[];
  produits: Produit[];
  onAddOne: (produitId: string) => void;
};

/**
 * Raccourcis pour les produits en stock critique (alertes useAlerts, id "stock-…")
 * afin d’ajouter 1 unité directement au lot de réception.
 */
export default function ReceptionStockQuickLinks({
  alerts,
  produits,
  onAddOne,
}: ReceptionStockQuickLinksProps) {
  const byId = useMemo(
    () => new Map(produits.map((p) => [p.id, p] as const)),
    [produits]
  );

  const items = useMemo(
    () =>
      alerts
        .filter((a) => a.id.startsWith("stock-"))
        .map((a) => {
          const id = a.id.slice("stock-".length);
          const p = byId.get(id);
          return p ? { a, p } : null;
        })
        .filter((x): x is { a: AlertItem; p: Produit } => x !== null),
    [alerts, byId]
  );

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-100/80 bg-amber-50/35 p-4 ring-1 ring-amber-100/60">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-900/70">
        Raccourci réception
      </p>
      <ul className="space-y-2.5">
        {items.map(({ a, p }) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 shadow-sm"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
              {p.nom}
            </span>
            <button
              type="button"
              onClick={() => onAddOne(p.id)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]"
            >
              <PackagePlus className="h-3.5 w-3.5" aria-hidden />
              +1
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
