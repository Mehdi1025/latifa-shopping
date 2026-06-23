import { NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/server/assert-admin";
import {
  DEFAULT_SHOP_SETTINGS_BUSINESS,
  normalizeShopSettingsBusiness,
  type ShopSettingsBusiness,
} from "@/lib/shop-settings";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT_FIELDS =
  "charges_fixes_mensuelles, objectif_ca_mensuel, objectif_commandes_mensuel";

async function loadSettings() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shop_settings")
    .select(SELECT_FIELDS)
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeShopSettingsBusiness(
    data as Record<string, unknown> | null
  );
}

/** Lecture des paramètres métier (tout utilisateur authentifié — KPI, etc.). */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const settings = await loadSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Impossible de charger les paramètres.";
    return NextResponse.json({ error: message, settings: DEFAULT_SHOP_SETTINGS_BUSINESS }, { status: 500 });
  }
}

type PatchBody = Partial<ShopSettingsBusiness>;

/** Mise à jour admin des paramètres métier. */
export async function PATCH(request: Request) {
  const session = await assertAdminSession();
  if (session instanceof NextResponse) return session;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const current = await loadSettings();
  const next = normalizeShopSettingsBusiness({
    charges_fixes_mensuelles:
      body.charges_fixes_mensuelles ?? current.charges_fixes_mensuelles,
    objectif_ca_mensuel: body.objectif_ca_mensuel ?? current.objectif_ca_mensuel,
    objectif_commandes_mensuel:
      body.objectif_commandes_mensuel ?? current.objectif_commandes_mensuel,
  });

  const { data, error } = await session.supabase
    .from("shop_settings")
    .upsert(
      {
        id: 1,
        ...next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select(SELECT_FIELDS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    settings: normalizeShopSettingsBusiness(data as Record<string, unknown>),
  });
}
