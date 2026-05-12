function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return String(v).trim();
}

/** Base API agrégation (v3). Surchargeable si Bridge change de préfixe. */
export function bridgeAggregationRoot(): string {
  const raw =
    process.env.BRIDGE_AGGREGATION_URL?.trim() ||
    "https://api.bridgeapi.io/v3/aggregation";
  return raw.replace(/\/+$/, "");
}

export function bridgeApiVersion(): string {
  return process.env.BRIDGE_API_VERSION?.trim() || "2025-01-15";
}

export type BridgeAccountResource = {
  id?: number;
  name?: string;
  balance?: number;
  accounting_balance?: number;
  instant_balance?: number;
  type?: string;
  currency_code?: string;
  item_id?: number;
  iban?: string | null;
  data_access?: string;
};

export type BridgeTransactionResource = {
  id?: number;
  clean_description?: string;
  provider_description?: string;
  amount?: number;
  date?: string;
  currency_code?: string;
  deleted?: boolean;
  operation_type?: string;
  account_id?: number;
};

function bridgeHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": requireEnv("BRIDGE_CLIENT_ID"),
    "Client-Secret": requireEnv("BRIDGE_CLIENT_SECRET"),
    "Bridge-Version": bridgeApiVersion(),
  };
}

async function parseJsonSafely(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function fetchBridgeAccounts(
  accessToken: string,
  itemId: string
): Promise<BridgeAccountResource[]> {
  const root = bridgeAggregationRoot();
  const qs = new URLSearchParams({
    item_id: String(itemId),
    limit: "100",
  });

  const res = await fetch(`${root}/accounts?${qs}`, {
    method: "GET",
    headers: bridgeHeaders(accessToken),
    cache: "no-store",
  });

  const body = (await parseJsonSafely(res)) as {
    resources?: BridgeAccountResource[];
  };

  if (!res.ok) {
    throw new Error(
      `Bridge accounts (${res.status}): ${JSON.stringify(body).slice(0, 600)}`
    );
  }

  return Array.isArray(body.resources) ? body.resources : [];
}

export async function fetchBridgeTransactionsPage(
  accessToken: string,
  accountId: number,
  limit = 250
): Promise<BridgeTransactionResource[]> {
  const root = bridgeAggregationRoot();
  const qs = new URLSearchParams({
    account_id: String(accountId),
    limit: String(Math.min(500, Math.max(1, limit))),
  });

  const res = await fetch(`${root}/transactions?${qs}`, {
    method: "GET",
    headers: bridgeHeaders(accessToken),
    cache: "no-store",
  });

  const body = (await parseJsonSafely(res)) as {
    resources?: BridgeTransactionResource[];
  };

  if (!res.ok) {
    throw new Error(
      `Bridge transactions (${res.status}) compte ${accountId}: ${JSON.stringify(body).slice(0, 400)}`
    );
  }

  return Array.isArray(body.resources) ? body.resources : [];
}

/** Comptes « liquidités » : pas les prêts / assurance vie. */
const LIQUID_TYPES = new Set(["checking", "savings", "card", "unknown"]);

function isLiquidEURAccount(a: BridgeAccountResource): boolean {
  const cur = (a.currency_code || "EUR").toUpperCase();
  if (cur !== "EUR") return false;
  if (a.data_access === "disabled") return false;
  const typ = String(a.type || "").toLowerCase();
  if (typ === "loan" || typ === "life_insurance" || typ === "brokerage")
    return false;
  if (typ === "" || LIQUID_TYPES.has(typ)) return true;
  return false;
}

export function computeLiquidEURBalance(
  accounts: BridgeAccountResource[]
): number {
  let sum = 0;
  for (const a of accounts) {
    if (!isLiquidEURAccount(a)) continue;
    const b =
      a.instant_balance ?? a.balance ?? a.accounting_balance ?? 0;
    if (typeof b === "number" && Number.isFinite(b)) sum += b;
  }
  return Math.round(sum * 100) / 100;
}

export function maskIbanDigits(iban: string): string {
  const s = iban.replace(/\s/g, "").toUpperCase();
  if (s.length < 8) return "IBAN ****";
  const last4 = s.slice(-4);
  return `${s.slice(0, 4)} **** **** **** ${last4}`;
}

export function accountIdsEligibleForTxSync(
  accounts: BridgeAccountResource[]
): number[] {
  const ids: number[] = [];
  for (const a of accounts) {
    if (!isLiquidEURAccount(a)) continue;
    if (typeof a.id === "number" && Number.isFinite(a.id)) ids.push(a.id);
  }
  return ids;
}

export function primaryLiquidityPresentation(
  accounts: BridgeAccountResource[]
): { label: string; ibanMasked: string | null } {
  const liquids = accounts.filter(isLiquidEURAccount);

  const checking = liquids.find(
    (a) => String(a.type || "").toLowerCase() === "checking"
  );
  const pick = checking || liquids[0];
  const label =
    typeof pick?.name === "string" && pick.name.trim()
      ? pick.name.trim()
      : "Compte connecté";

  const iban = pick?.iban;
  let ibanMasked: string | null = null;
  if (typeof iban === "string" && iban.replace(/\s/g, "").length >= 8) {
    ibanMasked = maskIbanDigits(iban);
  }

  return { label, ibanMasked };
}
