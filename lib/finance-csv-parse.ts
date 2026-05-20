import type { CsvImportRow } from "@/lib/server/finance-csv-map";

function normalizeKey(key: string): string {
  return key
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

function parseCsvDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const fr = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (fr) {
    const dd = fr[1].padStart(2, "0");
    const mm = fr[2].padStart(2, "0");
    return `${fr[3]}-${mm}-${dd}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

export function mapCsvRowToImport(row: Record<string, string>): CsvImportRow | null {
  const dateRaw = pickField(row, ["Date", "date", "DATE", "Date operation", "Date opération"]);
  const description = pickField(row, [
    "Libellé",
    "Libelle",
    "Description",
    "label",
    "Libellé opération",
  ]);
  const amountRaw = pickField(row, ["Montant", "Amount", "montant", "Debit", "Crédit", "Credit"]);

  const date = parseCsvDate(dateRaw);
  const signedAmount = parseFrenchAmount(amountRaw);

  if (!date || !description || signedAmount === null || signedAmount === 0) return null;

  const abs = Math.round(Math.abs(signedAmount) * 100) / 100;
  const type: "income" | "expense" = signedAmount >= 0 ? "income" : "expense";

  return {
    date,
    description,
    amount: abs,
    type,
  };
}

export function mapCsvRows(rows: Record<string, string>[]): CsvImportRow[] {
  return rows.map(mapCsvRowToImport).filter((row): row is CsvImportRow => row !== null);
}
