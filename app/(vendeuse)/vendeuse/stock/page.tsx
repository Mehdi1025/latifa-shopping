"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ScanLine, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import BarcodeCameraModal, {
  type CameraScanResult,
} from "@/components/vendeur/BarcodeCameraModal";
import StockVarianteSheet from "@/components/vendeur/StockVarianteSheet";
import { MYSTERY_VAULT_PRODUCT_ID } from "@/lib/constants/mystery-vault";
import type { Produit } from "@/types/produit";
import { normalizeEan13String } from "@/lib/produit-import";
import {
  groupProduitsByModele,
  type GroupeModeleCatalogue,
} from "@/lib/caisse/catalogue-groupes";
import { useWedgeEan13Listener } from "@/hooks/useWedgeEan13Listener";

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(prix);
}

export default function VendeuseStockPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategorie, setSelectedCategorie] = useState<string>("Toutes");
  const [modeleTiroir, setModeleTiroir] = useState<GroupeModeleCatalogue | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const eanInputRef = useRef<HTMLInputElement>(null);
  const onWedgeEanRef = useRef<(ean: string) => void>(() => {});

  const supabase = createSupabaseBrowserClient();

  const fetchProduits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("produits")
      .select("id, nom, description, prix, stock, categorie, code_barre, taille, couleur")
      .order("nom");
    if (error) {
      toast.error(error.message);
      setProduits([]);
    } else {
      setProduits((data as Produit[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProduits();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => eanInputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const produitsSansMystere = useMemo(
    () => produits.filter((p) => p.id !== MYSTERY_VAULT_PRODUCT_ID),
    [produits]
  );

  const categoriesStock = useMemo(() => {
    const uniqueCats = new Set(
      produitsSansMystere
        .map((p) => p.categorie?.trim())
        .filter((c): c is string => Boolean(c))
    );
    return ["Toutes", ...Array.from(uniqueCats).sort()];
  }, [produitsSansMystere]);

  const produitsCategorieFiltre = useMemo(() => {
    if (selectedCategorie === "Toutes") return produitsSansMystere;
    const pill = selectedCategorie.toLowerCase();
    return produitsSansMystere.filter(
      (p) => (p.categorie ?? "").trim().toLowerCase() === pill
    );
  }, [produitsSansMystere, selectedCategorie]);

  const produitsApresRecherche = useMemo(() => {
    if (!searchQuery.trim()) return produitsCategorieFiltre;
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return produitsCategorieFiltre.filter((p) => {
      const nom = (p.nom ?? "").toLowerCase();
      const cat = (p.categorie ?? "").toLowerCase();
      const ean = p.code_barre ?? "";
      const matchText =
        nom.includes(q) || cat.includes(q) || (ean && ean.toLowerCase().includes(q));
      const matchEan =
        qDigits.length >= 4 && ean.length > 0 && ean.replace(/\D/g, "").includes(qDigits);
      return matchText || matchEan;
    });
  }, [produitsCategorieFiltre, searchQuery]);

  const groupesCategorieTous = useMemo(
    () => groupProduitsByModele(produitsCategorieFiltre),
    [produitsCategorieFiltre]
  );

  const nomsModelesApresRecherche = useMemo(() => {
    if (!searchQuery.trim()) {
      return new Set(groupesCategorieTous.map((g) => g.nom));
    }
    const noms = new Set<string>();
    for (const p of produitsApresRecherche) {
      noms.add(p.nom.trim() || p.id);
    }
    return noms;
  }, [searchQuery, produitsApresRecherche, groupesCategorieTous]);

  const groupesModelesAffiches = useMemo(
    () => groupesCategorieTous.filter((g) => nomsModelesApresRecherche.has(g.nom)),
    [groupesCategorieTous, nomsModelesApresRecherche]
  );

  /** Toutes les lignes du modèle (hors filtre catégorie) pour cohérence scan / fiche. */
  const variantesPourTiroir = useMemo(() => {
    if (!modeleTiroir) return [];
    return produitsSansMystere.filter(
      (p) => p.nom.trim() === modeleTiroir.nom.trim()
    );
  }, [modeleTiroir, produitsSansMystere]);

  const groupesCatalogueComplet = useMemo(
    () => groupProduitsByModele(produitsSansMystere),
    [produitsSansMystere]
  );

  const ouvrirParEan = useCallback(
    (raw: string) => {
      const ean = normalizeEan13String(raw);
      if (!ean) {
        toast.error("EAN invalide (13 chiffres).");
        return;
      }
      const p = produitsSansMystere.find((x) => (x.code_barre ?? "").trim() === ean);
      if (!p) {
        toast.error("Produit introuvable.");
        return;
      }
      const nom = p.nom.trim() || p.id;
      const groupe = groupesCatalogueComplet.find((g) => g.nom === nom);
      if (!groupe) {
        toast.error("Impossible de charger le modèle.");
        return;
      }
      setModeleTiroir(groupe);
      setSearchQuery("");
    },
    [produitsSansMystere, groupesCatalogueComplet]
  );

  onWedgeEanRef.current = ouvrirParEan;

  useWedgeEan13Listener({
    inputRef: eanInputRef,
    blocked: scannerOpen,
    onEan13Ref: onWedgeEanRef,
  });

  const handleCameraEan = useCallback(
    (ean: string): CameraScanResult => {
      const normalized = normalizeEan13String(ean);
      if (!normalized) {
        toast.error("EAN invalide (13 chiffres).");
        return { ok: false };
      }
      const p = produitsSansMystere.find((x) => (x.code_barre ?? "").trim() === normalized);
      if (!p) {
        toast.error("Produit introuvable.");
        return { ok: false };
      }
      ouvrirParEan(normalized);
      return { ok: true, productLabel: p.nom };
    },
    [produitsSansMystere, ouvrirParEan]
  );

  const closeScanner = useCallback(() => setScannerOpen(false), []);

  return (
    <div
      className="relative flex h-full min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden overscroll-none bg-gray-50 select-none max-md:max-w-[100vw] md:h-[100dvh] md:max-h-[100dvh] md:flex-none md:flex-row lg:max-w-none [&_a]:[-webkit-tap-highlight-color:transparent] [&_button]:[-webkit-tap-highlight-color:transparent]"
    >
      <section className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden overscroll-none bg-gray-50">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="z-20 w-full max-w-full shrink-0 border-b border-transparent bg-gray-50/95 backdrop-blur-md max-md:sticky max-md:left-0 max-md:right-0 max-md:top-[calc(3.5rem+env(safe-area-inset-top,0px))] max-md:border-gray-200/80 max-md:shadow-[0_6px_24px_-12px_rgba(0,0,0,0.1)] md:static md:top-0 md:border-0 md:bg-gray-50 md:shadow-none md:backdrop-blur-none">
            <div className="px-4 pb-2 pt-2 md:px-7 md:pb-5 md:pt-8 lg:px-10 lg:pb-6">
              <div className="mb-2.5 flex items-start justify-between gap-2 md:mb-6">
                <div>
                  <h1 className="text-base font-semibold tracking-tight text-gray-900 md:text-xl lg:text-2xl">
                    📦 Gestion des Stocks
                  </h1>
                  <p className="mt-0.5 text-[10px] leading-snug text-amber-800/90 md:mt-1 md:text-sm">
                    Consultation inventaire uniquement — aucune vente depuis cet écran.
                  </p>
                </div>
              </div>

              <div className="mb-2 flex shrink-0 flex-row items-stretch gap-2 md:mb-5 md:gap-3">
                <div className="flex min-h-[48px] min-w-0 flex-1 shrink-0 items-center gap-2 rounded-xl border border-gray-100/90 bg-white px-3 py-2 shadow-sm md:min-h-[52px] md:gap-3 md:border-0 md:px-4 md:py-3 md:ring-1 md:ring-gray-100/80">
                  <Search className="h-4 w-4 shrink-0 text-gray-400 md:h-5 md:w-5" />
                  <input
                    ref={eanInputRef}
                    id="stock-ean-search"
                    type="search"
                    name="stock-search-ean"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      if (e.nativeEvent.isComposing) return;
                      if (e.ctrlKey || e.altKey || e.metaKey) return;
                      const digits = e.currentTarget.value.replace(/\D/g, "");
                      if (digits.length === 13) {
                        e.preventDefault();
                        ouvrirParEan(digits);
                      }
                    }}
                    autoFocus
                    autoComplete="off"
                    inputMode="search"
                    placeholder="EAN, nom, catégorie…"
                    className="min-w-0 flex-1 select-text bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none md:text-base"
                    aria-label="Recherche stock ou code-barres EAN-13"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 text-base font-semibold text-white shadow-md transition active:scale-[0.98] [-webkit-tap-highlight-color:transparent] md:min-h-[52px] md:min-w-[11rem] md:px-6 md:py-4"
                  aria-label="Ouvrir le scanner"
                >
                  <ScanLine className="h-5 w-5 shrink-0 md:h-6 md:w-6" aria-hidden />
                  <span className="hidden sm:inline">📷 Scanner</span>
                </button>
              </div>

              <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:mb-0 md:gap-2 [&::-webkit-scrollbar]:hidden">
                {categoriesStock.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategorie(cat)}
                    className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 snap-start items-center justify-center rounded-full px-3.5 text-[11px] font-semibold transition-all duration-200 [-webkit-tap-highlight-color:transparent] md:min-h-[48px] md:min-w-[48px] md:px-5 md:text-sm ${
                      selectedCategorie === cat
                        ? "bg-gray-900 text-white shadow-md"
                        : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth max-md:px-4 md:px-7 lg:px-8 xl:px-10">
            {loading ? (
              <div className="flex flex-1 items-center justify-center py-24">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
              </div>
            ) : produitsSansMystere.length === 0 ? (
              <p className="py-16 text-center text-gray-400">Aucun produit en catalogue.</p>
            ) : groupesModelesAffiches.length === 0 ? (
              <p className="py-16 text-center text-gray-500">
                {searchQuery.trim() ? (
                  <>Aucun modèle ne correspond à &quot;{searchQuery.trim()}&quot;.</>
                ) : (
                  <>Aucun modèle pour la catégorie « {selectedCategorie} ».</>
                )}
              </p>
            ) : (
              <div
                className={`grid w-full max-w-full grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3 md:grid-cols-2 md:gap-4 md:pt-0 md:pb-10 lg:grid-cols-3 pb-8 max-md:pb-10`}
              >
                <AnimatePresence mode="popLayout">
                  {groupesModelesAffiches.map((groupe) => {
                    const prixDifferes = groupe.prixMin !== groupe.prixMax;
                    const stockTotal = groupe.variantes.reduce((s, v) => s + v.stock, 0);
                    return (
                      <motion.button
                        key={groupe.nom}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        type="button"
                        onClick={() => setModeleTiroir(groupe)}
                        className="group flex min-h-0 flex-col items-stretch rounded-lg border border-gray-200/90 bg-white p-2.5 text-left shadow-sm transition duration-200 ease-out [-webkit-tap-highlight-color:transparent] active:scale-[0.98] md:min-h-[200px] md:rounded-2xl md:p-6 md:shadow-sm lg:rounded-3xl lg:p-7"
                      >
                        <div className="mb-1.5 flex min-h-[3.75rem] flex-1 items-center justify-center rounded-md bg-gradient-to-b from-gray-50 to-white text-gray-300 ring-1 ring-inset ring-gray-100/90 md:mb-3 md:min-h-28 md:rounded-2xl">
                          <ShoppingBag className="h-7 w-7 md:h-16 md:w-16 lg:h-[4.5rem] lg:w-[4.5rem]" />
                        </div>
                        <p className="line-clamp-2 text-[13px] font-bold leading-[1.25] tracking-tight text-gray-900 md:text-lg lg:text-xl">
                          {groupe.nom}
                        </p>
                        {groupe.categorie && (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-500 md:text-sm">
                            {groupe.categorie}
                          </p>
                        )}
                        <div className="mt-2 flex min-h-0 items-end justify-between gap-1.5 md:mt-3 md:min-h-12">
                          <span className="text-sm font-bold tabular-nums text-gray-900 md:text-xl">
                            {prixDifferes
                              ? `À partir de ${formatPrix(groupe.prixMin)}`
                              : formatPrix(groupe.prixMin)}
                          </span>
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tabular-nums md:px-2.5 md:py-1 md:text-[11px] ${
                              stockTotal > 0
                                ? "border-emerald-200/80 bg-emerald-50 text-emerald-800"
                                : "border-red-200/80 bg-red-50 text-red-700"
                            }`}
                          >
                            Σ {stockTotal} st.
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </section>

      <StockVarianteSheet
        open={modeleTiroir !== null}
        onOpenChange={(o) => {
          if (!o) setModeleTiroir(null);
        }}
        modeleNom={modeleTiroir?.nom ?? ""}
        variantes={variantesPourTiroir}
        formatPrix={formatPrix}
      />

      <BarcodeCameraModal
        open={scannerOpen}
        onClose={closeScanner}
        onEan13={handleCameraEan}
      />
    </div>
  );
}
