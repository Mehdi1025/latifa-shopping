import { createClient } from "@supabase/supabase-js";

/** Client service role — réservé aux routes API serveur (invitation, suppression). */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises pour la gestion d'équipe."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
