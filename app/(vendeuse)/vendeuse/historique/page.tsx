"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, CheckCircle, AlertCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type VenteItem = {
  produit_id: string;
  quantite: number;
};

type VenteHistorique = {
  id: string;
  total: number;
  created_at: string;
  ventes_items?: VenteItem[];
};

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(prix);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoriquePage() {
  const [ventes, setVentes] = useState<VenteHistorique[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const supabase = createSupabaseBrowserClient();

  const fetchVentes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setVentes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: ventesData } = await supabase
      .from("ventes")
      .select("id, total, created_at")
      .eq("vendeur_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (ventesData?.length) {
      const ids = ventesData.map((v) => v.id);
      const { data: items } = await supabase
        .from("ventes_items")
        .select("vente_id, produit_id, quantite")
        .in("vente_id", ids);
      const itemsByVente = (items ?? []).reduce<Record<string, VenteItem[]>>((acc, it) => {
        const v = it as { vente_id: string; produit_id: string; quantite: number };
        if (!acc[v.vente_id]) acc[v.vente_id] = [];
        acc[v.vente_id].push({ produit_id: v.produit_id, quantite: v.quantite });
        return acc;
      }, {});
      setVentes(
        (ventesData as VenteHistorique[]).map((v) => ({
          ...v,
          ventes_items: itemsByVente[v.id] ?? [],
        }))
      );
    } else {
      setVentes([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVentes();
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAnnuler = async (vente: VenteHistorique) => {
    if (!vente.ventes_items?.length) return;
    try {
      for (const item of vente.ventes_items) {
        const { data: prod } = await supabase
          .from("produits")
          .select("stock")
          .eq("id", item.produit_id)
          .single();
        const currentStock = (prod as { stock: number } | null)?.stock ?? 0;
        const { error: stockError } = await supabase
          .from("produits")
          .update({ stock: currentStock + item.quantite })
          .eq("id", item.produit_id);
        if (stockError) throw new Error(stockError.message);
      }
      await supabase.from("ventes_items").delete().eq("vente_id", vente.id);
      const { error: delError } = await supabase
        .from("ventes")
        .delete()
        .eq("id", vente.id);
      if (delError) throw new Error(delError.message);
      await fetchVentes();
      showToast("success", "Vente annulée. Stock restauré.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Erreur lors de l'annulation.");
    }
  };

  return (
    <div className="p-4 lg:p-6">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">
        Historique des ventes
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Vos 50 dernières ventes
      </p>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className={`fixed left-1/2 top-20 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl px-6 py-4 shadow-lg lg:top-8 ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-50 text-red-700 ring-1 ring-red-100"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="h-6 w-6 shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 shrink-0" />
            )}
            <span className="font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
        </div>
      ) : ventes.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          Aucune vente pour le moment.
        </p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {ventes.map((v) => (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-slate-100 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDate(v.created_at)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(v.ventes_items?.reduce((s, i) => s + i.quantite, 0) ?? 0)} article
                    {(v.ventes_items?.reduce((s, i) => s + i.quantite, 0) ?? 0) > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-base font-bold text-slate-900">{formatPrix(v.total)}</span>
                <button
                  type="button"
                  onClick={() => handleAnnuler(v)}
                  className="flex items-center gap-1.5 rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-all hover:bg-red-100 active:scale-95"
                  title="Annuler cette vente"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Annuler
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
