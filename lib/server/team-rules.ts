import type { SupabaseClient } from "@supabase/supabase-js";

import { isAdminRole } from "@/lib/server/assert-admin";

export type TeamProfile = {
  id: string;
  role: string | null;
};

/** Compte les profils admin (insensible à la casse). */
export async function listAdminIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase.from("profiles").select("id, role");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((p) => isAdminRole((p as TeamProfile).role))
    .map((p) => (p as TeamProfile).id);
}

/** Empêche de retirer le dernier administrateur du tableau de bord. */
export function isLastAdminChangeBlocked(
  adminIds: string[],
  targetUserId: string,
  nextRole: string
): boolean {
  if (isAdminRole(nextRole)) return false;
  return adminIds.length === 1 && adminIds[0] === targetUserId;
}

export function isLastAdminRemovalBlocked(
  adminIds: string[],
  targetUserId: string
): boolean {
  return adminIds.includes(targetUserId) && adminIds.length === 1;
}
