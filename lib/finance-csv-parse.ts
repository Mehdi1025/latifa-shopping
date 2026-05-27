import type { CsvImportRow } from "@/lib/server/finance-csv-map";

function normalizeKey(key: string): string {
  return key
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pickField(row: Record<string, string>, candidates: string[]): string {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const normalized = normalizeKey(candidate);
    const hit = entries.find(([k]) => normalizeKey(k) === normalized);
    if (hit && hit[1]?.trim()) return hit[1].trim();
  }
  return "";
}

/** Montant FR : virgule décimale, signe éventuel (ex. -3,50). */
function parseFrenchAmount(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/\s/g, "")
    .replace(/\u00a0/g, "")
    .replace(/€/g, "")
    .replace(",", ".");

  if (!cleaned) return null;

  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Date FR DD/MM/YYYY → YYYY-MM-DD pour Supabase. */
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

function pickFieldBySubstring(row: Record<string, string>, patterns: string[]): string {
  const entries = Object.entries(row);
  for (const pattern of patterns) {
    const normalizedPattern = normalizeKey(pattern);
    const hit = entries.find(([k]) => normalizeKey(k).includes(normalizedPattern));
    if (hit && hit[1]?.trim()) return hit[1].trim();
  }
  return "";
}

function pickDescriptionField(row: Record<string, string>): string {
  const descKey = Object.keys(row).find((k) => {
    const normalized = normalizeKey(k);
    return normalized.includes("libell") || normalized.includes("description");
  });
  if (descKey && row[descKey]?.trim()) {
    return row[descKey].trim();
  }
  return pickFieldBySubstring(row, ["libell", "description"]);
}

export function mapCsvRowToImport(row: Record<string, string>): CsvImportRow | null {
  const dateRaw = pickField(row, ["Date transaction"]) || pickFieldBySubstring(row, ["date"]);
  const description = pickDescriptionField(row);
  const amountRaw = pickField(row, ["Montant"]) || pickFieldBySubstring(row, ["montant"]);

  const date = parseFrenchDate(dateRaw);
  const signedAmount = parseFrenchAmount(amountRaw);

  if (!date || signedAmount === null || !Number.isFinite(signedAmount)) return null;

  const abs = Math.round(Math.abs(signedAmount) * 100) / 100;
  if (abs === 0) return null;

  const type: "income" | "expense" = signedAmount >= 0 ? "income" : "expense";
  const finalDescription = description.trim() || "Opération";

  return {
    date,
    description: finalDescription,
    amount: abs,
    type,
  };
}

export function mapCsvRows(rows: Record<string, string>[]): CsvImportRow[] {
  return rows.map(mapCsvRowToImport).filter((row): row is CsvImportRow => row !== null);
}

/** Options PapaParse pour les exports bancaires français (point-virgule). */
export const FRENCH_BANK_CSV_PARSE_OPTIONS = {
  header: true as const,
  delimiter: ";" as const,
  skipEmptyLines: true as const,
};
