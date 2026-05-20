import { NextResponse } from "next/server";

import {
  computeLiquidEURBalance,
  fetchPlaidAccounts,
  fetchPlaidTransactions,
  primaryLiquidityPresentation,
} from "@/lib/server/plaid-aggregator";
import {
  buildChartRolling7Days,
  mapPlaidTransactionToSerializable,
  type SerializableBankTx,
} from "@/lib/server/plaid-finance-map";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

export type PlaidFinancePayload =
  | { connected: false }
  | {
      connected: true;
      plaidItemId: string;
      balanceEUR: number;
      primaryAccountLabel: string;
      ibanMasked: string | null;
      transactions: SerializableBankTx[];
      chartData7j: { jour: string; entrees: number; sorties: number }[];
      upstreamError?: string;
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

    const { data: settings, error: settingsError } = await supabase
      .from("shop_settings")
      .select("plaid_item_id, plaid_access_token")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError) {
      const body: PlaidFinancePayload & { diagnostics?: string } = {
        connected: false,
      };
      if (process.env.NODE_ENV === "development") {
        body.diagnostics = settingsError.message;
      }
      return NextResponse.json(body, { status: 200 });
    }

    const plaidItemId =
      typeof settings?.plaid_item_id === "string" ? settings.plaid_item_id.trim() : "";
    const accessToken =
      typeof settings?.plaid_access_token === "string"
        ? settings.plaid_access_token.trim()
        : "";

    if (!plaidItemId || !accessToken) {
      return NextResponse.json({ connected: false } satisfies PlaidFinancePayload);
    }

    try {
      const accounts = await fetchPlaidAccounts(accessToken);
      const balanceEUR = computeLiquidEURBalance(accounts);
      const { label: primaryAccountLabel, ibanMasked: rawIbanMask } =
        primaryLiquidityPresentation(accounts);

      const rawTxs = await fetchPlaidTransactions(accessToken);
      const merged = new Map<string, SerializableBankTx>();

      for (const raw of rawTxs) {
        const row = mapPlaidTransactionToSerializable(raw);
        if (row) merged.set(row.id, row);
      }

      const transactions = [...merged.values()].sort((a, b) => {
        const ca = `${a.dateISO}\t${a.id}`;
        const cb = `${b.dateISO}\t${b.id}`;
        return cb.localeCompare(ca);
      });

      const capped = transactions.slice(0, 500);
      const chartData7j = buildChartRolling7Days(capped);

      return NextResponse.json({
        connected: true,
        plaidItemId,
        balanceEUR,
        primaryAccountLabel,
        ibanMasked: rawIbanMask ?? null,
        transactions: capped,
        chartData7j,
      } satisfies PlaidFinancePayload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur Plaid";
      return NextResponse.json({
        connected: true,
        plaidItemId,
        balanceEUR: 0,
        primaryAccountLabel: "Compte connecté",
        ibanMasked: null,
        transactions: [],
        chartData7j: buildChartRolling7Days([], new Date()),
        upstreamError: msg,
      } satisfies PlaidFinancePayload);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
