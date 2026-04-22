import type { Produit } from "@/types/produit";

/** Libellé pour les produits sans couleur renseignée. */
export const CAISSE_COULEUR_DEFAUT = "Sans couleur";

export type GroupeModeleCatalogue = {
  /** Clé de groupe = `nom` trim. */
  nom: string;
  variantes: Produit[];
  /** Nombre de variantes (lignes / SKU) dans ce groupe, stock &gt; 0 (déjà le cas côté caisse). */
  nombreVariantes: number;
  couleursUniques: string[];
  taillesUniques: string[];
  prixMin: number;
  prixMax: number;
  /** Catégorie d’exemple (première variante) pour l’affichage optionnel. */
  categorie: string | null;
};

function sortTaille(a: string, b: string): number {
  return a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });
}

export function labelCouleurProduit(p: Produit): string {
  const c = p.couleur?.trim();
  return c ? c : CAISSE_COULEUR_DEFAUT;
}

export function labelTailleProduit(p: Produit): string {
  const t = p.taille?.trim();
  return t ? t : "—";
}

/**
 * Groupe les produits (flat SKU) par nom de modèle. Chaque `nom` distinct = un modèle de base.
 */
export function groupProduitsByModele(produits: Produit[]): GroupeModeleCatalogue[] {
  const byNom = new Map<string, Produit[]>();
  for (const p of produits) {
    const k = p.nom.trim() || p.id;
    if (!byNom.has(k)) byNom.set(k, []);
    byNom.get(k)!.push(p);
  }

  const out: GroupeModeleCatalogue[] = [];
  for (const [nom, variantes] of byNom) {
    const setC = new Set<string>();
    const setT = new Set<string>();
    const prixs: number[] = [];
    for (const v of variantes) {
      setC.add(labelCouleurProduit(v));
      setT.add(labelTailleProduit(v));
      prixs.push(v.prix);
    }
    out.push({
      nom,
      variantes,
      nombreVariantes: variantes.length,
      couleursUniques: Array.from(setC).sort((a, b) =>
        a.localeCompare(b, "fr", { sensitivity: "base" })
      ),
      taillesUniques: Array.from(setT).sort(sortTaille),
      prixMin: Math.min(...prixs),
      prixMax: Math.max(...prixs),
      categorie: variantes[0]?.categorie ?? null,
    });
  }
  return out.sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
}
