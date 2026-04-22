/**
 * Import CSV & parsing des noms type « Qamis 1 - Blanc - T.60 » (flat SKU / EAN-13).
 */

/** Extrait 13 chiffres depuis une cellule (zéros de tête conservés, pas de type number). */
export function normalizeEan13String(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length < 13) return null;
  if (digits.length > 13) return digits.slice(-13);
  return digits;
}

/**
 * Découpe un libellé type « Modèle - Couleur - T.xxx ».
 * Avec 3+ segments : 1er = modèle, dernier = taille, le milieu = couleur (rejoint par « - »).
 */
export function parseVariantFromProductName(raw: string): {
  nomModele: string;
  couleur: string | null;
  taille: string | null;
} {
  const s = raw.trim();
  if (!s) return { nomModele: "", couleur: null, taille: null };
  const parts = s
    .split(/\s*-\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length <= 1) {
    return { nomModele: s, couleur: null, taille: null };
  }
  if (parts.length === 2) {
    const a = parts[0]!;
    const b = parts[1]!;
    if (/^T[.\s]?\d/i.test(b) || /^T\.?\d/i.test(b)) {
      return { nomModele: a, couleur: null, taille: b };
    }
    return { nomModele: a, couleur: b, taille: null };
  }
  const nomModele = parts[0]!;
  const taille = parts[parts.length - 1]!;
  const couleur = parts.slice(1, -1).join(" - ");
  return { nomModele, couleur: couleur || null, taille: taille || null };
}

export type ProduitImportRow = {
  nom: string;
  description: string | null;
  categorie: string | null;
  prix: number;
  stock: number;
  code_barre: string;
  taille: string | null;
  couleur: string | null;
};

export type ProduitImportLineResult =
  | { ok: true; row: ProduitImportRow }
  | { ok: false; error: string };

/**
 * Construit une ligne prête pour Supabase à partir d’une row CSV mappée par index.
 * Colonnes reconnues (normalisées en amont) : nom, prix, stock, code_barre (ou ean), taille, couleur, description, categorie.
 */
export function buildProduitImportRow(
  cells: string[],
  idx: Record<string, number | undefined>
): ProduitImportLineResult {
  const rawNom = String(cells[idx.nom!] ?? "").trim();
  if (!rawNom) {
    return { ok: false, error: "nom manquant" };
  }

  const eanCol = idx.code_barre ?? idx.ean13 ?? idx.ean;
  const eanRaw = eanCol !== undefined ? String(cells[eanCol] ?? "").trim() : "";
  const ean = normalizeEan13String(eanRaw);
  if (!ean) {
    return { ok: false, error: "EAN-13 manquant ou invalide (13 chiffres requis)" };
  }

  const hasTailleCol = idx.taille !== undefined;
  const hasCouleurCol = idx.couleur !== undefined;
  const parsed = parseVariantFromProductName(rawNom);

  let couleur: string | null = parsed.couleur;
  let taille: string | null = parsed.taille;
  let nomModele = parsed.nomModele;

  if (hasCouleurCol) {
    const v = String(cells[idx.couleur!] ?? "").trim();
    couleur = v || null;
  }
  if (hasTailleCol) {
    const v = String(cells[idx.taille!] ?? "").trim();
    taille = v || null;
  }
  if (hasTailleCol || hasCouleurCol) {
    const segs = rawNom
      .split(/\s*-\s*/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    nomModele = segs[0] ?? rawNom;
  }

  const prix = parseFloat(String(cells[idx.prix!] ?? "").replace(",", "."));
  const stock = parseInt(String(cells[idx.stock!] ?? "0"), 10);
  const description =
    idx.description !== undefined
      ? String(cells[idx.description] ?? "").trim() || null
      : null;
  const categorie =
    idx.categorie !== undefined
      ? String(cells[idx.categorie] ?? "").trim() || null
      : null;

  return {
    ok: true,
    row: {
      nom: nomModele || rawNom,
      description,
      categorie,
      prix: Number.isFinite(prix) && prix >= 0 ? prix : 0,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      code_barre: ean,
      taille,
      couleur,
    },
  };
}
