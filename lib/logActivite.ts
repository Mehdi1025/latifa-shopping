import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  isMeaningfulRrwebReplay,
  rrwebEventsSpanMs,
} from "@/lib/rrwebReplay";

export type NiveauAlerteLog = "info" | "warning" | "critique";

export type LogActiviteInsertExtras = {
  /** Événements rrweb (`eventWithTime[]`) sérialisables en JSON. */
  enregistrement_ecran?: unknown[] | null;
};

/** Écrit dans `logs_activite`. Ne doit jamais bloquer la caisse (erreurs ignorées). */
export async function logActivite(
  vendeur_nom: string | null | undefined,
  type_action: string,
  details: string,
  niveau_alerte: NiveauAlerteLog,
  extras?: LogActiviteInsertExtras
): Promise<void> {
  const nomTrim =
    typeof vendeur_nom === "string" && vendeur_nom.trim()
      ? vendeur_nom.trim()
      : null;

  const hasReplay = isMeaningfulRrwebReplay(extras?.enregistrement_ecran);

  try {
    const supabase = createSupabaseBrowserClient();
    const payload: Record<string, unknown> = {
      vendeur_nom: nomTrim,
      type_action,
      details,
      niveau_alerte,
    };
    if (hasReplay) {
      const ev = extras!.enregistrement_ecran as unknown[];
      payload.enregistrement_ecran = ev;
      payload.replay_span_ms = Math.floor(rrwebEventsSpanMs(ev));
    }

    const { error } = await supabase.from("logs_activite").insert(payload);
    if (error) console.warn("[logActivite]", error.message);
  } catch (e) {
    console.warn(
      "[logActivite]",
      e instanceof Error ? e.message : "insert failed"
    );
  }
}
