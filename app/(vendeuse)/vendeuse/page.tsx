"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Minus, ShoppingBag, ChevronDown, Trash2, X, CheckCircle, AlertCircle, Search, History, Percent, RotateCcw, Gift, User, ScanLine } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import ClientelingPanel from "@/components/vendeur/ClientelingPanel";
import GamificationJauge from "@/components/vendeur/GamificationJauge";
import VipRadar from "@/components/vendeur/VipRadar";
import FluxBoutiqueCard from "@/components/vendeur/FluxBoutiqueCard";
import BarcodeCameraModal from "@/components/vendeur/BarcodeCameraModal";
import { MYSTERY_VAULT_PRODUCT_ID } from "@/lib/constants/mystery-vault";
import {
  MoyenPaiementSelector,
  type MethodePaiement,
} from "@/components/MethodePaiement";
import type { Produit } from "@/types/produit";
import { normalizeEan13String } from "@/lib/produit-import";
import { logStockMovement } from "@/lib/stock/mouvements-stock";
import {
  groupProduitsByModele,
  type GroupeModeleCatalogue,
} from "@/lib/caisse/catalogue-groupes";
import VarianteSelectionSheet from "@/components/vendeur/VarianteSelectionSheet";

type LignePanier = {
  /** Clé stable par ligne (plusieurs lots Coffre = même produit_id) */
  panierLineId: string;
  produit: Produit;
  quantite: number;
  /** Libellé ticket (ex. nom du lot Coffre Noir) */
  libelleOverride?: string;
};

type VenteItem = {
  produit_id: string;
  quantite: number;
};

type VenteHistorique = {
  id: string;
  total: number;
  remise?: number;
  created_at: string;
  methode_paiement?: MethodePaiement | string | null;
  ventes_items?: VenteItem[];
};

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(prix);
}

function formatVariantSubtitle(p: Produit): string | null {
  const a = p.couleur?.trim() || null;
  const b = p.taille?.trim() || null;
  if (!a && !b) return null;
  return [a, b].filter(Boolean).join(" • ");
}

/** Téléphone stocké et recherché en chiffres (ex. 0612345678). */
function normalizePhoneForDb(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("33") && d.length >= 11) d = "0" + d.slice(2);
  return d;
}

type ResolvedClient = { id: string; nom: string };

function ClientCaisseSection({
  clientPhone,
  onClientPhoneChange,
  clientNom,
  onClientNomChange,
  resolvedClient,
  lookupLoading,
}: {
  clientPhone: string;
  onClientPhoneChange: (v: string) => void;
  clientNom: string;
  onClientNomChange: (v: string) => void;
  resolvedClient: ResolvedClient | null;
  lookupLoading: boolean;
}) {
  const digits = normalizePhoneForDb(clientPhone);
  const showNomNouveau =
    digits.length >= 8 && !lookupLoading && !resolvedClient;

  return (
    <div className="mb-4 rounded-2xl border border-dashed border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white p-4 ring-1 ring-violet-100/60">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <Gift className="h-4 w-4 text-violet-600" aria-hidden />
        <span>Client (Optionnel) 🎁</span>
      </div>
      <label className="block text-xs font-medium text-gray-500" htmlFor="client-phone-caisse">
        Téléphone
      </label>
      <input
        id="client-phone-caisse"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={clientPhone}
        onChange={(e) => onClientPhoneChange(e.target.value)}
        placeholder="ex. 06 12 34 56 78"
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
      />
      {lookupLoading && digits.length >= 8 && (
        <p className="mt-2 text-xs text-violet-600">Recherche du client…</p>
      )}
      {resolvedClient && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-100">
          <User className="h-4 w-4 shrink-0" />
          <span className="font-medium">{resolvedClient.nom}</span>
          <span className="text-emerald-600">— client reconnu</span>
        </div>
      )}
      {showNomNouveau && (
        <>
          <label className="mt-3 block text-xs font-medium text-amber-800">
            Nouveau client — nom
          </label>
          <input
            type="text"
            value={clientNom}
            onChange={(e) => onClientNomChange(e.target.value)}
            placeholder="Prénom Nom"
            className="mt-1 w-full rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
          <p className="mt-1.5 text-xs text-amber-800/80">
            Ce numéro n&apos;est pas encore en base : le nom sera enregistré avec la
            vente.
          </p>
        </>
      )}
    </div>
  );
}

type ToastType = "success" | "error" | null;

export default function VendeusePage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [panier, setPanier] = useState<LignePanier[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategorie, setSelectedCategorie] = useState<string>("Toutes");
  const [modeleTiroir, setModeleTiroir] = useState<GroupeModeleCatalogue | null>(
    null
  );
  const [encaissementLoading, setEncaissementLoading] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [ventesDuJour, setVentesDuJour] = useState<VenteHistorique[]>([]);
  const [loadingHistorique, setLoadingHistorique] = useState(false);
  const [remiseModalOpen, setRemiseModalOpen] = useState(false);
  const [remiseType, setRemiseType] = useState<"percent" | "fixed">("percent");
  const [remiseValue, setRemiseValue] = useState<number>(0);
  const [methodePaiement, setMethodePaiement] =
    useState<MethodePaiement>("carte");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNom, setClientNom] = useState("");
  const [resolvedClient, setResolvedClient] = useState<ResolvedClient | null>(null);
  const [clientLookupLoading, setClientLookupLoading] = useState(false);
  const [clientelingOpen, setClientelingOpen] = useState(false);
  const [gamificationRefreshKey, setGamificationRefreshKey] = useState(0);
  const [isMdUp, setIsMdUp] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const prevPanierLen = useRef(0);
  const eanInputRef = useRef<HTMLInputElement>(null);
  const tryAddByEanRef = useRef<(raw: string) => void>(() => {});

  const supabase = createSupabaseBrowserClient();

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsMdUp(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const router = useRouter();

  const fetchProduits = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("produits")
      .select("id, nom, description, prix, stock, categorie, code_barre, taille, couleur")
      .gt("stock", 0)
      .order("nom");
    setProduits((data as Produit[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProduits();
  }, []);

  const fetchVentesDuJour = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLoadingHistorique(true);
    const { data: ventes } = await supabase
      .from("ventes")
      .select("id, total, created_at, methode_paiement")
      .eq("vendeur_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (ventes?.length) {
      const ids = ventes.map((v) => v.id);
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
      setVentesDuJour(
        (ventes as VenteHistorique[]).map((v) => ({
          ...v,
          ventes_items: itemsByVente[v.id] ?? [],
        }))
      );
    } else {
      setVentesDuJour([]);
    }
    setLoadingHistorique(false);
  };

  useEffect(() => {
    fetchVentesDuJour();
    const interval = setInterval(fetchVentesDuJour, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const digits = normalizePhoneForDb(clientPhone);
    if (digits.length < 8) {
      setResolvedClient(null);
      return;
    }
    const t = setTimeout(async () => {
      setClientLookupLoading(true);
      try {
        const { data } = await supabase
          .from("clients")
          .select("id, nom")
          .eq("telephone", digits)
          .maybeSingle();
        setResolvedClient(
          data ? { id: data.id, nom: data.nom } : null
        );
      } catch {
        setResolvedClient(null);
      } finally {
        setClientLookupLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [clientPhone, supabase]);

  useEffect(() => {
    if (resolvedClient) {
      setClientelingOpen(true);
    } else {
      setClientelingOpen(false);
    }
  }, [resolvedClient?.id]);

  useEffect(() => {
    if (
      resolvedClient &&
      prevPanierLen.current > 0 &&
      panier.length === 0
    ) {
      setClientelingOpen(false);
    }
    prevPanierLen.current = panier.length;
  }, [panier.length, resolvedClient]);

  const categoriesCaisse = useMemo(
    () => ["Toutes", "Homme", "Femme", "Enfant", "Accessoires"] as const,
    []
  );

  const produitsSansMystere = useMemo(
    () => produits.filter((p) => p.id !== MYSTERY_VAULT_PRODUCT_ID),
    [produits]
  );

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

  /** Variantes du modèle ouvert (carte) — catalogue complet pour la catégorie, sans filtre de recherche. */
  const variantesPourTiroir = useMemo(() => {
    if (!modeleTiroir) return [];
    return produitsCategorieFiltre.filter(
      (p) => p.nom.trim() === modeleTiroir.nom.trim()
    );
  }, [modeleTiroir, produitsCategorieFiltre]);

  const addToPanier = (produit: Produit) => {
    if (produit.id === MYSTERY_VAULT_PRODUCT_ID) return;
    setPanier((prev) => {
      const existing = prev.find(
        (l) => l.produit.id === produit.id && !l.libelleOverride
      );
      if (existing) {
        if (existing.quantite >= produit.stock) return prev;
        return prev.map((l) =>
          l.produit.id === produit.id && !l.libelleOverride
            ? { ...l, quantite: l.quantite + 1 }
            : l
        );
      }
      return [
        ...prev,
        { panierLineId: crypto.randomUUID(), produit, quantite: 1 },
      ];
    });
  };

  const removeFromPanier = (panierLineId: string) => {
    setPanier((prev) => {
      const ligne = prev.find((l) => l.panierLineId === panierLineId);
      if (!ligne) return prev;
      if (ligne.quantite <= 1) {
        return prev.filter((l) => l.panierLineId !== panierLineId);
      }
      return prev.map((l) =>
        l.panierLineId === panierLineId
          ? { ...l, quantite: l.quantite - 1 }
          : l
      );
    });
  };

  const removeItemCompletely = (panierLineId: string) => {
    setPanier((prev) => prev.filter((l) => l.panierLineId !== panierLineId));
  };

  const addOneToLine = (panierLineId: string) => {
    setPanier((prev) => {
      const ligne = prev.find((l) => l.panierLineId === panierLineId);
      if (!ligne || ligne.quantite >= ligne.produit.stock) return prev;
      return prev.map((l) =>
        l.panierLineId === panierLineId
          ? { ...l, quantite: l.quantite + 1 }
          : l
      );
    });
  };

  const viderPanier = () => {
    setPanier([]);
    setRemiseValue(0);
    setRemiseType("percent");
    setMethodePaiement("carte");
    setClientPhone("");
    setClientNom("");
    setResolvedClient(null);
  };

  const sousTotal = panier.reduce((acc, l) => acc + l.produit.prix * l.quantite, 0);
  const nbArticles = panier.reduce((acc, l) => acc + l.quantite, 0);

  const remiseAmount = useMemo(() => {
    if (remiseType === "percent") {
      return Math.round((sousTotal * (remiseValue / 100)) * 100) / 100;
    }
    return Math.min(remiseValue, sousTotal);
  }, [remiseType, remiseValue, sousTotal]);

  const total = Math.max(0, Math.round((sousTotal - remiseAmount) * 100) / 100);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  tryAddByEanRef.current = (raw: string) => {
    const ean = normalizeEan13String(raw);
    if (!ean) {
      showToast("error", "EAN invalide (13 chiffres).");
      return;
    }
    const p = produits.find((x) => (x.code_barre ?? "") === ean);
    if (!p) {
      showToast("error", "❌ Code inconnu");
      return;
    }
    if (p.id === MYSTERY_VAULT_PRODUCT_ID) return;
    if (p.stock < 1) {
      showToast("error", "Rupture de stock sur cette variante.");
      return;
    }
    addToPanier(p);
    showToast("success", `✅ ${p.nom} ajouté`);
    setSearchQuery("");
  };

  const handleCameraEan = useCallback((ean: string) => {
    tryAddByEanRef.current(ean);
  }, []);

  const closeScanner = useCallback(() => setScannerOpen(false), []);

  useEffect(() => {
    const t = window.setTimeout(() => eanInputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let buf = "";
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (remiseModalOpen || scannerOpen) return;
      const fromSkip = (e.target as HTMLElement | null)?.closest?.(
        "[data-skip-ean-capture]"
      );
      if (fromSkip) return;
      const ae = document.activeElement;
      if (ae === eanInputRef.current) return;
      if (ae && (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement)) {
        return;
      }
      if (e.key === "Enter") {
        if (buf.length === 13 && /^\d{13}$/.test(buf)) {
          e.preventDefault();
          tryAddByEanRef.current(buf);
        }
        buf = "";
        return;
      }
      if (e.key.length === 1 && e.key >= "0" && e.key <= "9") {
        if (debounce) clearTimeout(debounce);
        buf = (buf + e.key).slice(-20);
        debounce = setTimeout(() => {
          buf = "";
        }, 100);
        return;
      }
      if (!e.ctrlKey && !e.metaKey) buf = "";
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (debounce) clearTimeout(debounce);
    };
  }, [remiseModalOpen, scannerOpen]);

  const handleAnnulerVente = async (vente: VenteHistorique) => {
    if (!vente.ventes_items?.length) return;
    try {
      for (const item of vente.ventes_items) {
        if (item.produit_id === MYSTERY_VAULT_PRODUCT_ID) continue;
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
        const { error: mvtErr } = await logStockMovement(supabase, {
          produit_id: item.produit_id,
          quantite: item.quantite,
          type_mouvement: "RETOUR",
          reference: `Annulation vente · ${vente.id.slice(0, 8)}…`,
        });
        if (mvtErr) throw mvtErr;
      }
      await supabase.from("ventes_items").delete().eq("vente_id", vente.id);
      const { error: delError } = await supabase
        .from("ventes")
        .delete()
        .eq("id", vente.id);
      if (delError) throw new Error(delError.message);
      await fetchVentesDuJour();
      await fetchProduits();
      setGamificationRefreshKey((k) => k + 1);
      showToast("success", "Vente annulée. Stock restauré.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Erreur lors de l'annulation.");
    }
  };

  const handleEncaisser = async () => {
    if (panier.length === 0 || encaissementLoading) return;
    setEncaissementLoading(true);
    setToast(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        showToast("error", "Session expirée. Veuillez vous reconnecter.");
        return;
      }

      const digits = normalizePhoneForDb(clientPhone);
      if (digits.length > 0 && digits.length < 8) {
        showToast("error", "Numéro de téléphone incomplet (8 chiffres minimum).");
        return;
      }

      let clientId: string | null = null;
      if (digits.length >= 8) {
        if (resolvedClient) {
          clientId = resolvedClient.id;
        } else {
          const nom = clientNom.trim();
          if (!nom) {
            showToast(
              "error",
              "Nouveau client : saisissez un nom ou videz le téléphone."
            );
            return;
          }
          const { data: newClient, error: clientErr } = await supabase
            .from("clients")
            .insert({ nom, telephone: digits })
            .select("id")
            .single();
          if (clientErr || !newClient) {
            showToast(
              "error",
              clientErr?.message ?? "Impossible de créer le client."
            );
            return;
          }
          clientId = (newClient as { id: string }).id;
        }
      }

      const { data: vente, error: venteError } = await supabase
        .from("ventes")
        .insert({
          vendeur_id: user.id,
          total,
          remise: remiseAmount,
          methode_paiement: methodePaiement,
          ...(clientId ? { client_id: clientId } : {}),
        })
        .select("id")
        .single();

      if (venteError || !vente) {
        showToast("error", venteError?.message ?? "Erreur lors de la création du ticket.");
        return;
      }

      for (const ligne of panier) {
        const payload: Record<string, unknown> = {
          vente_id: vente.id,
          produit_id: ligne.produit.id,
          quantite: ligne.quantite,
          prix_unitaire: ligne.produit.prix,
        };
        if (ligne.libelleOverride) {
          payload.libelle_ligne = ligne.libelleOverride;
        }
        const { error: itemError } = await supabase
          .from("ventes_items")
          .insert(payload);
        if (itemError) {
          showToast("error", `Erreur article: ${itemError.message}`);
          return;
        }

        if (ligne.produit.id === MYSTERY_VAULT_PRODUCT_ID) continue;

        const newStock = ligne.produit.stock - ligne.quantite;
        const { error: stockError } = await supabase
          .from("produits")
          .update({ stock: newStock })
          .eq("id", ligne.produit.id);
        if (stockError) {
          showToast("error", `Erreur stock: ${stockError.message}`);
          return;
        }
        const { error: mvtErr } = await logStockMovement(supabase, {
          produit_id: ligne.produit.id,
          quantite: -ligne.quantite,
          type_mouvement: "VENTE",
          reference: `Ticket caisse · ${vente.id.slice(0, 8)}…`,
        });
        if (mvtErr) {
          showToast("error", mvtErr.message);
          return;
        }
      }

      setPanier([]);
      setRemiseValue(0);
      setRemiseType("percent");
      setMethodePaiement("carte");
      setClientPhone("");
      setClientNom("");
      setResolvedClient(null);
      setDrawerOpen(false);
      setRemiseModalOpen(false);
      await fetchProduits();
      await fetchVentesDuJour();
      setGamificationRefreshKey((k) => k + 1);
      router.refresh();
      showToast("success", "Vente enregistrée !");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setEncaissementLoading(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-[calc(100vh-3.5rem)] flex-1 flex-col md:min-h-0 md:flex-row md:min-h-[100dvh]">
      {/* Modal Remise */}
      <AnimatePresence>
        {remiseModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRemiseModalOpen(false)}
              className="fixed inset-0 z-[80] bg-gray-900/45 backdrop-blur-md"
            />
            <motion.div
              data-skip-ean-capture
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-[90] w-[calc(100%-2rem)] max-h-[min(90dvh,640px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-100 md:max-w-lg"
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Appliquer une remise</h3>
                <button
                  type="button"
                  onClick={() => setRemiseModalOpen(false)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Fermer"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="mb-5 flex gap-2 rounded-2xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setRemiseType("percent")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                    remiseType === "percent"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Pourcentage
                </button>
                <button
                  type="button"
                  onClick={() => setRemiseType("fixed")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                    remiseType === "fixed"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Montant fixe
                </button>
              </div>
              {remiseType === "percent" ? (
                <div className="flex flex-wrap gap-2">
                  {[10, 20, 50].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setRemiseValue(remiseValue === p ? 0 : p)}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                        remiseValue === p
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      -{p}%
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">-</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={remiseValue || ""}
                    onChange={(e) => setRemiseValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                  <span className="text-gray-500">€</span>
                </div>
              )}
              <p className="mt-4 text-center text-sm text-gray-500">
                Sous-total : {formatPrix(sousTotal)}
                {remiseAmount > 0 && (
                  <> · Remise : -{formatPrix(remiseAmount)} · <strong>Total : {formatPrix(total)}</strong></>
                )}
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className={`fixed top-20 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl px-6 py-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] md:top-8 ${
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

      {/* Catalogue — gauche ~60% (md+) ; zone produits scrollable indépendamment du panier */}
      <section className="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50/50 md:w-[60%] md:min-w-0 md:overflow-hidden">
        <div className="shrink-0 p-6 pb-4 md:p-8 md:pb-5 lg:p-10 lg:pb-6">
          {!isMdUp && (
            <GamificationJauge
              refreshKey={gamificationRefreshKey}
              className="mb-5"
            />
          )}
          <VipRadar />
          <FluxBoutiqueCard />
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Catalogue</h1>
            <p className="mt-1 text-sm text-gray-400">
              Modèle → couleur → taille. Le scanner et la recherche EAN fonctionnent
              en parallèle.
            </p>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-gray-100/80 shadow-sm">
              <Search className="h-5 w-5 shrink-0 text-gray-400" />
              <input
                ref={eanInputRef}
                id="caisse-ean-search"
                type="search"
                name="search-ean"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const digits = e.currentTarget.value.replace(/\D/g, "");
                  if (digits.length === 13) {
                    e.preventDefault();
                    tryAddByEanRef.current(digits);
                  }
                }}
                autoFocus
                autoComplete="off"
                inputMode="search"
                placeholder="Scanner ou taper EAN, nom, catégorie…"
                className="min-w-0 flex-1 bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none"
                aria-label="Scanner un code-barres EAN-13 ou rechercher un produit"
              />
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex min-h-[52px] shrink-0 items-center justify-center gap-2.5 rounded-xl bg-gray-900 px-5 py-4 text-base font-semibold text-white shadow-md transition active:scale-[0.98] sm:min-w-[11rem] sm:px-6"
            >
              <ScanLine className="h-6 w-6 shrink-0" aria-hidden />
              <span>📷 Scanner</span>
            </button>
          </div>

          <div className="mb-6 -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {categoriesCaisse.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategorie(cat)}
                className={`shrink-0 snap-start rounded-full min-h-12 px-5 py-3 text-sm font-semibold transition-all duration-200 ${
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

        <div className="flex-1 px-6 pb-8 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-8 md:pb-10 lg:px-10">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          </div>
        ) : produits.length === 0 ? (
          <p className="py-16 text-center text-gray-400">Aucun produit en stock.</p>
        ) : groupesModelesAffiches.length === 0 ? (
          <p className="py-16 text-center text-gray-500">
            {searchQuery.trim() ? (
              <>Aucun modèle ne correspond à &quot;{searchQuery.trim()}&quot;.</>
            ) : (
              <>Aucun modèle pour la catégorie « {selectedCategorie} » en stock.</>
            )}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[500px]:grid-cols-2 sm:gap-5 lg:grid-cols-2 xl:grid-cols-3 xl:gap-6">
            <AnimatePresence mode="popLayout">
              {groupesModelesAffiches.map((groupe) => {
                const prixDifferes = groupe.prixMin !== groupe.prixMax;
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
                  className="group flex min-h-0 flex-col items-stretch rounded-3xl border border-gray-200/90 bg-white p-6 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md active:scale-[0.99] md:min-h-[200px] md:p-7"
                >
                  <div className="mb-4 flex min-h-28 flex-1 items-center justify-center rounded-2xl bg-gradient-to-b from-gray-50 to-white text-gray-300 ring-1 ring-inset ring-gray-100">
                    <ShoppingBag className="h-16 w-16 md:h-[4.5rem] md:w-[4.5rem]" />
                  </div>
                  <p className="line-clamp-2 text-lg font-bold tracking-tight text-gray-900 md:text-xl">
                    {groupe.nom}
                  </p>
                  {groupe.categorie && (
                    <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                      {groupe.categorie}
                    </p>
                  )}
                  <div className="mt-3 flex min-h-12 items-end justify-between gap-2">
                    <span className="text-xl font-bold text-gray-900 tabular-nums">
                      {prixDifferes
                        ? `À partir de ${formatPrix(groupe.prixMin)}`
                        : formatPrix(groupe.prixMin)}
                    </span>
                    <span className="shrink-0 rounded-full border border-gray-200/80 bg-gray-50 px-2.5 py-1 text-[11px] font-medium tabular-nums text-gray-600">
                      {groupe.nombreVariantes} variant
                      {groupe.nombreVariantes > 1 ? "es" : "e"}
                    </span>
                  </div>
                </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        </div>
      </section>

      {/* Ticket de caisse — droite ~40% (md+) ; pied avec Encaisser toujours accessible au pouce */}
      <aside className="hidden min-h-0 flex-col border-l border-gray-100 bg-white/90 backdrop-blur-xl md:flex md:w-[40%] md:min-w-0 md:sticky md:top-0 md:h-[100dvh] md:max-h-[100dvh] md:shadow-[0_-4px_30px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8 pb-4">
          {isMdUp && (
            <GamificationJauge
              refreshKey={gamificationRefreshKey}
              className="mb-6 shrink-0"
            />
          )}
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-xl font-semibold text-gray-900">
              Ticket de caisse
            </h2>
            {panier.length > 0 && (
              <button
                type="button"
                onClick={viderPanier}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-sm text-gray-400 transition-colors hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
                Vider
              </button>
            )}
          </div>
          <p className="mb-8 text-sm text-gray-400">
            {panier.length === 0 ? "Panier vide" : `${nbArticles} article${nbArticles > 1 ? "s" : ""}`}
          </p>
          {panier.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              Ouvrez un modèle, choisissez la couleur et la taille pour
              l&apos;ajouter.
            </p>
          ) : (
            <>
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {panier.map((ligne) => (
                    <motion.div
                      key={ligne.panierLineId}
                      layout
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50/50 p-4 transition-all duration-300"
                    >
                      <div className="min-w-0 flex-1">
                        {ligne.libelleOverride ? (
                          <>
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {ligne.libelleOverride}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {formatPrix(ligne.produit.prix)} × {ligne.quantite}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {ligne.produit.nom}
                            </p>
                            {formatVariantSubtitle(ligne.produit) && (
                              <p className="mt-0.5 truncate text-[11px] text-gray-500">
                                {formatVariantSubtitle(ligne.produit)}
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-gray-400">
                              {formatPrix(ligne.produit.prix)} × {ligne.quantite}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromPanier(ligne.panierLineId);
                          }}
                          className="flex size-[48px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-transform duration-200 hover:bg-gray-200 active:scale-95"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                        <span className="min-w-[2.5rem] text-center text-base font-bold text-gray-900">
                          {ligne.quantite}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addOneToLine(ligne.panierLineId);
                          }}
                          disabled={ligne.quantite >= ligne.produit.stock}
                          className="flex size-[48px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-transform duration-200 hover:bg-gray-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItemCompletely(ligne.panierLineId);
                          }}
                          className="flex size-[44px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-gray-300 transition-transform duration-200 hover:bg-red-50 hover:text-red-500 active:scale-95"
                          aria-label="Supprimer"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="mt-8 border-t border-gray-100 pt-8">
                <button
                  type="button"
                  onClick={() => setRemiseModalOpen(true)}
                  className="mb-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 py-3 text-sm font-semibold text-emerald-700 transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-100/80"
                >
                  <Percent className="h-4 w-4" />
                  Appliquer une remise
                </button>
                <div className="mb-4 space-y-2">
                  <p className="flex justify-between text-sm text-gray-500">
                    <span>Sous-total</span>
                    <span>{formatPrix(sousTotal)}</span>
                  </p>
                  {remiseAmount > 0 && (
                    <p className="flex justify-between text-sm font-medium text-emerald-600">
                      <span>Remise</span>
                      <span>-{formatPrix(remiseAmount)}</span>
                    </p>
                  )}
                  <p className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total à payer</span>
                    <span>{formatPrix(total)}</span>
                  </p>
                </div>
                <div data-skip-ean-capture>
                  <ClientCaisseSection
                    clientPhone={clientPhone}
                    onClientPhoneChange={setClientPhone}
                    clientNom={clientNom}
                    onClientNomChange={setClientNom}
                    resolvedClient={resolvedClient}
                    lookupLoading={clientLookupLoading}
                  />
                </div>

                <MoyenPaiementSelector
                  value={methodePaiement}
                  onChange={setMethodePaiement}
                  className="mt-6"
                />

                {/* Historique ventes du jour */}
                <div className="mt-8 border-t border-gray-100 pt-8">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                    <History className="h-4 w-4" />
                    Dernières ventes
                  </h3>
                  {loadingHistorique ? (
                    <div className="flex justify-center py-4">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
                    </div>
                  ) : ventesDuJour.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-400">Aucune vente.</p>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {ventesDuJour.map((v) => (
                          <motion.div
                            key={v.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50/80 px-4 py-3 ring-1 ring-gray-100"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900">
                                {new Date(v.created_at).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(v.ventes_items?.reduce((s, i) => s + i.quantite, 0) ?? 0)} article
                                {(v.ventes_items?.reduce((s, i) => s + i.quantite, 0) ?? 0) > 1 ? "s" : ""}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{formatPrix(v.total)}</span>
                            <button
                              type="button"
                              onClick={() => handleAnnulerVente(v)}
                              className="flex items-center gap-1.5 rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-all duration-200 hover:bg-red-100 active:scale-95"
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
              </div>
            </>
          )}
          </div>
          {panier.length > 0 && (
            <div className="sticky bottom-0 z-10 shrink-0 border-t border-gray-100 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.08)] backdrop-blur-md">
              <button
                type="button"
                onClick={handleEncaisser}
                disabled={encaissementLoading}
                className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-black py-5 text-xl font-bold text-white shadow-lg transition-all duration-300 hover:bg-gray-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 md:min-h-[60px] md:py-6 md:text-2xl"
              >
                {encaissementLoading ? "Encaissement..." : `Encaisser ${formatPrix(total)}`}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile: Bouton flottant panier - masqué sur tablette+ (sidebar panier visible) */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-20 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-gray-900 active:scale-95 md:hidden"
        aria-label="Ouvrir le panier"
      >
        <ShoppingBag className="h-7 w-7" />
        {nbArticles > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-900 shadow-sm">
            {nbArticles}
          </span>
        )}
      </button>

      {/* Mobile: Drawer panier - masqué sur tablette+ */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm md:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl border-t border-gray-100 bg-white shadow-[0_-10px_50px_-15px_rgba(0,0,0,0.15)] md:hidden">
            <div className="flex flex-col" style={{ maxHeight: "85vh" }}>
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Ticket de caisse
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-400">
                    {nbArticles} article{nbArticles > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {panier.length > 0 && (
                    <button
                      type="button"
                      onClick={viderPanier}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-gray-400 transition-colors hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                      Vider
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-full p-2.5 text-gray-400 transition-all duration-300 hover:bg-gray-100"
                    aria-label="Fermer"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6">
                {panier.length === 0 ? (
                  <p className="py-12 text-center text-gray-400">
                    Panier vide.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence mode="wait">
                      {panier.map((ligne) => (
                        <motion.div
                          key={ligne.panierLineId}
                          layout
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50/50 p-4"
                        >
                          <div className="min-w-0 flex-1">
                            {ligne.libelleOverride ? (
                              <>
                                <p className="truncate text-sm font-semibold text-gray-900">
                                  {ligne.libelleOverride}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-400">
                                  {formatPrix(ligne.produit.prix)} × {ligne.quantite}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="truncate text-sm font-semibold text-gray-900">
                                  {ligne.produit.nom}
                                </p>
                                {formatVariantSubtitle(ligne.produit) && (
                                  <p className="mt-0.5 truncate text-[11px] text-gray-500">
                                    {formatVariantSubtitle(ligne.produit)}
                                  </p>
                                )}
                                <p className="mt-0.5 text-xs text-gray-400">
                                  {formatPrix(ligne.produit.prix)} × {ligne.quantite}
                                </p>
                              </>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => removeFromPanier(ligne.panierLineId)}
                              className="flex size-[48px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-transform duration-200 hover:bg-gray-200 active:scale-95"
                            >
                              <Minus className="h-5 w-5" />
                            </button>
                            <span className="min-w-[2.5rem] text-center text-base font-bold text-gray-900">
                              {ligne.quantite}
                            </span>
                            <button
                              type="button"
                              onClick={() => addOneToLine(ligne.panierLineId)}
                              disabled={ligne.quantite >= ligne.produit.stock}
                              className="flex size-[48px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-transform duration-200 hover:bg-gray-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItemCompletely(ligne.panierLineId)}
                              className="flex size-[44px] min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-gray-300 transition-transform duration-200 hover:bg-red-50 hover:text-red-500 active:scale-95"
                              aria-label="Supprimer"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 bg-white p-6">
                <button
                  type="button"
                  onClick={() => setRemiseModalOpen(true)}
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 py-3 text-sm font-semibold text-emerald-700 transition-all duration-300 hover:bg-emerald-100/80"
                >
                  <Percent className="h-4 w-4" />
                  Appliquer une remise
                </button>
                <div className="mb-4 space-y-2">
                  <p className="flex justify-between text-sm text-gray-500">
                    <span>Sous-total</span>
                    <span>{formatPrix(sousTotal)}</span>
                  </p>
                  {remiseAmount > 0 && (
                    <p className="flex justify-between text-sm font-medium text-emerald-600">
                      <span>Remise</span>
                      <span>-{formatPrix(remiseAmount)}</span>
                    </p>
                  )}
                  <p className="mb-4 flex justify-between text-xl font-bold text-gray-900">
                    <span>Total à payer</span>
                    <span>{formatPrix(total)}</span>
                  </p>
                </div>
                <div data-skip-ean-capture>
                  <ClientCaisseSection
                    clientPhone={clientPhone}
                    onClientPhoneChange={setClientPhone}
                    clientNom={clientNom}
                    onClientNomChange={setClientNom}
                    resolvedClient={resolvedClient}
                    lookupLoading={clientLookupLoading}
                  />
                </div>
                <MoyenPaiementSelector
                  value={methodePaiement}
                  onChange={setMethodePaiement}
                  className="mt-6"
                />
                <button
                  type="button"
                  onClick={handleEncaisser}
                  disabled={panier.length === 0 || encaissementLoading}
                  className="mt-6 flex w-full items-center justify-center rounded-2xl bg-black py-5 text-xl font-bold text-white transition-all duration-300 hover:bg-gray-900 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {encaissementLoading ? "Encaissement..." : `Encaisser ${formatPrix(total)}`}
                </button>
                {ventesDuJour.length > 0 && (
                  <div className="mt-6 border-t border-gray-100 pt-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Dernières ventes
                    </h3>
                    <div className="max-h-32 space-y-2 overflow-auto">
                      <AnimatePresence mode="popLayout">
                        {ventesDuJour.slice(0, 5).map((v) => (
                          <motion.div
                            key={v.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="flex items-center justify-between gap-2 rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-gray-100"
                          >
                            <span className="text-sm text-gray-600">
                              {new Date(v.created_at).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="text-xs text-gray-500">
                              {(v.ventes_items?.reduce((s, i) => s + i.quantite, 0) ?? 0)} article
                              {(v.ventes_items?.reduce((s, i) => s + i.quantite, 0) ?? 0) > 1 ? "s" : ""}
                            </span>
                            <span className="text-sm font-bold">{formatPrix(v.total)}</span>
                            <button
                              type="button"
                              onClick={() => handleAnnulerVente(v)}
                              className="rounded-xl bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-100 active:scale-95"
                            >
                              Annuler
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <VarianteSelectionSheet
        open={modeleTiroir !== null}
        onOpenChange={(o) => {
          if (!o) setModeleTiroir(null);
        }}
        modeleNom={modeleTiroir?.nom ?? ""}
        variantes={variantesPourTiroir}
        formatPrix={formatPrix}
        onChoisirVariante={(p) => {
          addToPanier(p);
          const sub = formatVariantSubtitle(p);
          showToast(
            "success",
            `✅ ${p.nom}${sub ? ` — ${sub}` : ""} ajouté`
          );
        }}
      />

      <BarcodeCameraModal
        open={scannerOpen}
        onClose={closeScanner}
        onEan13={handleCameraEan}
      />

      {resolvedClient && (
        <ClientelingPanel
          clientId={resolvedClient.id}
          clientNom={resolvedClient.nom}
          phoneDigits={normalizePhoneForDb(clientPhone)}
          open={clientelingOpen}
          onClose={() => setClientelingOpen(false)}
          onAddRecommended={(produit) => {
            addToPanier(produit);
            showToast("success", `✅ ${produit.nom} ajouté`);
          }}
        />
      )}
    </div>
  );
}
