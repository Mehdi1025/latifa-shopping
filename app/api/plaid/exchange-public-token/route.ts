import { NextResponse } from "next/server";

import { plaidClient } from "@/lib/plaidApi";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
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

    const body = (await request.json()) as { public_token?: unknown };
    const publicToken =
      typeof body.public_token === "string" ? body.public_token.trim() : "";

    if (!publicToken) {
      return NextResponse.json({ error: "public_token manquant." }, { status: 400 });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // TODO: Sauvegarder cet access_token de manière sécurisée dans Supabase pour cet utilisateur.
    const { error: saveError } = await supabase.from("shop_settings").upsert(
      {
        id: 1,
        plaid_item_id: itemId,
        plaid_access_token: accessToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (saveError) {
      console.error("Plaid token save error:", saveError.message);
      return NextResponse.json(
        { error: "Connexion Plaid réussie mais enregistrement impossible." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item_id: itemId });
  } catch (error: unknown) {
    const plaidError =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: unknown } }).response?.data !== "undefined"
        ? (error as { response?: { data?: unknown } }).response?.data
        : error;

    console.error("Plaid itemPublicTokenExchange error:", plaidError);

    return NextResponse.json(
      { error: "Échange du token Plaid impossible." },
      { status: 500 }
    );
  }
}
