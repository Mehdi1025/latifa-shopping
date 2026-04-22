"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { MouvementStock, MouvementStockType } from "@/types/produit";

function formatMouvementWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const t = d.getTime();
  if (t >= startOfToday.getTime()) {
    return `Aujourd'hui à ${d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  if (t >= startOfYesterday.getTime() && t < startOfToday.getTime()) {
    return `Hier à ${d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function iconeType(t: MouvementStockType): string {
  switch (t) {
    case "VENTE":
      return "🛒";
    case "RECEPTION":
      return "📦";
    case "RETOUR":
      return "↩️";
    case "INVENTAIRE":
      return "✍️";
    default:
      return "•";
  }
}

type StockMouvementsHistoriqueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produitId: string | null;
  /** Sous-titre (ex. EAN tronqué) */
  sousTitre?: string | null;
};

export default function StockMouvementsHistoriqueDialog({
  open,
  onOpenChange,
  produitId,
  sousTitre,
}: StockMouvementsHistoriqueDialogProps) {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!produitId) return;
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("mouvements_stock")
      .select("id, produit_id, quantite, type_mouvement, reference, created_at")
      .eq("produit_id", produitId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      setErr(error.message);
      setMouvements([]);
      return;
    }
    setMouvements((data as MouvementStock[]) ?? []);
  }, [produitId, supabase]);

  useEffect(() => {
    if (open && produitId) void load();
  }, [open, produitId, load]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            aria-label="Fermer"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            data-skip-ean-capture
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            className="relative z-10 flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[min(85dvh,560px)] sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Historique des stocks
                </h2>
                {sousTitre && (
                  <p className="mt-0.5 text-xs text-slate-500">{sousTitre}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                </div>
              ) : err ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </p>
              ) : mouvements.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Aucun mouvement enregistré pour cette variante.
                </p>
              ) : (
                <ul className="space-y-0">
                  {mouvements.map((m) => (
                    <li
                      key={m.id}
                      className="relative border-l-2 border-slate-200 pl-5 pr-0 pb-6 last:pb-0"
                    >
                      <span
                        className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-300 ring-1 ring-slate-200"
                        aria-hidden
                      />
                      <p className="text-xs font-medium text-slate-500">
                        {formatMouvementWhen(m.created_at)}
                      </p>
                      <p className="mt-1 flex flex-wrap items-baseline gap-2">
                        <span className="text-base" title={m.type_mouvement}>
                          {iconeType(m.type_mouvement)}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {m.type_mouvement}
                        </span>
                        <span
                          className={
                            m.quantite > 0
                              ? "text-base font-bold tabular-nums text-emerald-600"
                              : m.quantite < 0
                                ? "text-base font-bold tabular-nums text-red-600"
                                : "text-base font-bold tabular-nums text-slate-600"
                          }
                        >
                          {m.quantite > 0
                            ? `+${m.quantite}`
                            : m.quantite < 0
                              ? `${m.quantite}`
                              : "0"}
                        </span>
                      </p>
                      {m.reference && (
                        <p className="mt-1 break-words text-xs text-slate-400">
                          {m.reference}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
