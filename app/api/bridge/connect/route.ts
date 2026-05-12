import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { createConnectUrl, getBridgeToken } from "@/lib/bridgeApi";

export const dynamic = "force-dynamic";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

/** Retourne l’email admin pour `user_email` Bridge Connect (obligatoire pour une session durable). */
async function assertAdminBridgeConnect(): Promise<{ userEmail: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminRole((profile as { role?: string } | null)?.role)) {
    throw new Error("FORBIDDEN");
  }

  const fallback = process.env.BRIDGE_FALLBACK_CONNECT_EMAIL?.trim();
  const userEmail =
    typeof user.email === "string" && user.email.includes("@") ? user.email.trim() : fallback ?? "";

  if (!userEmail) {
    throw new Error("MISSING_BRIDGE_EMAIL");
  }

  return { userEmail };
}

export async function GET() {
  try {
    const { userEmail } = await assertAdminBridgeConnect();
    const token = await getBridgeToken();
    const connectUrl = await createConnectUrl(token, userEmail);
    return NextResponse.json({ url: connectUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Bridge";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs." },
        { status: 403 }
      );
    }
    if (msg === "MISSING_BRIDGE_EMAIL") {
      return NextResponse.json(
        {
          error:
            "Aucune adresse email sur le compte admin. Définissez BRIDGE_FALLBACK_CONNECT_EMAIL dans l’environnement ou ajoutez un email au compte utilisateur.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
