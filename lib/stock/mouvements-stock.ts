import type { SupabaseClient } from "@supabase/supabase-js";
import type { MouvementStockType } from "@/types/produit";

export type LogStockMovementInput = {
  produit_id: string;
  /** Positif = entrée, négatif = sortie. */
  quantite: number;
  type_mouvement: MouvementStockType;
  reference?: string | null;
};

/**
 * Enregistre un mouvement dans le journal (idempotent côté appelant : appeler une fois par événement).
 */
export async function logStockMovement(
  supabase: SupabaseClient,
  input: LogStockMovementInput
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("mouvements_stock").insert({
    produit_id: input.produit_id,
    quantite: input.quantite,
    type_mouvement: input.type_mouvement,
    reference: input.reference?.trim() || null,
  });
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}
