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

export default function MapMagasinPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    const { data, error } = await supabase
      .from("produits")
      .select("id, nom, description, prix, stock, categorie, code_barre, taille, couleur");
    if (error) {
      setErreur(error.message);
      setProduits([]);
    } else {
      setProduits((data as Produit[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

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
      return listerTousUrgents(produits, RUPTURE_SEUIL);
    }
    return listerProduitsRayon(produits, sheetMode.id);
  }, [sheetMode, produits]);

  const sheetTitre = useMemo(() => {
    if (!sheetMode) return "";
    if (sheetMode.kind === "caisse") {
      return "Priorité réassort (magasin)";
    }
    if (sheetMode.id === "homme") return "Rayon Hommes";
    if (sheetMode.id === "femme") return "Rayon Femmes";
    return "Îlot Accessoires & divers";
  }, [sheetMode]);

  const sheetSousTitre = useMemo(() => {
    if (!sheetMode) return "";
    if (sheetMode.kind === "caisse") {
      return `Toutes catégories — articles sous ${RUPTURE_SEUIL} unité(s) en magasin.`;
    }
    return "Variantes (flat SKU) classées par catégorie de rayon.";
  }, [sheetMode]);

  return (
    <div className="admin-container min-h-dvh p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
            Plan magasin 2D
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Jumeau numérique — vue de dessus, stocks agrégés par secteur. Seuil
            d’alerte : &lt; {RUPTURE_SEUIL} u.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-600">
          <MapPinned className="h-3.5 w-3.5 shrink-0" />
          {produits.length} variante{produits.length > 1 ? "s" : ""} en base
        </div>
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
              className="group relative col-span-2 col-start-1 row-span-4 row-start-1 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-3 text-center shadow-sm transition hover:border-indigo-200 hover:shadow-md sm:p-4"
            >
              {statsH.homme.alertRupture > 0 && <PingAlerte />}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/90 text-white shadow-md sm:h-14 sm:w-14">
                <Shirt className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 sm:text-base">
                  Rayon Hommes
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {statsH.homme.stockTotal} u. · {statsH.homme.alertRupture} alerte
                  {statsH.homme.alertRupture > 1 ? "s" : ""}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openRayon("accessoires")}
              className="group relative col-span-2 col-start-3 row-span-4 row-start-1 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-b from-indigo-50/80 to-white p-3 text-center shadow-sm transition hover:border-indigo-300 hover:shadow-md sm:p-4"
            >
              {statsH.accessoires.alertRupture > 0 && <PingAlerte />}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/60 sm:h-14 sm:w-14">
                <Sparkles className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 sm:text-base">
                  Îlot Accessoires
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {statsH.accessoires.stockTotal} u. ·{" "}
                  {statsH.accessoires.alertRupture} alerte
                  {statsH.accessoires.alertRupture > 1 ? "s" : ""}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openRayon("femme")}
              className="group relative col-span-2 col-start-5 row-span-4 row-start-1 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-rose-200/60 bg-gradient-to-b from-rose-50/90 to-white p-3 text-center shadow-sm transition hover:border-rose-300 hover:shadow-md sm:p-4"
            >
              {statsH.femme.alertRupture > 0 && <PingAlerte />}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 ring-1 ring-rose-200/60 sm:h-14 sm:w-14">
                <Heart className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 sm:text-base">
                  Rayon Femmes
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {statsH.femme.stockTotal} u. · {statsH.femme.alertRupture} alerte
                  {statsH.femme.alertRupture > 1 ? "s" : ""}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={openCaisse}
              className="group relative col-span-6 col-start-1 row-span-2 row-start-5 flex flex-row items-center justify-center gap-4 overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/80 p-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:gap-6 sm:px-8"
            >
              {alerteMagasin && <PingAlerte />}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow sm:h-12 sm:w-12">
                <Store className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <p className="text-base font-bold text-slate-900 sm:text-lg">
                  Caisse
                </p>
                <p className="text-xs text-slate-500 sm:text-sm">
                  {statsC.alertRupture} article
                  {statsC.alertRupture > 1 ? "s" : ""} à réassort (magasin) ·
                  st. total {statsC.stockTotal} u.
                </p>
              </div>
              <Package className="hidden h-8 w-8 text-emerald-400 sm:block" aria-hidden />
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            Cliquez sur un secteur pour inspecter le détail. Catégories
            mappées : mots-clés &quot;homme&quot; / &quot;femme&quot; / reste
            (îlot).
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
      />
    </div>
  );
}
