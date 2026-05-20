import type { AccountBase } from "plaid";

import { plaidClient } from "@/lib/plaidApi";
import type { PlaidTransactionLike } from "@/lib/server/plaid-finance-map";

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isLiquidEURAccount(a: AccountBase): boolean {
  if ((a.type || "").toLowerCase() !== "depository") return false;
  const currency = (a.balances.iso_currency_code || a.balances.unofficial_currency_code || "EUR").toUpperCase();
  return currency === "EUR";
}

export async function fetchPlaidAccounts(accessToken: string): Promise<AccountBase[]> {
  const response = await plaidClient.accountsGet({ access_token: accessToken });
  return response.data.accounts ?? [];
}

export async function fetchPlaidTransactions(
  accessToken: string,
  maxCount = 500
): Promise<PlaidTransactionLike[]> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 90);

  const merged: PlaidTransactionLike[] = [];
  let offset = 0;
  const pageSize = 500;

  while (merged.length < maxCount) {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: formatYmd(start),
      end_date: formatYmd(end),
      options: {
        count: Math.min(pageSize, maxCount - merged.length),
        offset,
      },
    });

    const batch = response.data.transactions ?? [];
    merged.push(...batch);
    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return merged.slice(0, maxCount);
}

export function computeLiquidEURBalance(accounts: AccountBase[]): number {
  let total = 0;
  for (const a of accounts) {
    if (!isLiquidEURAccount(a)) continue;
    const bal = a.balances.current ?? a.balances.available ?? 0;
    if (typeof bal === "number" && Number.isFinite(bal)) total += bal;
  }
  return Math.round(total * 100) / 100;
}

export function primaryLiquidityPresentation(accounts: AccountBase[]): {
  label: string;
  ibanMasked: string | null;
} {
  const liquid = accounts.filter(isLiquidEURAccount);
  const primary = liquid[0];
  if (!primary) {
    return { label: "Compte connecté", ibanMasked: null };
  }

  const label =
    typeof primary.name === "string" && primary.name.trim()
      ? primary.name.trim()
      : typeof primary.official_name === "string" && primary.official_name.trim()
        ? primary.official_name.trim()
        : "Compte courant";

  const mask = typeof primary.mask === "string" && primary.mask.trim() ? primary.mask.trim() : null;
  const ibanMasked = mask ? `FR** **** **** **** ${mask}` : null;

  return { label, ibanMasked };
}
