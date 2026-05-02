import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export type NiveauAlerteLog = "info" | "warning" | "critique";

/** Écrit dans `logs_activite`. Ne doit jamais bloquer la caisse (erreurs ignorées). */
export async function logActivite(
  vendeur_nom: string | null | undefined,
  type_action: string,
  details: string,
  niveau_alerte: NiveauAlerteLog
): Promise<void> {
  const nomTrim =
    typeof vendeur_nom === "string" && vendeur_nom.trim()
      ? vendeur_nom.trim()
      : null;

  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("logs_activite").insert({
      vendeur_nom: nomTrim,
      type_action,
      details,
      niveau_alerte,
    });
    if (error) console.warn("[logActivite]", error.message);
  } catch (e) {
    console.warn(
      "[logActivite]",
      e instanceof Error ? e.message : "insert failed"
    );
  }
}
