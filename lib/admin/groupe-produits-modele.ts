import type { Produit } from "@/types/produit";

export type GroupeProduitModele = {
  /** Clé = `nom` trim (modèle de base). */
  cle: string;
  nom: string;
  variantes: Produit[];
  stockTotal: number;
  variantesCount: number;
  prixMin: number;
  prixMax: number;
  /**
   * Catégorie affichée : valeur commune, ou le premier choix, ou `null` si hétérogène.
   */
  categorieAffiche: string | null;
  /** Toutes les catégories distinctes (debug / tooltip possible). */
  categoriesDistinctes: string[];
};

const STOCK_FAIBLE_SEUIL = 5;

export function isStockAgregTresBas(stockTotal: number): boolean {
  return stockTotal < STOCK_FAIBLE_SEUIL;
}

/**
 * Groupe les produits par nom de modèle (flat SKU) et calcule les agrégats.
 */
export function groupeProduitsParNom(produits: Produit[]): GroupeProduitModele[] {
  const byNom = new Map<string, Produit[]>();
  for (const p of produits) {
    const k = p.nom.trim() || p.id;
    if (!byNom.has(k)) byNom.set(k, []);
    byNom.get(k)!.push(p);
  }

  const out: GroupeProduitModele[] = [];
  for (const [cle, variantes] of byNom) {
    const stockTotal = variantes.reduce((s, v) => s + (v.stock ?? 0), 0);
    const prixs = variantes.map((v) => v.prix);
    const prixMin = Math.min(...prixs);
    const prixMax = Math.max(...prixs);
    const cats = variantes
      .map((v) => (v.categorie ?? "").trim())
      .filter(Boolean);
    const setCat = new Set(cats);
    const categoriesDistinctes = Array.from(setCat).sort((a, b) =>
      a.localeCompare(b, "fr", { sensitivity: "base" })
    );
    let categorieAffiche: string | null = null;
    if (categoriesDistinctes.length === 1) {
      categorieAffiche = categoriesDistinctes[0]!;
    } else if (categoriesDistinctes.length > 1) {
      categorieAffiche = "Plusieurs";
    } else {
      categorieAffiche = null;
    }
    out.push({
      cle,
      nom: cle,
      variantes: variantes.sort((a, b) => {
        const c = (a.couleur ?? "").localeCompare(b.couleur ?? "", "fr", {
          sensitivity: "base",
        });
        if (c !== 0) return c;
        return (a.taille ?? "").localeCompare(b.taille ?? "", "fr", {
          numeric: true,
          sensitivity: "base",
        });
      }),
      stockTotal,
      variantesCount: variantes.length,
      prixMin,
      prixMax,
      categorieAffiche,
      categoriesDistinctes,
    });
  }
  return out.sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
}
