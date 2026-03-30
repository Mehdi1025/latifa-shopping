"use server";

import { createSupabaseServerClient } from "@/utils/supabase/server";

function deadlineJ7ISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function isNonAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() !== "admin";
}

export type ApplyStrategyResult =
  | { ok: true; created: number }
  | { ok: false; error: string };

/**
 * Crée des tâches Kanban à partir du scénario simulateur (KPI).
 * Réservé aux utilisateurs authentifiés avec le rôle admin.
 */
export async function applyStrategyToKanban(
  prixVar: number,
  traficVar: number,
  recrue: boolean
): Promise<ApplyStrategyResult> {
  const hasChange =
    prixVar !== 0 || traficVar !== 0 || recrue === true;
  if (!hasChange) {
    return { ok: false, error: "no_changes" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "unauthorized" };
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (me as { role?: string } | null)?.role;
  if ((role ?? "").trim().toLowerCase() !== "admin") {
    return { ok: false, error: "forbidden" };
  }

  const { data: profiles } = await supabase.from("profiles").select("id, role");
  const assigne =
    (profiles ?? []).find((p) => isNonAdminRole(p.role))?.id ?? null;

  const deadline = deadlineJ7ISO();
  const rows: {
    titre: string;
    statut: "a_faire";
    assigne_a: string | null;
    deadline: string;
    description: null;
  }[] = [];

  if (prixVar > 0) {
    rows.push({
      titre: `🎯 Mission : Augmenter les prix de ${prixVar}% en rayon.`,
      statut: "a_faire",
      assigne_a: assigne,
      deadline,
      description: null,
    });
  } else if (prixVar < 0) {
    rows.push({
      titre: `📉 Promo : Appliquer une remise de ${Math.abs(prixVar)}% en rayon.`,
      statut: "a_faire",
      assigne_a: assigne,
      deadline,
      description: null,
    });
  }

  if (traficVar !== 0) {
    const sign = traficVar > 0 ? "+" : "";
    rows.push({
      titre: `🏬 Fréquentation : scénario ${sign}${traficVar}% — définir le plan d'actions en boutique.`,
      statut: "a_faire",
      assigne_a: assigne,
      deadline,
      description: null,
    });
  }

  if (recrue) {
    rows.push({
      titre:
        "👩‍💼 RH : Lancer le recrutement d'une nouvelle vendeuse.",
      statut: "a_faire",
      assigne_a: assigne,
      deadline,
      description: null,
    });
  }

  if (rows.length === 0) {
    return { ok: false, error: "no_tasks" };
  }

  const { error: insertError } = await supabase.from("taches").insert(rows);

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true, created: rows.length };
}
