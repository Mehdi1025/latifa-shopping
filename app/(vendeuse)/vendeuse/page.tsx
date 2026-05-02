"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  Plus,
  Minus,
  ShoppingBag,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Search,
  History,
  Percent,
  RotateCcw,
  Gift,
  User,
  ScanLine,
  ChevronDown,
  Boxes,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import ClientelingPanel from "@/components/vendeur/ClientelingPanel";
import GamificationJauge from "@/components/vendeur/GamificationJauge";
import VipRadar from "@/components/vendeur/VipRadar";
import FluxBoutiqueCard from "@/components/vendeur/FluxBoutiqueCard";
import BarcodeCameraModal, {
  type CameraScanResult,
} from "@/components/vendeur/BarcodeCameraModal";
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
import { useWedgeEan13Listener } from "@/hooks/useWedgeEan13Listener";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";
import { logActivite } from "@/lib/logActivite";

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

/** Saisie caisse FR (virgule ou point). */
function parseMontantFrancais(raw: string): number {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return 0;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Montant exact, dizaine supérieure, billet/coupure euro minimale ≥ total ; 3 valeurs distinctes. */
function quickCashMontantsEuros(totalTicket: number): number[] {
  const t = Math.round(Math.max(0, totalTicket) * 100) / 100;
  const dizaine = Math.ceil(t / 10) * 10;
  const billets = [5, 10, 20, 50, 100, 200, 500] as const;
  const billet = billets.find((b) => b + 1e-9 >= t) ?? billets[billets.length - 1];

  const ordered = [t, dizaine, billet];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const x of ordered) {
    const r = Math.round(x * 100) / 100;
    if (!seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  let pad = dizaine;
  while (out.length < 3) {
    pad = Math.ceil((pad + 0.01) / 10) * 10;
    const r = Math.round(pad * 100) / 100;
    if (seen.has(r)) {
      pad += 10;
      continue;
    }
    seen.add(r);
    out.push(r);
  }
  return out.slice(0, 3);
}

function formatVariantSubtitle(p: Produit): string | null {
  const a = p.couleur?.trim() || null;
  const b = p.taille?.trim() || null;
  if (!a && !b) return null;
  return [a, b].filter(Boolean).join(" • ");
}

function formatProduitLabelScan(p: Produit): string {
  const sub = formatVariantSubtitle(p);
  return sub ? `${p.nom} — ${sub}` : p.nom;
}

function libelleMoyenPaiementCaisse(m: MethodePaiement): string {
  switch (m) {
    case "carte":
      return "carte";
    case "especes":
      return "espèces";
    case "paypal":
      return "PayPal";
    case "mixte":
      return "mixte (espèces + carte)";
    default:
      return m;
  }
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
        className="mt-1 w-full select-text rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
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
            className="mt-1 w-full select-text rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
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

const cartDrawerVariants: Variants = {
  hidden: (fromRight: boolean) =>
    fromRight
      ? {
          x: "100%",
          y: 0,
          transition: { type: "spring", stiffness: 400, damping: 32 },
        }
      : {
          x: 0,
          y: "100%",
          transition: { type: "spring", stiffness: 400, damping: 32 },
        },
  visible: {
    x: 0,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 32 },
  },
};

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
  const [montantDonne, setMontantDonne] = useState("");
  const [montantEspecesMixte, setMontantEspecesMixte] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNom, setClientNom] = useState("");
  const [resolvedClient, setResolvedClient] = useState<ResolvedClient | null>(null);
  const [clientLookupLoading, setClientLookupLoading] = useState(false);
  const [clientelingOpen, setClientelingOpen] = useState(false);
  const [gamificationRefreshKey, setGamificationRefreshKey] = useState(0);
  /** Jauge catalogue : à partir de lg (sinon bloc repliable) */
  const [isLgUp, setIsLgUp] = useState(false);
  /** Tiroir panier : animation & layout (bas vs droite) */
  const [isMdUp, setIsMdUp] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const prevPanierLen = useRef(0);
  const eanInputRef = useRef<HTMLInputElement>(null);
  const tryAddByEanRef = useRef<(raw: string) => void>(() => {});
  const tryAddByEanWithResultRef = useRef<(raw: string) => CameraScanResult>(
    () => ({ ok: false })
  );
  const onWedgeEanRef = useRef<(ean: string) => void>(() => {});

  /** Nom pour `logs_activite` (profil ou fallback email). */
  const [nomVendeuseLog, setNomVendeuseLog] = useState<string>("");
  const { consumeReplaySegment } = useScreenRecorder(true);

  const supabase = createSupabaseBrowserClient();

  useLayoutEffect(() => {
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const syncLg = () => setIsLgUp(mqLg.matches);
    syncLg();
    mqLg.addEventListener("change", syncLg);
    return () => mqLg.removeEventListener("change", syncLg);
  }, []);

  useLayoutEffect(() => {
    const mqMd = window.matchMedia("(min-width: 768px)");
    const syncMd = () => setIsMdUp(mqMd.matches);
    syncMd();
    mqMd.addEventListener("change", syncMd);
    return () => mqMd.removeEventListener("change", syncMd);
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

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const name = (prof as { full_name?: string | null } | null)?.full_name;
      const fromProfile =
        typeof name === "string" && name.trim() ? name.trim() : "";
      setNomVendeuseLog(fromProfile || user.email || "");
    })();
  }, [supabase]);

  useEffect(() => {
    if (methodePaiement !== "especes") setMontantDonne("");
    if (methodePaiement !== "mixte") setMontantEspecesMixte("");
  }, [methodePaiement]);

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

  const categoriesCaisse = useMemo(() => {
    const uniqueCats = new Set(
      produits
        .map((p) => p.categorie?.trim())
        .filter((c): c is string => Boolean(c))
    );
    return ["Toutes", ...Array.from(uniqueCats).sort()];
  }, [produits]);

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
    const ligne = panier.find((l) => l.panierLineId === panierLineId);
    if (ligne) {
      const articleNom = ligne.libelleOverride ?? ligne.produit.nom;
      const detail =
        ligne.quantite <= 1
          ? `A supprimé ${articleNom} du panier`
          : `A retiré 1 × ${articleNom} du panier (${ligne.quantite - 1} restante(s))`;
      void logActivite(
        nomVendeuseLog,
        "suppression_panier",
        detail,
        "critique"
      );
    }
    setPanier((prev) => {
      const line = prev.find((l) => l.panierLineId === panierLineId);
      if (!line) return prev;
      if (line.quantite <= 1) {
        return prev.filter((l) => l.panierLineId !== panierLineId);
      }
      return prev.map((l) =>
        l.panierLineId === panierLineId
          ? { ...l, quantite: l.quantite - 1 }
          : l
      );
    });
  };

  const removeItemCompletely = async (panierLineId: string) => {
    const ligne = panier.find((l) => l.panierLineId === panierLineId);
    if (ligne) {
      const articleNom = ligne.libelleOverride ?? ligne.produit.nom;
      const replayPayload = consumeReplaySegment();
      await logActivite(
        nomVendeuseLog,
        "suppression_panier",
        `A supprimé ${articleNom} du panier (ligne entière · ${ligne.quantite} unité(s))`,
        "critique",
        replayPayload != null ? { enregistrement_ecran: replayPayload } : undefined
      );
    }
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

  const viderPanier = async () => {
    if (panier.length > 0) {
      const replayPayload = consumeReplaySegment();
      await logActivite(
        nomVendeuseLog,
        "annulation_vente",
        "A annulé une vente en cours (Panier vidé)",
        "critique",
        replayPayload != null ? { enregistrement_ecran: replayPayload } : undefined
      );
    }
    setPanier([]);
    setRemiseValue(0);
    setRemiseType("percent");
    setMethodePaiement("carte");
    setMontantDonne("");
    setMontantEspecesMixte("");
    setClientPhone("");
    setClientNom("");
    setResolvedClient(null);
  };

  const ouvrirPanierCaisse = () => {
    if (panier.length > 0) {
      void logActivite(
        nomVendeuseLog,
        "ouverture_tiroir",
        "A ouvert le tiroir sans encaisser",
        "warning"
      );
    }
    setDrawerOpen(true);
  };

  const sousTotal = panier.reduce((acc, l) => acc + l.produit.prix * l.quantite, 0);
  const nbArticles = panier.reduce((acc, l) => acc + l.quantite, 0);
  const ventesHistoriqueAffichees = useMemo(
    () => (isMdUp ? ventesDuJour : ventesDuJour.slice(0, 5)),
    [isMdUp, ventesDuJour]
  );

  const remiseAmount = useMemo(() => {
    if (remiseType === "percent") {
      return Math.round((sousTotal * (remiseValue / 100)) * 100) / 100;
    }
    return Math.min(remiseValue, sousTotal);
  }, [remiseType, remiseValue, sousTotal]);

  const total = Math.max(0, Math.round((sousTotal - remiseAmount) * 100) / 100);

  const montantDonneNum = useMemo(
    () => parseMontantFrancais(montantDonne),
    [montantDonne]
  );

  const monnaieARendre = useMemo(
    () => Math.max(0, Math.round((montantDonneNum - total) * 100) / 100),
    [montantDonneNum, total]
  );

  const quickCashMontants = useMemo(() => quickCashMontantsEuros(total), [total]);

  const especesInsuffisantPourEncaisser =
    methodePaiement === "especes" && montantDonneNum + 1e-9 < total;

  const montantEspecesMixteNum = useMemo(
    () => parseMontantFrancais(montantEspecesMixte),
    [montantEspecesMixte]
  );

  const resteACarte = useMemo(
    () => Math.max(0, Math.round((total - montantEspecesMixteNum) * 100) / 100),
    [total, montantEspecesMixteNum]
  );

  const mixteEncaissementInvalide =
    methodePaiement === "mixte" &&
    (montantEspecesMixteNum <= 0 || montantEspecesMixteNum + 1e-9 >= total);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  tryAddByEanWithResultRef.current = (raw: string): CameraScanResult => {
    const ean = normalizeEan13String(raw);
    if (!ean) {
      showToast("error", "EAN invalide (13 chiffres).");
      return { ok: false };
    }
    const p = produits.find((x) => (x.code_barre ?? "") === ean);
    if (!p) {
      showToast("error", "❌ Produit introuvable");
      return { ok: false };
    }
    if (p.id === MYSTERY_VAULT_PRODUCT_ID) {
      showToast("error", "Cet article n'est pas ajoutable au panier");
      return { ok: false };
    }
    if (p.stock < 1) {
      showToast("error", "Rupture de stock sur cette variante.");
      return { ok: false };
    }
    const productLabel = formatProduitLabelScan(p);
    addToPanier(p);
    showToast("success", `✅ ${p.nom} ajouté au panier !`);
    setSearchQuery("");
    return { ok: true, productLabel };
  };

  tryAddByEanRef.current = (raw: string) => {
    void tryAddByEanWithResultRef.current(raw);
  };

  onWedgeEanRef.current = (ean: string) => tryAddByEanRef.current(ean);

  useWedgeEan13Listener({
    inputRef: eanInputRef,
    blocked: remiseModalOpen || scannerOpen,
    onEan13Ref: onWedgeEanRef,
  });

  const handleCameraEan = useCallback(
    (ean: string): CameraScanResult => tryAddByEanWithResultRef.current(ean),
    []
  );

  const closeScanner = useCallback(() => setScannerOpen(false), []);

  useEffect(() => {
    const t = window.setTimeout(() => eanInputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

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
    if (methodePaiement === "especes" && parseMontantFrancais(montantDonne) + 1e-9 < total) {
      return;
    }
    if (methodePaiement === "mixte") {
      const esp = parseMontantFrancais(montantEspecesMixte);
      if (esp <= 0 || esp + 1e-9 >= total) return;
    }
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

      const venteInsert: Record<string, unknown> = {
        vendeur_id: user.id,
        total,
        remise: remiseAmount,
        methode_paiement: methodePaiement,
        ...(clientId ? { client_id: clientId } : {}),
      };
      if (methodePaiement === "mixte") {
        const esp = Math.round(montantEspecesMixteNum * 100) / 100;
        const cb = Math.max(0, Math.round((total - esp) * 100) / 100);
        venteInsert.montant_especes = esp;
        venteInsert.montant_carte = cb;
      }

      const { data: vente, error: venteError } = await supabase
        .from("ventes")
        .insert(venteInsert)
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

      const replayPayload = consumeReplaySegment();
      await logActivite(
        nomVendeuseLog,
        "encaissement",
        `Encaissement validé de ${total.toFixed(2)}€ en ${libelleMoyenPaiementCaisse(methodePaiement)}`,
        "info",
        replayPayload != null ? { enregistrement_ecran: replayPayload } : undefined
      );

      setPanier([]);
      setRemiseValue(0);
      setRemiseType("percent");
      setMethodePaiement("carte");
      setMontantDonne("");
      setMontantEspecesMixte("");
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
    <div
      className="relative flex h-full min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden overscroll-none bg-gray-50 select-none max-md:max-w-[100vw] md:h-[100dvh] md:max-h-[100dvh] md:flex-none md:flex-row lg:max-w-none [&_a]:[-webkit-tap-highlight-color:transparent] [&_button]:[-webkit-tap-highlight-color:transparent]"
    >
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
              className="fixed left-1/2 top-1/2 z-[90] w-[calc(100%-2rem)] max-h-[min(90dvh,640px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-100 md:max-w-lg"
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Appliquer une remise</h3>
                <button
                  type="button"
                  onClick={() => setRemiseModalOpen(false)}
                  className="flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 [-webkit-tap-highlight-color:transparent]"
                  aria-label="Fermer"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="mb-5 flex gap-2 rounded-2xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setRemiseType("percent")}
                  className={`min-h-[48px] flex-1 rounded-xl py-2.5 text-sm font-medium transition-all [-webkit-tap-highlight-color:transparent] ${
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
                  className={`min-h-[48px] flex-1 rounded-xl py-2.5 text-sm font-medium transition-all [-webkit-tap-highlight-color:transparent] ${
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
                      className={`inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl px-4 text-sm font-semibold transition-all [-webkit-tap-highlight-color:transparent] ${
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
                    className="w-full select-text rounded-2xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
            className={`fixed left-1/2 top-8 z-[100] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] max-md:top-[calc(3.5rem+env(safe-area-inset-top,0px)+0.75rem)] sm:px-6 sm:py-4 lg:top-8 ${
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

      {/* Catalogue pleine largeur (plus de colonne panier fixe) */}
      <section className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden overscroll-none bg-gray-50">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile : titre + recherche + catégories collants ; desktop : flux normal */}
          <div className="z-20 w-full max-w-full shrink-0 border-b border-transparent bg-gray-50/95 backdrop-blur-md max-md:sticky max-md:left-0 max-md:right-0 max-md:top-[calc(3.5rem+env(safe-area-inset-top,0px))] max-md:border-gray-200/80 max-md:shadow-[0_6px_24px_-12px_rgba(0,0,0,0.1)] md:static md:top-0 md:border-0 md:bg-gray-50 md:shadow-none md:backdrop-blur-none">
            <div className="px-4 pb-2 pt-2 md:px-7 md:pb-5 md:pt-8 lg:px-10 lg:pb-6">
              <div className="mb-2.5 flex items-start justify-between gap-2 md:mb-6">
                <div className="min-w-0">
                  <h1 className="text-base font-semibold tracking-tight text-gray-900 md:text-xl lg:text-2xl">
                    Catalogue
                  </h1>
                  <p className="mt-0.5 text-[10px] leading-snug text-gray-400 md:mt-1 md:text-sm">
                    Touchez un modèle → variante → panier.
                  </p>
                </div>
                <Link
                  href="/vendeuse/stock"
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-[0.98] md:px-4 md:text-sm"
                >
                  <Boxes className="h-4 w-4" aria-hidden />
                  Stocks
                </Link>
              </div>

              <div className="mb-2 flex shrink-0 flex-row items-stretch gap-2 md:mb-5 md:gap-3">
                <div className="flex min-h-[48px] min-w-0 flex-1 shrink-0 items-center gap-2 rounded-xl border border-gray-100/90 bg-white px-3 py-2 shadow-sm md:min-h-[52px] md:gap-3 md:border-0 md:px-4 md:py-3 md:ring-1 md:ring-gray-100/80">
                  <Search className="h-4 w-4 shrink-0 text-gray-400 md:h-5 md:w-5" />
                  <input
                    ref={eanInputRef}
                    id="caisse-ean-search"
                    type="search"
                    name="search-ean"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      if (e.nativeEvent.isComposing) return;
                      if (e.ctrlKey || e.altKey || e.metaKey) return;
                      const digits = e.currentTarget.value.replace(/\D/g, "");
                      if (digits.length === 13) {
                        e.preventDefault();
                        tryAddByEanRef.current(digits);
                      }
                    }}
                    autoFocus
                    autoComplete="off"
                    inputMode="search"
                    placeholder="EAN, nom, catégorie…"
                    className="min-w-0 flex-1 select-text bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none md:text-base"
                    aria-label="Scanner un code-barres EAN-13 ou rechercher un produit"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 text-base font-semibold text-white shadow-md transition active:scale-[0.98] [-webkit-tap-highlight-color:transparent] md:min-h-[52px] md:min-w-[11rem] md:px-6 md:py-4"
                  aria-label="Ouvrir le scanner"
                >
                  <ScanLine className="h-5 w-5 shrink-0 md:h-6 md:w-6" aria-hidden />
                  <span className="hidden sm:inline">Scanner</span>
                </button>
              </div>

              <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:mb-0 md:gap-2 [&::-webkit-scrollbar]:hidden">
                {categoriesCaisse.map((cat) => (
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
            {!isLgUp && (
              <details className="mb-3 w-full max-w-full rounded-2xl border border-gray-200/80 bg-white/90 shadow-sm open:bg-white open:shadow-md lg:hidden [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-left">
                  <span className="text-xs font-semibold text-gray-800">
                    Objectifs, VIP & flux boutique
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                </summary>
                <div className="space-y-3 border-t border-gray-100 px-3 pb-3 pt-2">
                  <GamificationJauge
                    refreshKey={gamificationRefreshKey}
                    className="!mb-0"
                  />
                  <VipRadar />
                  <FluxBoutiqueCard />
                </div>
              </details>
            )}
            {isLgUp && (
              <div className="md:px-0">
                <VipRadar />
                <FluxBoutiqueCard />
              </div>
            )}

            {loading ? (
              <div className="flex flex-1 items-center justify-center py-24">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
              </div>
            ) : produits.length === 0 ? (
              <p className="py-16 text-center text-gray-400">
                Aucun produit en stock.
              </p>
            ) : groupesModelesAffiches.length === 0 ? (
              <p className="py-16 text-center text-gray-500">
                {searchQuery.trim() ? (
                  <>Aucun modèle ne correspond à &quot;{searchQuery.trim()}&quot;.</>
                ) : (
                  <>Aucun modèle pour la catégorie « {selectedCategorie} » en stock.</>
                )}
              </p>
            ) : (
              <div
                className={`grid w-full max-w-full grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3 md:grid-cols-2 md:gap-4 md:pt-0 md:pb-10 lg:grid-cols-3 ${
                  panier.length > 0
                    ? "max-md:pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]"
                    : "pb-6 max-md:pb-8"
                }`}
              >
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
                          <span className="shrink-0 rounded-full border border-gray-200/80 bg-gray-50 px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-gray-600 md:px-2.5 md:py-1 md:text-[11px]">
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
        </div>
      </section>


      {/* Barre panier native mobile (&lt; md) — au-dessus de la bottom nav layout (z-40) */}
      {panier.length > 0 && !drawerOpen && (
        <button
          type="button"
          onClick={ouvrirPanierCaisse}
          className="fixed inset-x-0 z-[45] flex min-h-[56px] max-w-[100vw] items-center gap-2.5 rounded-t-2xl border border-white/10 bg-gray-900 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 text-left text-white shadow-[0_-12px_48px_rgba(0,0,0,0.35)] transition-colors active:bg-gray-800 [-webkit-tap-highlight-color:transparent] max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:hidden"
          aria-label="Voir le panier"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12">
            <ShoppingBag className="h-5 w-5 opacity-95" aria-hidden />
          </span>
          <span className="flex min-w-[2rem] items-center justify-center rounded-lg bg-emerald-500/90 px-2.5 py-1 text-sm font-bold tabular-nums text-white">
            {nbArticles}
          </span>
          <span className="min-w-0 flex-1 text-center text-[13px] font-semibold uppercase tracking-wider text-white/95">
            Panier
          </span>
          <span className="shrink-0 text-base font-bold tabular-nums tracking-tight">
            {formatPrix(total)}
          </span>
        </button>
      )}

      {/* Bouton panier flottant — tablette et + (md:) */}
      {!drawerOpen && (
        <motion.button
          type="button"
          onClick={ouvrirPanierCaisse}
          aria-label="Ouvrir le panier"
          whileTap={{ scale: 0.94 }}
          className="fixed bottom-8 right-6 z-50 hidden h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-black text-white shadow-2xl [-webkit-tap-highlight-color:transparent] md:bottom-12 md:right-10 md:flex"
        >
          <ShoppingBag className="h-8 w-8" strokeWidth={2.25} aria-hidden />
          {nbArticles > 0 && (
            <motion.span
              key={nbArticles}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ type: "spring", stiffness: 520, damping: 14 }}
              className="absolute -right-1 -top-1 flex min-h-7 min-w-7 items-center justify-center rounded-full border-[3px] border-white bg-red-500 px-1.5 text-sm font-bold tabular-nums text-white shadow-md"
            >
              {nbArticles}
            </motion.span>
          )}
        </motion.button>
      )}

      {/* Tiroir panier : bas (&lt; md) · droite (md+) — scroll lignes + options ; pied = encaissement */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="cart-backdrop"
              role="presentation"
              className="fixed inset-0 z-[55] bg-gray-900/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              key="cart-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cart-drawer-title"
              custom={isMdUp}
              variants={cartDrawerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="fixed z-[60] flex flex-col overflow-hidden bg-white shadow-2xl max-md:inset-x-0 max-md:bottom-0 max-md:h-[90dvh] max-md:max-h-[90dvh] max-md:rounded-t-[1.25rem] max-md:border-t max-md:border-gray-200/80 md:right-0 md:top-0 md:h-[100dvh] md:max-h-[100dvh] md:w-full md:max-w-[400px] md:border-l md:border-gray-200/80 md:pt-[env(safe-area-inset-top,0px)]"
            >
            <div className="flex shrink-0 flex-col items-center border-b border-gray-100 px-4 pt-2 sm:px-6 md:hidden">
              <div
                className="mb-2 h-1 w-10 shrink-0 rounded-full bg-gray-200/90"
                aria-hidden
              />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-1 sm:px-6">
              <div className="min-w-0">
                <h2 id="cart-drawer-title" className="text-lg font-semibold text-gray-900">
                  Ticket de caisse
                </h2>
                <p className="text-xs text-gray-400">
                  {nbArticles} article{nbArticles > 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {panier.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      viderPanier();
                    }}
                    className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-1 rounded-lg px-2 text-sm text-gray-500 [-webkit-tap-highlight-color:transparent] hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Vider</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full text-gray-500 [-webkit-tap-highlight-color:transparent] hover:bg-gray-100"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
              {panier.length === 0 ? (
                <p className="py-12 text-center text-gray-400">Panier vide.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    <AnimatePresence mode="wait">
                      {panier.map((ligne) => (
                        <motion.div
                          key={ligne.panierLineId}
                          layout
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50/50 p-3"
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
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => removeFromPanier(ligne.panierLineId)}
                              className="flex size-[48px] min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 [-webkit-tap-highlight-color:transparent] active:scale-95"
                            >
                              <Minus className="h-5 w-5" />
                            </button>
                            <span className="min-w-[2rem] text-center text-sm font-bold text-gray-900">
                              {ligne.quantite}
                            </span>
                            <button
                              type="button"
                              onClick={() => addOneToLine(ligne.panierLineId)}
                              disabled={ligne.quantite >= ligne.produit.stock}
                              className="flex size-[48px] min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 [-webkit-tap-highlight-color:transparent] active:scale-95 disabled:opacity-50"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItemCompletely(ligne.panierLineId)}
                              className="flex size-[48px] min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-full text-gray-300 [-webkit-tap-highlight-color:transparent] hover:bg-red-50 hover:text-red-500"
                              aria-label="Supprimer"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRemiseModalOpen(true)}
                    className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 py-3 text-sm font-semibold text-emerald-700 [-webkit-tap-highlight-color:transparent] active:bg-emerald-100/80"
                  >
                    <Percent className="h-4 w-4" />
                    Appliquer une remise
                  </button>
                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
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
                    <p className="flex justify-between text-base font-bold text-gray-900">
                      <span>Total à payer</span>
                      <span>{formatPrix(total)}</span>
                    </p>
                  </div>
                  <div className="mt-4" data-skip-ean-capture>
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
                    className="mt-6 [&_button]:min-h-[48px] [&_button]:min-w-[48px] [&_button]:[-webkit-tap-highlight-color:transparent]"
                  />
                  {methodePaiement === "mixte" && (
                    <div
                      data-skip-ean-capture
                      className="mt-4 rounded-2xl border border-violet-200/80 bg-violet-50/40 p-4"
                    >
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-violet-900/80">
                          Montant donné en ESPÈCES
                        </span>
                        <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-3 shadow-sm ring-1 ring-violet-100">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            value={montantEspecesMixte}
                            onChange={(e) => setMontantEspecesMixte(e.target.value)}
                            placeholder="0,00"
                            className="min-w-0 flex-1 select-text bg-transparent text-lg font-bold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none"
                          />
                          <span className="shrink-0 text-lg font-semibold text-violet-600">
                            €
                          </span>
                        </div>
                      </label>
                      <p className="mt-4 rounded-xl bg-blue-50 p-4 text-center text-lg font-black tracking-tight text-blue-700 ring-1 ring-blue-100">
                        Reste à régler par CARTE : {formatPrix(resteACarte)}
                      </p>
                      {mixteEncaissementInvalide && (
                        <p className="mt-2 text-center text-xs font-medium text-amber-800">
                          Saisissez une part en espèces strictement entre 0 et le total (sinon
                          choisissez Espèces ou Carte).
                        </p>
                      )}
                    </div>
                  )}
                  {methodePaiement === "especes" && (
                    <div
                      data-skip-ean-capture
                      className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Rendu de monnaie
                      </p>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {quickCashMontants.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMontantDonne(m.toFixed(2))}
                            className="min-h-[48px] min-w-[48px] flex-1 rounded-xl bg-white px-3 py-2.5 text-center text-sm font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition active:scale-[0.98] sm:flex-none sm:px-4 [-webkit-tap-highlight-color:transparent]"
                          >
                            {formatPrix(m)}
                          </button>
                        ))}
                      </div>
                      <label className="block">
                        <span className="sr-only">Autre montant donné</span>
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            value={montantDonne}
                            onChange={(e) => setMontantDonne(e.target.value)}
                            placeholder="Autre montant donné…"
                            className="min-w-0 flex-1 select-text bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                          />
                          <span className="shrink-0 text-lg font-semibold text-slate-500">
                            €
                          </span>
                        </div>
                      </label>
                      <div className="mt-3" aria-live="polite">
                        {montantDonneNum + 1e-9 >= total ? (
                          <p className="rounded-xl bg-emerald-50 p-3 text-center text-2xl font-black tracking-tight text-emerald-600">
                            À rendre : {formatPrix(monnaieARendre)}
                          </p>
                        ) : (
                          <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-800">
                            Montant insuffisant
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {ventesDuJour.length > 0 && (
                    <div className="mt-6 border-t border-gray-100 pt-4">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Dernières ventes
                      </h3>
                      <div className="max-h-36 space-y-2 overflow-y-auto overscroll-contain">
                        <AnimatePresence mode="popLayout">
                          {ventesDuJour.slice(0, 5).map((v) => (
                            <motion.div
                              key={v.id}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-gray-100"
                            >
                              <span className="text-sm text-gray-600">
                                {new Date(v.created_at).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="text-xs text-gray-500">
                                {(v.ventes_items?.reduce((s, i) => s + i.quantite, 0) ?? 0)} art.
                              </span>
                              <span className="text-sm font-bold">{formatPrix(v.total)}</span>
                              <button
                                type="button"
                                onClick={() => handleAnnulerVente(v)}
                                className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-red-50 px-2 text-xs font-semibold text-red-600 [-webkit-tap-highlight-color:transparent] active:scale-95"
                              >
                                Annuler
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {panier.length > 0 && (
              <div className="shrink-0 border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
                <button
                  type="button"
                  onClick={handleEncaisser}
                  disabled={
                    encaissementLoading ||
                    especesInsuffisantPourEncaisser ||
                    mixteEncaissementInvalide
                  }
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-black py-4 text-lg font-bold text-white [-webkit-tap-highlight-color:transparent] active:scale-[0.98] disabled:opacity-50"
                >
                  {encaissementLoading
                    ? "Encaissement..."
                    : `Encaisser ${formatPrix(total)}`}
                </button>
              </div>
            )}
            </motion.div>
        </>
        )}
      </AnimatePresence>

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
