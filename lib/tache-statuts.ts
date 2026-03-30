/** Valeurs stockées en base (migration organisation_et_calendrier). */
export type TacheStatut = "a_faire" | "en_cours" | "termine";

export const TACHE_STATUTS: TacheStatut[] = ["a_faire", "en_cours", "termine"];

export const TACHE_STATUT_LABELS: Record<TacheStatut, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
};

export function isTacheTerminee(statut: string): boolean {
  const s = statut.trim().toLowerCase();
  return s === "termine" || s === "terminé";
}

/** Tolère les anciennes libellés français avant migration SQL. */
export function normalizeTacheStatut(raw: string): TacheStatut {
  const s = raw.trim().toLowerCase();
  if (s === "a_faire" || s === "à faire") return "a_faire";
  if (s === "en_cours" || s === "en cours") return "en_cours";
  if (s === "termine" || s === "terminé") return "termine";
  return "a_faire";
}
