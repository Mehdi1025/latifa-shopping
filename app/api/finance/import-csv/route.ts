import { NextResponse } from "next/server";

import type { CsvImportRow } from "@/lib/server/finance-csv-map";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

function isValidRow(x: unknown): x is CsvImportRow {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const amount = o.amount;
  return (
    typeof o.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date) &&
    typeof o.description === "string" &&
    o.description.trim().length > 0 &&
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    (o.type === "income" || o.type === "expense")
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
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
    }

    const raw = (body as { transactions?: unknown }).transactions;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "Le champ « transactions » doit être un tableau non vide." },
        { status: 400 }
      );
    }

    const rows = raw.filter(isValidRow);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Aucune transaction valide dans la requête." },
        { status: 400 }
      );
    }

    const payload = rows.map((row) => ({
      date: row.date,
      description: row.description.trim(),
      amount: Math.round(row.amount * 100) / 100,
      type: row.type,
    }));

    const { data, error } = await supabase.from("bank_transactions").insert(payload).select("id");

    if (error) {
      console.error("bank_transactions insert error:", error.message);
      return NextResponse.json(
        { error: "Impossible d'enregistrer les transactions." },
        { status: 500 }
      );
    }

    const inserted = data?.length ?? payload.length;

    return NextResponse.json({
      success: true,
      inserted,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
