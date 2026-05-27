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

/** Montant FR tolérant — cellules vides, espaces, €, apostrophes dans les en-têtes. */
export function cleanFrenchCurrency(val: unknown): number {
  if (val == null || val === "") return 0;
  if (typeof val !== "string") {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    return 0;
  }
  const cleaned = val.replace(/[^0-9,-]/g, "").replace(",", ".");
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function findColumnKey(
  row: Record<string, string>,
  matcher: (normalizedKey: string) => boolean
): string | undefined {
  return Object.keys(row).find((k) => matcher(normalizeKey(k)));
}

export function mapKpiHistoryCsvRow(row: Record<string, string>): HistoricalKpiImportRow | null {
  const dateKey = findColumnKey(row, (k) => k.includes("date"));
  const caKey = findColumnKey(
    row,
    (k) => k.includes("chiffre") || k.includes("ca ")
  );
  const panierKey = findColumnKey(row, (k) => k.includes("panier"));

  const dateRaw = dateKey ? String(row[dateKey] ?? "").trim() : "";
  const date = parseFrenchDate(dateRaw);
  if (!date) return null;

  const revenue = round2(cleanFrenchCurrency(caKey ? row[caKey] : ""));
  const average_basket = round2(cleanFrenchCurrency(panierKey ? row[panierKey] : ""));
  const sales_count = average_basket > 0 ? Math.round(revenue / average_basket) : 0;

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
