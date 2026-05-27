export type HistoricalKpiImportRow = {
  date: string;
  revenue: number;
  sales_count: number;
  average_basket: number;
};

function normalizeKey(key: string): string {
  return key
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Montant FR type « 1 248,66 € » → nombre. */
export function cleanFrenchCurrency(value: string): number {
  const cleaned = String(value ?? "")
    .replace(/€/g, "")
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".")
    .trim();

  if (!cleaned) return 0;

  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseFrenchDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const fr = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const dd = fr[1].padStart(2, "0");
    const mm = fr[2].padStart(2, "0");
    return `${fr[3]}-${mm}-${dd}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  return null;
}

function pickColumnValue(row: Record<string, string>, matcher: (normalizedKey: string) => boolean): string {
  for (const [key, value] of Object.entries(row)) {
    if (matcher(normalizeKey(key)) && value?.trim()) {
      return value.trim();
    }
  }
  return "";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mapKpiHistoryCsvRow(row: Record<string, string>): HistoricalKpiImportRow | null {
  const dateRaw = pickColumnValue(row, (k) => k.includes("date"));
  const revenueRaw = pickColumnValue(
    row,
    (k) => k.includes("chiffre") && k.includes("affaire")
  );
  const basketRaw = pickColumnValue(row, (k) => k.includes("panier") && k.includes("moyen"));

  const date = parseFrenchDate(dateRaw);
  const revenue = round2(cleanFrenchCurrency(revenueRaw));

  if (!date || revenue <= 0) return null;

  const average_basket = round2(cleanFrenchCurrency(basketRaw));
  const sales_count =
    average_basket > 0 ? Math.round(revenue / average_basket) : 0;

  return {
    date,
    revenue,
    sales_count: Math.max(0, sales_count),
    average_basket,
  };
}

export function mapKpiHistoryCsvRows(rows: Record<string, string>[]): HistoricalKpiImportRow[] {
  return rows.map(mapKpiHistoryCsvRow).filter((row): row is HistoricalKpiImportRow => row !== null);
}

export const KPI_HISTORY_PARSE_OPTIONS = {
  header: true as const,
  skipEmptyLines: true as const,
  delimiter: ";" as const,
};
