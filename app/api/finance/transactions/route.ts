import { NextResponse } from "next/server";

import {
  buildChartRolling7Days,
  mapDbRowToSerializable,
  type SerializableBankTx,
} from "@/lib/server/finance-csv-map";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

export type CsvFinancePayload = {
  transactions: SerializableBankTx[];
  recentImports: SerializableBankTx[];
  balanceEUR: number;
  chartData7j: { jour: string; entrees: number; sorties: number }[];
  totalCount: number;
};

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

    const { data: rows, error } = await supabase
      .from("bank_transactions")
      .select("id, date, description, amount, type, created_at")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const transactions = (rows ?? []).map((row) =>
      mapDbRowToSerializable({
        id: row.id,
        date: row.date,
        description: row.description,
        amount: row.amount,
        type: row.type as "income" | "expense",
      })
    );

    const { count } = await supabase
      .from("bank_transactions")
      .select("id", { count: "exact", head: true });

    const balanceEUR = Math.round(
      transactions.reduce((sum, tx) => sum + tx.montantEUR, 0) * 100
    ) / 100;

    const recentImports = [...transactions]
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
      .slice(0, 5);

    return NextResponse.json({
      transactions,
      recentImports,
      balanceEUR,
      chartData7j: buildChartRolling7Days(transactions),
      totalCount: count ?? transactions.length,
    } satisfies CsvFinancePayload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
