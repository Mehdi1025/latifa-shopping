import { NextResponse } from "next/server";

import {
  buildSalesHeatmapMatrix,
  heatmapQueryFromDate,
  type SalesHeatmapPayload,
} from "@/lib/server/sales-heatmap";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

export async function GET() {
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
      return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
    }

    const from30 = heatmapQueryFromDate(30);

    const { data: rows, error } = await supabase
      .from("ventes")
      .select("created_at, total")
      .gte("created_at", from30)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payload: SalesHeatmapPayload = buildSalesHeatmapMatrix(rows ?? [], 30);

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
