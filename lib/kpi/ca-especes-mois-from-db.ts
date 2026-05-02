import type { SupabaseClient } from "@supabase/supabase-js";
import { sommeEspecesVentes } from "@/lib/caisse/montant-especes-vente";

function monthRangeISO(ref: Date = new Date()): { start: string; end: string } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    ref.getFullYear(),
    ref.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Somme de la part espèces (dont mixte) sur les ventes du mois civil courant de `ref`. */
export async function fetchCaEspecesMoisDepuisDb(
  supabase: SupabaseClient,
  ref: Date = new Date()
): Promise<number> {
  const { start, end } = monthRangeISO(ref);
  const { data, error } = await supabase
    .from("ventes")
    .select("total, methode_paiement, montant_especes")
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) {
    console.error("[ca-especes-mois]", error.message);
    return 0;
  }

  const rows = (data ?? []) as Array<{
    total: number;
    methode_paiement: string | null;
    montant_especes: number | null;
  }>;

  return sommeEspecesVentes(rows);
}
