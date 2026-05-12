import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getBridgeToken } from "@/lib/bridgeApi";
import {
  accountIdsEligibleForTxSync,
  computeLiquidEURBalance,
  fetchBridgeAccounts,
  fetchBridgeTransactionsPage,
  primaryLiquidityPresentation,
} from "@/lib/server/bridge-aggregator";
import {
  buildChartRolling7Days,
  mapBridgeTransactionToSerializable,
  type SerializableBankTx,
} from "@/lib/server/bridge-finance-map";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

export type BridgeFinancePayload =
  | { connected: false }
  | {
      connected: true;
      bridgeItemId: string;
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
      .select("bridge_item_id")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError) {
      const body: BridgeFinancePayload & { diagnostics?: string } = {
        connected: false,
      };
      if (process.env.NODE_ENV === "development") {
        body.diagnostics = settingsError.message;
      }
      return NextResponse.json(body, { status: 200 });
    }

    const bridgeItemId =
      typeof settings?.bridge_item_id === "string"
        ? settings.bridge_item_id.trim()
        : "";

    if (!bridgeItemId) {
      return NextResponse.json({ connected: false } satisfies BridgeFinancePayload);
    }

    const token = await getBridgeToken();
    try {
      const accounts = await fetchBridgeAccounts(token, bridgeItemId);
      const balanceEUR = computeLiquidEURBalance(accounts);
      const { label: primaryAccountLabel, ibanMasked: rawIbanMask } =
        primaryLiquidityPresentation(accounts);

      const accountIds = accountIdsEligibleForTxSync(accounts);
      const merged = new Map<string, SerializableBankTx>();

      for (const aid of accountIds) {
        const slice = await fetchBridgeTransactionsPage(token, aid);
        for (const raw of slice) {
          const row = mapBridgeTransactionToSerializable(raw);
          if (row) merged.set(row.id, row);
        }
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
        bridgeItemId,
        balanceEUR,
        primaryAccountLabel,
        ibanMasked: rawIbanMask ?? null,
        transactions: capped,
        chartData7j,
      } satisfies BridgeFinancePayload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur Bridge";
      return NextResponse.json({
        connected: true,
        bridgeItemId,
        balanceEUR: 0,
        primaryAccountLabel: "Compte connecté",
        ibanMasked: null,
        transactions: [],
        chartData7j: buildChartRolling7Days([], new Date()),
        upstreamError: msg,
      } satisfies BridgeFinancePayload);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
