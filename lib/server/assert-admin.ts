import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/utils/supabase/server";

export function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

export type AdminSession = {
  userId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};

export async function assertAdminSession(): Promise<
  AdminSession | NextResponse
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isAdminRole((profile as { role?: string } | null)?.role)) {
    return NextResponse.json(
      { error: "Accès réservé aux administrateurs." },
      { status: 403 }
    );
  }

  return { userId: user.id, supabase };
}
