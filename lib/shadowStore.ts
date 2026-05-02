/**
 * Magasin de l’ombre — agrégation à partir de `logs_activite`
 * (suppression_panier, annulation_vente).
 */

export type ShadowLineEntry = {
  nom: string;
  qty: number;
  prix_unitaire: number;
  sous_total: number;
};

export type ShadowManifest = {
  total_ttc: number;
  lignes: ShadowLineEntry[];
};

/** Ligne brute issue de Supabase (champs utilisés uniquement). */
export type ShadowLogRow = {
  id: string;
  created_at: string;
  vendeur_nom: string | null;
  type_action: string;
  details: string | null;
  niveau_alerte: string;
  valeur_perdue?: number | string | null;
  shadow_manifest?: unknown | null;
};

export type ShadowGhostTicketRow = {
  id: string;
  created_at: string;
  vendeur_nom: string;
  valeur: number;
  lignesRésumé: string;
  manifest: ShadowManifest | null;
};

export type ShadowStoreMetrics = {
  caFantomeTotalEUR: number;
  topVendeur: { nom: string; montantEUR: number } | null;
  topProduit: { label: string; count: number } | null;
  nbSuppressionsPanier: number;
  nbAnnulationsVente: number;
  ghostTickets: ShadowGhostTicketRow[];
};

const SHADOW_TYPES = ["suppression_panier", "annulation_vente"] as const;

export function isShadowTypeAction(action: string): boolean {
  return SHADOW_TYPES.includes(action as (typeof SHADOW_TYPES)[number]);
}

function toNumEUR(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  const n = Number.parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Fallback texte anciens logs (« total TTC xx,yy € »). */
export function parseTotalTTCFromDetails(details: string | null | undefined): number {
  if (!details) return 0;
  const m = details.match(
    /total\s*TTC\s*([\d\s]+(?:[,.]\d+)?)\s*€/i
  );
  if (!m?.[1]) return 0;
  const raw = m[1].replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export function valeurPerdueForRow(row: ShadowLogRow): number {
  const db = toNumEUR(row.valeur_perdue);
  if (db > 0) return Math.round(db * 100) / 100;
  if (row.type_action === "annulation_vente") {
    const m = asShadowManifest(row.shadow_manifest);
    if (m && m.total_ttc > 0) return Math.round(m.total_ttc * 100) / 100;
    return Math.round(parseTotalTTCFromDetails(row.details) * 100) / 100;
  }
  return 0;
}

export function asShadowManifest(raw: unknown): ShadowManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lignesRaw = o.lignes;
  if (!Array.isArray(lignesRaw)) return null;
  const total = Number(o.total_ttc);
  const lignes: ShadowLineEntry[] = [];
  for (const ln of lignesRaw) {
    if (!ln || typeof ln !== "object") continue;
    const rec = ln as Record<string, unknown>;
    const nom = typeof rec.nom === "string" ? rec.nom : "";
    const qty = typeof rec.qty === "number" ? rec.qty : Number(rec.qty);
    const pu =
      typeof rec.prix_unitaire === "number"
        ? rec.prix_unitaire
        : Number(rec.prix_unitaire);
    const st =
      typeof rec.sous_total === "number"
        ? rec.sous_total
        : Number(rec.sous_total);
    if (!nom.trim() || !Number.isFinite(qty) || qty <= 0) continue;
    lignes.push({
      nom,
      qty,
      prix_unitaire: Number.isFinite(pu) ? pu : 0,
      sous_total: Number.isFinite(st) ? st : 0,
    });
  }
  if (!Number.isFinite(total)) return null;
  return { total_ttc: Math.max(0, total), lignes };
}

/**
 * Extrait le libellé produit depuis `details` (formats caisse actuels).
 */
export function extractProductLabelFromSuppressionDetails(
  details: string | null | undefined
): string | null {
  if (!details) return null;
  const d = details.trim();
  const m1 = /^A supprimé\s+(.+?)\s+du panier(?:\s*\(|$)/i.exec(d);
  if (m1?.[1]) return m1[1].trim();
  const m2 = /^A retiré\s+\d+\s*[×x]\s*(.+?)\s+du panier/i.exec(d);
  if (m2?.[1]) return m2[1].trim();
  return null;
}

export function formatShadowEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function ghostLignesRésumé(m: ShadowManifest | null, details: string | null): string {
  if (m?.lignes?.length) {
    return m.lignes
      .map((l) => `${l.nom} ×${l.qty} (${formatShadowEUR(l.sous_total)})`)
      .join(" · ");
  }
  return (details ?? "—").replace(/\s+/g, " ").trim().slice(0, 480);
}

/** Réduit / groupe les lignes shadow en métriques + tickets fantômes. */
export function computeShadowStoreMetrics(rows: ShadowLogRow[]): ShadowStoreMetrics {
  const filt = rows.filter((r) => isShadowTypeAction(r.type_action));

  /** CA fantôme = somme valeurs pertinentes pour les deux types. */
  let caFantomeTotalEUR = 0;
  for (const row of filt) {
    caFantomeTotalEUR += valeurPerdueForRow(row);
  }
  caFantomeTotalEUR = Math.round(caFantomeTotalEUR * 100) / 100;

  /** Top vendeur : somme des valeurs (> 0) par vendeuse. */
  const vendeurMap = new Map<string, number>();
  for (const row of filt) {
    const add = valeurPerdueForRow(row);
    if (add <= 0) continue;
    const name = (row.vendeur_nom?.trim() || "Sans nom").slice(0, 120);
    vendeurMap.set(name, (vendeurMap.get(name) ?? 0) + add);
  }

  let topVendeur: { nom: string; montantEUR: number } | null = null;
  for (const [nom, montantEUR] of vendeurMap) {
    if (!topVendeur || montantEUR > topVendeur.montantEUR) {
      topVendeur = { nom, montantEUR: Math.round(montantEUR * 100) / 100 };
    }
  }

  /** Top produit : fréquence des suppressions (lignes). */
  const produitCount = new Map<string, number>();
  for (const row of filt) {
    if (row.type_action !== "suppression_panier") continue;
    const label = extractProductLabelFromSuppressionDetails(row.details);
    if (!label) continue;
    const key = label.slice(0, 200);
    produitCount.set(key, (produitCount.get(key) ?? 0) + 1);
  }
  let topProduit: { label: string; count: number } | null = null;
  for (const [label, count] of produitCount) {
    if (!topProduit || count > topProduit.count) {
      topProduit = { label, count };
    }
  }

  const ghostTickets: ShadowGhostTicketRow[] = filt
    .filter((r) => r.type_action === "annulation_vente")
    .map((r) => {
      const manifest = asShadowManifest(r.shadow_manifest);
      const valeur = valeurPerdueForRow(r);
      return {
        id: r.id,
        created_at: r.created_at,
        vendeur_nom: r.vendeur_nom?.trim() || "—",
        valeur: Math.round(valeur * 100) / 100,
        lignesRésumé: ghostLignesRésumé(manifest, r.details),
        manifest,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return {
    caFantomeTotalEUR,
    topVendeur,
    topProduit,
    nbSuppressionsPanier: filt.filter((r) => r.type_action === "suppression_panier")
      .length,
    nbAnnulationsVente: filt.filter((r) => r.type_action === "annulation_vente")
      .length,
    ghostTickets,
  };
}
