/**
 * Part espèces théorique d'une vente (espèces plein ou part dans un paiement mixte).
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function montantEspecesDepuisVente(v: {
  total: number;
  methode_paiement: string | null;
  montant_especes: number | null;
}): number {
  const m = v.methode_paiement;
  if (m === "especes") return round2(Number(v.total) || 0);
  if (m === "mixte") return round2(Number(v.montant_especes) || 0);
  return 0;
}

export function sommeEspecesVentes(
  ventes: Array<{
    total: number;
    methode_paiement: string | null;
    montant_especes: number | null;
  }>
): number {
  return round2(ventes.reduce((s, v) => s + montantEspecesDepuisVente(v), 0));
}
