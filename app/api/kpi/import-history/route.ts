import { NextResponse } from "next/server";

import type { HistoricalKpiImportRow } from "@/lib/kpi-history-csv-parse";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

function isValidRow(x: unknown): x is HistoricalKpiImportRow {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date) &&
    typeof o.revenue === "number" &&
    Number.isFinite(o.revenue) &&
    o.revenue >= 0 &&
    typeof o.sales_count === "number" &&
    Number.isFinite(o.sales_count) &&
    o.sales_count >= 0 &&
    typeof o.average_basket === "number" &&
    Number.isFinite(o.average_basket) &&
    o.average_basket >= 0
  );
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
      return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
    }

    const raw = (body as { rows?: unknown }).rows;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "Le champ « rows » doit être un tableau non vide." },
        { status: 400 }
      );
    }

    const rows = raw.filter(isValidRow);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Aucune ligne KPI valide dans la requête." },
        { status: 400 }
      );
    }

    const payload = rows.map((row) => ({
      date: row.date,
      revenue: Math.round(row.revenue * 100) / 100,
      sales_count: row.sales_count,
      average_basket: Math.round(row.average_basket * 100) / 100,
    }));

    const { data, error } = await supabase
      .from("historical_kpis")
      .upsert(payload, { onConflict: "date" })
      .select("id, date");

    if (error) {
      console.error("historical_kpis upsert error:", error.message);
      return NextResponse.json(
        { error: "Impossible d'enregistrer l'historique KPI." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      upserted: data?.length ?? payload.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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

    const { data, error } = await supabase
      .from("historical_kpis")
      .select("id, date, revenue, sales_count, average_basket, created_at")
      .order("date", { ascending: false })
      .limit(120);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
