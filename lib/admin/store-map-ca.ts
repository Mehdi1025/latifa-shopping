import type { Produit } from "@/types/produit";
import { produitVersRayonId } from "@/lib/admin/store-map-zones";

export type MouvementVenteLigne = {
  produit_id: string;
  quantite: number;
};

/**
 * A partir des mouvements de type VENTE (quantités souvent négatives),
 * estime le CA par produit (|quantité| × prix actuel du produit) puis par rayon.
 */
export function agregatCaVentesMouvements(
  produits: Produit[],
  mouvements: MouvementVenteLigne[]
): {
  parProduit: Map<string, number>;
  parRayon: { homme: number; femme: number; accessoires: number };
  totalMagasin: number;
} {
  const byId = new Map(produits.map((p) => [p.id, p] as const));
  const parProduit = new Map<string, number>();

  for (const m of mouvements) {
    const p = byId.get(m.produit_id);
    if (!p) continue;
    const q = Math.abs(m.quantite);
    if (q === 0) continue;
    const line = q * p.prix;
    parProduit.set(m.produit_id, (parProduit.get(m.produit_id) ?? 0) + line);
  }

  const parRayon = { homme: 0, femme: 0, accessoires: 0 as number };
  for (const p of produits) {
    const id = p.id;
    const ca = parProduit.get(id) ?? 0;
    if (ca === 0) continue;
    const z = produitVersRayonId(p);
    parRayon[z] += ca;
  }

  const totalMagasin =
    parRayon.homme + parRayon.femme + parRayon.accessoires;
  return { parProduit, parRayon, totalMagasin };
}

/** 0, 1 ou 2 : froid, tiède, chaud (écart à max des 3 rayons). */
export function trancheHeatmap(
  caRayon: number,
  maxDesRayons: number
): 0 | 1 | 2 {
  if (maxDesRayons <= 0) return 0;
  if (caRayon <= 0) return 0;
  const r = caRayon / maxDesRayons;
  if (r < 0.34) return 0;
  if (r < 0.67) return 1;
  return 2;
}

export function formatCaEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
