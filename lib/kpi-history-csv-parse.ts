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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * DD/MM/YYYY → YYYY-MM-DD. Tolère le BOM sur l'en-tête de colonne Date.
 */
export function formatKpiHistoryDate(
  row: Record<string, string>,
  keys: string[] = Object.keys(row)
): string | null {
  const dateKey = keys.find((k) =>
    k.toLowerCase().replace(/[^a-z]/g, "").includes("date")
  );

  let formattedDate: string | null = null;
  if (dateKey && row[dateKey]) {
    const rawDate = String(row[dateKey]).trim();
    const parts = rawDate.split("/");
    if (parts.length === 3) {
      formattedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }

  if (!formattedDate || formattedDate.length !== 10) {
    return null;
  }

  return formattedDate;
}

function findColumnKey(
  row: Record<string, string>,
  matcher: (normalizedKey: string) => boolean
): string | undefined {
  return Object.keys(row).find((k) => matcher(normalizeKey(k)));
}

export function mapKpiHistoryCsvRow(row: Record<string, string>): HistoricalKpiImportRow | null {
  const keys = Object.keys(row);
  const formattedDate = formatKpiHistoryDate(row, keys);
  if (!formattedDate) return null;

  const caKey = findColumnKey(
    row,
    (k) => k.includes("chiffre") || k.includes("ca ")
  );
  const panierKey = findColumnKey(row, (k) => k.includes("panier"));

  const revenue = round2(cleanFrenchCurrency(caKey ? row[caKey] : ""));
  const average_basket = round2(cleanFrenchCurrency(panierKey ? row[panierKey] : ""));
  const sales_count = average_basket > 0 ? Math.round(revenue / average_basket) : 0;

  return {
    date: formattedDate,
    revenue,
    sales_count: Math.max(0, sales_count),
    average_basket,
  };
}

export function mapKpiHistoryCsvRows(rows: Record<string, string>[]): HistoricalKpiImportRow[] {
  return rows.map(mapKpiHistoryCsvRow).filter((row): row is HistoricalKpiImportRow => row !== null);
}

/** Virgule (export Excel EN) — Papa détecte aussi le BOM UTF-8 sur la 1re colonne. */
export const KPI_HISTORY_PARSE_OPTIONS = {
  header: true as const,
  skipEmptyLines: true as const,
  delimiter: "," as const,
};
