"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, TrendingUp, Wallet, ShoppingBag } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  computeTopProductPairs,
  findBestPartnerForProduct,
  type DuoInsight,
} from "@/components/admin/CrossSellInsights";
import { segmenterRfm, type RfmClient } from "@/components/admin/CrmSegmentation";

type Produit = {
  id: string;
  nom: string;
  description: string | null;
  prix: number;
  stock: number;
  categorie: string | null;
};

type VenteRow = {
  id: string;
  total: number | null;
  created_at: string;
  client_id: string | null;
};

type VenteItemRow = { vente_id: string; produit_id: string; quantite: number | null };

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d;
  const parts = [d.slice(0, 2)];
  for (let i = 2; i < d.length; i += 2) {
    parts.push(d.slice(i, i + 2));
  }
  return parts.join(" ");
}

function initials(nom: string): string {
  return nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function daysAgo(iso: string): number {
  const a = new Date(iso);
  const b = new Date();
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (86400000)));
}

type ClientelingPanelProps = {
  clientId: string;
  clientNom: string;
  /** Chiffres normalisés pour affichage */
  phoneDigits: string;
  open: boolean;
  onClose: () => void;
  onAddRecommended: (produit: Produit) => void;
};

export default function ClientelingPanel({
  clientId,
  clientNom,
  phoneDigits,
  open,
  onClose,
  onAddRecommended,
}: ClientelingPanelProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<RfmClient["segment"] | null>(null);
  const [ltv, setLtv] = useState(0);
  const [aov, setAov] = useState(0);
  const [freq, setFreq] = useState(0);
  const [lastInsight, setLastInsight] = useState<string | null>(null);
  const [topProductName, setTopProductName] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<{
    produit: Produit;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !clientId) return;

    const run = async () => {
      setLoading(true);
      setRecommendation(null);
      setLastInsight(null);
      setTopProductName(null);

      try {
        const { data: ventesClient, error: ev } = await supabase
          .from("ventes")
          .select("id, total, created_at, client_id")
          .eq("client_id", clientId);

        if (ev) throw ev;

        const ventes = (ventesClient ?? []) as VenteRow[];
        const venteIds = ventes.map((v) => v.id);

        let itemsClient: VenteItemRow[] = [];
        if (venteIds.length > 0) {
          const { data: it, error: ei } = await supabase
            .from("ventes_items")
            .select("vente_id, produit_id, quantite")
            .in("vente_id", venteIds);
          if (ei) throw ei;
          itemsClient = (it ?? []) as VenteItemRow[];
        }

        const totalMontant = ventes.reduce((s, v) => s + (v.total ?? 0), 0);
        const n = ventes.length;
        setLtv(totalMontant);
        setFreq(n);
        setAov(n > 0 ? Math.round((totalMontant / n) * 100) / 100 : 0);

        const ventesParClient = new Map<string, VenteRow[]>();
        ventesParClient.set(clientId, ventes);

        const { rows: rfmRows } = segmenterRfm(
          [{ id: clientId, nom: clientNom, telephone: phoneDigits || null }],
          ventesParClient
        );
        const me = rfmRows.find((r) => r.id === clientId);
        setSegment(me?.segment ?? "regulier");

        const qtyByProd: Record<string, number> = {};
        itemsClient.forEach((it) => {
          const pid = it.produit_id;
          qtyByProd[pid] = (qtyByProd[pid] ?? 0) + (it.quantite ?? 0);
        });
        let topPid: string | null = null;
        let topQ = 0;
        Object.entries(qtyByProd).forEach(([pid, q]) => {
          if (q > topQ) {
            topQ = q;
            topPid = pid;
          }
        });

        const { data: produitsNom } = await supabase
          .from("produits")
          .select("id, nom");
        const nomById = Object.fromEntries(
          ((produitsNom ?? []) as { id: string; nom: string }[]).map((p) => [
            p.id,
            p.nom,
          ])
        );

        if (topPid) setTopProductName(nomById[topPid] ?? "Produit");

        const sortedVentes = [...ventes].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const lastVente = sortedVentes[0];
        if (lastVente) {
          const itemsLast = itemsClient.filter(
            (it) => it.vente_id === lastVente.id
          );
          let lastProdName = "un article";
          let lastQty = 0;
          itemsLast.forEach((it) => {
            const q = it.quantite ?? 0;
            if (q > lastQty) {
              lastQty = q;
              lastProdName = nomById[it.produit_id] ?? "un article";
            }
          });
          if (itemsLast.length && lastQty === 0) {
            lastProdName = nomById[itemsLast[0].produit_id] ?? "un article";
          }
          const j = daysAgo(lastVente.created_at);
          setLastInsight(
            `A acheté ${lastProdName} il y a ${j} jour${j > 1 ? "s" : ""}. Pensez à proposer l’accessoire assorti ou une pièce complémentaire de la même ligne.`
          );
        } else {
          setLastInsight(
            "Première visite enregistrée avec ce profil — créez une relation mémorable."
          );
        }

        const { data: allItems } = await supabase
          .from("ventes_items")
          .select("vente_id, produit_id");
        const { data: allProduits } = await supabase
          .from("produits")
          .select("id, nom, description, prix, stock, categorie");

        const globalNomById = Object.fromEntries(
          ((allProduits ?? []) as { id: string; nom: string }[]).map((p) => [
            p.id,
            p.nom,
          ])
        );

        const { duos } = computeTopProductPairs(
          (allItems ?? []) as { vente_id: string; produit_id: string }[],
          globalNomById,
          200
        );

        if (topPid) {
          const partner = findBestPartnerForProduct(duos as DuoInsight[], topPid);
          if (partner) {
            const row = (allProduits ?? []).find(
              (p: Produit) => p.id === partner.partnerId
            ) as Produit | undefined;
            if (row) {
              setRecommendation({
                produit: row,
                label: `Souvent acheté avec « ${nomById[topPid] ?? "cet article"} » (${partner.duo.count}× en magasin)`,
              });
            }
          }
        }
      } catch {
        setSegment("regulier");
        setLastInsight(
          "Données client en cours de chargement ou historique encore léger."
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open, clientId, clientNom, phoneDigits, supabase]);

  const badge = useMemo(() => {
    if (segment === "vip")
      return {
        text: "🌟 VIP",
        className:
          "bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 text-amber-950 shadow-[0_0_24px_rgba(251,191,36,0.45)]",
      };
    if (segment === "endormi")
      return {
        text: "⚠️ À relancer",
        className: "border border-orange-400/50 bg-orange-500/20 text-orange-100",
      };
    return {
      text: "👋 Régulier",
      className:
        "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
    };
  }, [segment]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-[2px]"
            aria-label="Fermer le panneau client"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-[210] flex h-full w-full max-w-md flex-col border-l border-white/10 bg-black/45 shadow-[-20px_0_60px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] to-transparent" />
            <div className="relative flex h-full flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5">
                <div className="flex min-w-0 flex-1 gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-white/15 to-white/5 text-xl font-light tracking-widest text-white">
                    {initials(clientNom)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg font-medium tracking-wide text-white">
                      {clientNom}
                    </p>
                    <p className="mt-1 text-sm text-white/50">
                      {formatPhoneDisplay(phoneDigits)}
                    </p>
                    <span
                      className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.text}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-6">
                {loading ? (
                  <div className="flex justify-center py-16">
                    <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  </div>
                ) : (
                  <div className="space-y-8">
                    <section>
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                        Stats clés
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="mb-2 flex items-center gap-2 text-white/50">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-[11px] uppercase tracking-wide">
                              Panier moyen
                            </span>
                          </div>
                          <p className="font-serif text-2xl font-light text-white">
                            {formatMoney(aov)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="mb-2 flex items-center gap-2 text-white/50">
                            <Wallet className="h-4 w-4" />
                            <span className="text-[11px] uppercase tracking-wide">
                              Total dépensé
                            </span>
                          </div>
                          <p className="font-serif text-2xl font-light text-white">
                            {formatMoney(ltv)}
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            {freq} commande{freq > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </section>

                    {lastInsight && (
                      <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                          Dernier achat
                        </p>
                        <p className="text-sm leading-relaxed text-white/80">
                          {lastInsight}
                        </p>
                      </section>
                    )}

                    {recommendation && (
                      <section>
                        <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                          <Sparkles className="h-3.5 w-3.5 text-amber-200/80" />
                          Recommandation
                        </p>
                        <button
                          type="button"
                          onClick={() => onAddRecommended(recommendation.produit)}
                          disabled={recommendation.produit.stock <= 0}
                          className="w-full rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 to-transparent p-4 text-left transition hover:border-amber-300/50 hover:from-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <p className="text-xs font-medium text-amber-100/90">
                            ✨ Recommandation spéciale
                          </p>
                          <p className="mt-2 font-medium text-white">
                            {recommendation.produit.nom}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {recommendation.label}
                          </p>
                          <p className="mt-3 text-sm text-amber-200/80">
                            {recommendation.produit.stock > 0
                              ? `Ajouter au panier — ${formatMoney(recommendation.produit.prix)}`
                              : "Rupture de stock"}
                          </p>
                        </button>
                      </section>
                    )}

                    {!recommendation && topProductName && (
                      <p className="text-xs text-white/35">
                        Pas encore de duo gagnant identifié pour son produit phare
                        — historique magasin à enrichir.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 px-5 py-4">
                <p className="flex items-center justify-center gap-2 text-center text-[10px] uppercase tracking-[0.25em] text-white/30">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Personal Shopper
                </p>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
