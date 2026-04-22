"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Heart,
  Loader2,
  MapPinned,
  Package,
  Shirt,
  Sparkles,
  Store,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import type { Produit } from "@/types/produit";
import StoreMapRayonSheet from "@/components/admin/StoreMapRayonSheet";
import {
  RUPTURE_SEUIL,
  listerProduitsRayon,
  listerTousUrgents,
  statsCaisseTousUrgents,
  statsParRayon,
} from "@/lib/admin/store-map-zones";
import {
  agregatCaVentesMouvements,
  formatCaEur,
  trancheHeatmap,
  type MouvementVenteLigne,
} from "@/lib/admin/store-map-ca";

function PingAlerte() {
  return (
    <span
      className="absolute right-3 top-3 flex h-3.5 w-3.5"
      title="Rupture ou stock critique dans ce secteur"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-50" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-amber-500 ring-2 ring-white" />
    </span>
  );
}

type SheetMode =
  | { kind: "rayon"; id: "homme" | "femme" | "accessoires" }
  | { kind: "caisse" };

type ViewMode = "stocks" | "heatmap";

const HEAT = {
  /** Froid : bleu */
  0: {
    block:
      "border-blue-200 bg-gradient-to-b from-blue-50 to-white text-blue-900 shadow-sm transition hover:border-blue-300 hover:shadow-md",
    icon: "bg-blue-200/90 text-blue-900 ring-1 ring-blue-300/50",
  },
  /** Tiède : jaune / orange */
  1: {
    block:
      "border-orange-300 bg-gradient-to-b from-orange-50 to-white text-orange-900 shadow-sm transition hover:border-orange-400 hover:shadow-md",
    icon: "bg-orange-200/90 text-orange-900 ring-1 ring-orange-300/50",
  },
  /** Chaud : rouge */
  2: {
    block:
      "border-red-500 bg-red-100 text-red-900 shadow-lg shadow-red-200/50 transition hover:border-red-600 hover:shadow-lg",
    icon: "bg-red-200 text-red-950 ring-1 ring-red-400/50",
  },
} as const;

function classesRayonHeatmap(
  tranche: 0 | 1 | 2
): { block: string; icon: string } {
  return HEAT[tranche];
}

export default function MapMagasinPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvementsVente, setMouvementsVente] = useState<MouvementVenteLigne[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissementMouvements, setAvertissementMouvements] = useState<
    string | null
  >(null);
  const [viewMode, setViewMode] = useState<ViewMode>("stocks");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    setAvertissementMouvements(null);

    const { data, error } = await supabase
      .from("produits")
      .select("id, nom, description, prix, stock, categorie, code_barre, taille, couleur");
    if (error) {
      setErreur(error.message);
      setProduits([]);
    } else {
      setProduits((data as Produit[]) ?? []);
    }

    const mvt = await supabase
      .from("mouvements_stock")
      .select("produit_id, quantite")
      .eq("type_mouvement", "VENTE");
    if (mvt.error) {
      setAvertissementMouvements(
        "Mouvements de vente indisponibles (journal absent ou accès) — la heatmap est vide."
      );
      setMouvementsVente([]);
    } else {
      setMouvementsVente(
        (mvt.data as MouvementVenteLigne[])?.filter(
          (m) => m.produit_id
        ) ?? []
      );
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const { parProduit, parRayon, totalMagasin } = useMemo(
    () => agregatCaVentesMouvements(produits, mouvementsVente),
    [produits, mouvementsVente]
  );

  const maxCaRayons = useMemo(
    () =>
      Math.max(parRayon.homme, parRayon.femme, parRayon.accessoires, 0) || 1,
    [parRayon]
  );

  const thHomme = trancheHeatmap(parRayon.homme, maxCaRayons) as 0 | 1 | 2;
  const thFemme = trancheHeatmap(parRayon.femme, maxCaRayons) as 0 | 1 | 2;
  const thAcc = trancheHeatmap(
    parRayon.accessoires,
    maxCaRayons
  ) as 0 | 1 | 2;

  const hHomme = useMemo(
    () => classesRayonHeatmap(thHomme),
    [thHomme]
  );
  const hFemme = useMemo(
    () => classesRayonHeatmap(thFemme),
    [thFemme]
  );
  const hAcc = useMemo(() => classesRayonHeatmap(thAcc), [thAcc]);

  const statsH = useMemo(
    () => statsParRayon(produits, RUPTURE_SEUIL),
    [produits]
  );
  const statsC = useMemo(
    () => statsCaisseTousUrgents(produits, RUPTURE_SEUIL),
    [produits]
  );
  const alerteMagasin = useMemo(
    () => produits.some((p) => p.stock < RUPTURE_SEUIL),
    [produits]
  );

  const openRayon = (id: "homme" | "femme" | "accessoires") => {
    setSheetMode({ kind: "rayon", id });
    setSheetOpen(true);
  };
  const openCaisse = () => {
    setSheetMode({ kind: "caisse" });
    setSheetOpen(true);
  };

  const sheetProduits = useMemo(() => {
    if (!sheetMode) return [];
    if (sheetMode.kind === "caisse") {
      if (viewMode === "heatmap") {
        return produits;
      }
      return listerTousUrgents(produits, RUPTURE_SEUIL);
    }
    return listerProduitsRayon(produits, sheetMode.id);
  }, [sheetMode, viewMode, produits]);

  const sheetTitre = useMemo(() => {
    if (!sheetMode) return "";
    if (sheetMode.kind === "caisse") {
      if (viewMode === "heatmap") {
        return "Héros du magasin (tous rayons)";
      }
      return "Priorité réassort (magasin)";
    }
    if (sheetMode.id === "homme") return "Rayon Hommes";
    if (sheetMode.id === "femme") return "Rayon Femmes";
    return "Îlot Accessoires & divers";
  }, [sheetMode, viewMode]);

  const sheetSousTitre = useMemo(() => {
    if (!sheetMode) return "";
    if (sheetMode.kind === "caisse") {
      if (viewMode === "heatmap") {
        return "Classement par CA cumulé (mouvements VENTE enregistrés).";
      }
      return `Toutes catégories — articles sous ${RUPTURE_SEUIL} unité(s) en magasin.`;
    }
    if (viewMode === "heatmap") {
      return "Produits du secteur, du plus haut chiffre d’affaires au plus bas (ventes tracées).";
    }
    return "Variantes (flat SKU) classées par catégorie de rayon.";
  }, [sheetMode, viewMode]);

  return (
    <div className="admin-container min-h-dvh p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
              Plan magasin 2D
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {viewMode === "stocks" ? (
                <>
                  Jumeau numérique — stocks par secteur. Seuil d’alerte : &lt;{" "}
                  {RUPTURE_SEUIL} u.
                </>
              ) : (
                <>
                  Carte de rentabilité : CA par rayon d’après les ventes
                  tracées (mouvements <span className="font-medium">VENTE</span>).
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-600">
              <MapPinned className="h-3.5 w-3.5 shrink-0" />
              {produits.length} variante{produits.length > 1 ? "s" : ""} en base
            </div>
            <div
              className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1"
              role="group"
              aria-label="Mode de visualisation"
            >
              <button
                type="button"
                onClick={() => setViewMode("stocks")}
                className={`min-h-10 rounded-xl px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                  viewMode === "stocks"
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                📦 Vue Stocks
              </button>
              <button
                type="button"
                onClick={() => setViewMode("heatmap")}
                className={`min-h-10 rounded-xl px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                  viewMode === "heatmap"
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                🔥 Heatmap Ventes
              </button>
            </div>
          </div>
        </div>
        {avertissementMouvements && viewMode === "heatmap" && (
          <p className="text-xs text-amber-800">{avertissementMouvements}</p>
        )}
      </div>

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-32">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
            Entrée
          </p>
          <div className="grid aspect-[4/3] w-full min-h-[300px] grid-cols-6 grid-rows-6 gap-2 p-0 sm:gap-3">
            <button
              type="button"
              onClick={() => openRayon("homme")}
              className={
                viewMode === "stocks"
                  ? "group relative col-span-2 col-start-1 row-span-4 row-start-1 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-3 text-center shadow-sm transition hover:border-indigo-200 hover:shadow-md sm:p-4"
                  : `group relative col-span-2 col-start-1 row-span-4 row-start-1 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl p-3 text-center sm:p-4 ${hHomme.block}`
              }
            >
              {viewMode === "stocks" && statsH.homme.alertRupture > 0 && (
                <PingAlerte />
              )}
              <div
                className={
                  viewMode === "stocks"
                    ? "flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/90 text-white shadow-md sm:h-14 sm:w-14"
                    : `flex h-12 w-12 items-center justify-center rounded-2xl shadow sm:h-14 sm:w-14 ${hHomme.icon}`
                }
              >
                <Shirt className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
              <div>
                <p
                  className={
                    viewMode === "stocks"
                      ? "text-sm font-bold text-slate-900 sm:text-base"
                      : "text-sm font-bold sm:text-base"
                  }
                >
                  Rayon Hommes
                </p>
                <p
                  className={
                    viewMode === "stocks"
                      ? "mt-0.5 text-xs text-slate-500"
                      : "mt-0.5 text-xs font-semibold"
                  }
                >
                  {viewMode === "stocks" ? (
                    <>
                      {statsH.homme.stockTotal} u. ·{" "}
                      {statsH.homme.alertRupture} alerte
                      {statsH.homme.alertRupture > 1 ? "s" : ""}
                    </>
                  ) : (
                    <>CA : {formatCaEur(parRayon.homme)}</>
                  )}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openRayon("accessoires")}
              className={
                viewMode === "stocks"
                  ? "group relative col-span-2 col-start-3 row-span-4 row-start-1 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-b from-indigo-50/80 to-white p-3 text-center shadow-sm transition hover:border-indigo-300 hover:shadow-md sm:p-4"
                  : `group relative col-span-2 col-start-3 row-span-4 row-start-1 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl p-3 text-center sm:p-4 ${hAcc.block}`
              }
            >
              {viewMode === "stocks" && statsH.accessoires.alertRupture > 0 && (
                <PingAlerte />
              )}
              <div
                className={
                  viewMode === "stocks"
                    ? "flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/60 sm:h-14 sm:w-14"
                    : `flex h-12 w-12 items-center justify-center rounded-2xl shadow sm:h-14 sm:w-14 ${hAcc.icon}`
                }
              >
                <Sparkles className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
              <div>
                <p
                  className={
                    viewMode === "stocks"
                      ? "text-sm font-bold text-slate-900 sm:text-base"
                      : "text-sm font-bold sm:text-base"
                  }
                >
                  Îlot Accessoires
                </p>
                <p
                  className={
                    viewMode === "stocks"
                      ? "mt-0.5 text-xs text-slate-500"
                      : "mt-0.5 text-xs font-semibold"
                  }
                >
                  {viewMode === "stocks" ? (
                    <>
                      {statsH.accessoires.stockTotal} u. ·{" "}
                      {statsH.accessoires.alertRupture} alerte
                      {statsH.accessoires.alertRupture > 1 ? "s" : ""}
                    </>
                  ) : (
                    <>CA : {formatCaEur(parRayon.accessoires)}</>
                  )}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openRayon("femme")}
              className={
                viewMode === "stocks"
                  ? "group relative col-span-2 col-start-5 row-span-4 row-start-1 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-rose-200/60 bg-gradient-to-b from-rose-50/90 to-white p-3 text-center shadow-sm transition hover:border-rose-300 hover:shadow-md sm:p-4"
                  : `group relative col-span-2 col-start-5 row-span-4 row-start-1 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl p-3 text-center sm:p-4 ${hFemme.block}`
              }
            >
              {viewMode === "stocks" && statsH.femme.alertRupture > 0 && (
                <PingAlerte />
              )}
              <div
                className={
                  viewMode === "stocks"
                    ? "flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 ring-1 ring-rose-200/60 sm:h-14 sm:w-14"
                    : `flex h-12 w-12 items-center justify-center rounded-2xl shadow sm:h-14 sm:w-14 ${hFemme.icon}`
                }
              >
                <Heart className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
              <div>
                <p
                  className={
                    viewMode === "stocks"
                      ? "text-sm font-bold text-slate-900 sm:text-base"
                      : "text-sm font-bold sm:text-base"
                  }
                >
                  Rayon Femmes
                </p>
                <p
                  className={
                    viewMode === "stocks"
                      ? "mt-0.5 text-xs text-slate-500"
                      : "mt-0.5 text-xs font-semibold"
                  }
                >
                  {viewMode === "stocks" ? (
                    <>
                      {statsH.femme.stockTotal} u. · {statsH.femme.alertRupture}{" "}
                      alerte
                      {statsH.femme.alertRupture > 1 ? "s" : ""}
                    </>
                  ) : (
                    <>CA : {formatCaEur(parRayon.femme)}</>
                  )}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={openCaisse}
              className={
                viewMode === "stocks"
                  ? "group relative col-span-6 col-start-1 row-span-2 row-start-5 flex flex-row items-center justify-center gap-4 overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/80 p-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:gap-6 sm:px-8"
                  : "group relative col-span-6 col-start-1 row-span-2 row-start-5 flex flex-row items-center justify-center gap-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-50/95 via-white to-slate-100/90 p-3 shadow-sm transition hover:border-slate-300 sm:gap-6 sm:px-8"
              }
            >
              {viewMode === "stocks" && alerteMagasin && <PingAlerte />}
              <div
                className={
                  viewMode === "stocks"
                    ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow sm:h-12 sm:w-12"
                    : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-white shadow sm:h-12 sm:w-12"
                }
              >
                <Store className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <p className="text-base font-bold text-slate-900 sm:text-lg">
                  Caisse
                </p>
                <p className="text-xs text-slate-500 sm:text-sm">
                  {viewMode === "stocks" ? (
                    <>
                      {statsC.alertRupture} article
                      {statsC.alertRupture > 1 ? "s" : ""} à réassort
                      (magasin) · st. total {statsC.stockTotal} u.
                    </>
                  ) : (
                    <>CA total magasin : {formatCaEur(totalMagasin)}</>
                  )}
                </p>
              </div>
              <Package
                className="hidden h-8 w-8 text-slate-400 sm:block"
                aria-hidden
              />
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            {viewMode === "stocks"
              ? "Cliquez sur un secteur. Catégories mappées : homme / femme / reste (îlot)."
              : "Échelle hommes / femmes / accessoires : la zone la plus forte en CA est « chaude ». CA = Σ |vente| × prix produit (traces VENTE)."}
          </p>
        </div>
      )}

      <StoreMapRayonSheet
        open={sheetOpen && sheetMode !== null}
        onOpenChange={(o) => {
          if (!o) {
            setSheetOpen(false);
            setSheetMode(null);
          }
        }}
        title={sheetTitre}
        sousTitre={sheetSousTitre}
        produits={sheetProduits}
        viewMode={viewMode}
        caParProduit={
          viewMode === "heatmap" ? parProduit : null
        }
      />
    </div>
  );
}
