import type { Produit } from "@/types/produit";

/** Zones physiques de la vue « plan magasin ». */
export type StoreZoneId = "homme" | "femme" | "accessoires" | "caisse";

export const RUPTURE_SEUIL = 2;

/**
 * Affecte une variante à un rayon du plan (d’après `categorie`).
 * — Femme l’emporte sur Homme si les deux apparaissent.
 * — Sinon Homme, sinon îlot (Accessoires / Enfant / divers).
 */
export function produitVersRayonId(p: Produit): "homme" | "femme" | "accessoires" {
  const c = (p.categorie ?? "").trim().toLowerCase();
  if (c.includes("femme") || c.includes("fille")) {
    return "femme";
  }
  if (c.includes("homme") || c.includes("garcon") || c.includes("garçon")) {
    return "homme";
  }
  return "accessoires";
}

export function estRuptureOuUrgent(stock: number): boolean {
  return stock < RUPTURE_SEUIL;
}

export type StatsRayon = {
  stockTotal: number;
  alertRupture: number;
  variantes: number;
};

function statsPourListe(rayon: Produit[], seuil: number): StatsRayon {
  return {
    stockTotal: rayon.reduce((s, p) => s + (p.stock ?? 0), 0),
    alertRupture: rayon.filter((p) => p.stock < seuil).length,
    variantes: rayon.length,
  };
}

export function statsParRayon(
  produits: Produit[],
  seuil: number = RUPTURE_SEUIL
): Record<"homme" | "femme" | "accessoires", StatsRayon> {
  const h: Produit[] = [];
  const f: Produit[] = [];
  const a: Produit[] = [];
  for (const p of produits) {
    const z = produitVersRayonId(p);
    if (z === "homme") h.push(p);
    else if (z === "femme") f.push(p);
    else a.push(p);
  }
  return {
    homme: statsPourListe(h, seuil),
    femme: statsPourListe(f, seuil),
    accessoires: statsPourListe(a, seuil),
  };
}

export function statsCaisseTousUrgents(
  produits: Produit[],
  seuil: number = RUPTURE_SEUIL
): StatsRayon {
  const alertes = produits.filter((p) => p.stock < seuil);
  return {
    stockTotal: produits.reduce((s, p) => s + p.stock, 0),
    alertRupture: alertes.length,
    variantes: produits.length,
  };
}

/**
 * Produits d’un rayon, tri : réassort d’abord, puis par nom.
 */
export function listerProduitsRayon(
  produits: Produit[],
  zone: "homme" | "femme" | "accessoires"
): Produit[] {
  return produits
    .filter((p) => produitVersRayonId(p) === zone)
    .sort((a, b) => {
      const ua = estRuptureOuUrgent(a.stock) ? 0 : 1;
      const ub = estRuptureOuUrgent(b.stock) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      if (a.stock !== b.stock) return a.stock - b.stock;
      return a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
    });
}

export function listerTousUrgents(produits: Produit[], seuil: number): Produit[] {
  return produits
    .filter((p) => p.stock < seuil)
    .sort((a, b) => a.stock - b.stock || a.nom.localeCompare(b.nom, "fr"));
}
