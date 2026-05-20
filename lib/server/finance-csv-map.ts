export type CsvImportRow = {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
};

export type SerializableBankTx = {
  id: string;
  dateISO: string;
  libelle: string;
  categorie: string;
  montantEUR: number;
  type: "income" | "expense";
};

export function categorizeFromDescription(
  libelle: string,
  type: "income" | "expense"
): string {
  if (type === "income") return "Recette";

  const desc = libelle.toLowerCase();
  if (/urssaf|impôt|impot|cfe|dgfip|tva\b|tax/.test(desc)) return "Taxes";
  if (/virement\s+salaire|\bsalaire\b|paye\b/.test(desc)) return "Salaire";
  if (/fournisseur|achat|amazon|carrefour|leclerc/.test(desc)) return "Fournisseur";
  return "Autre";
}

export function signedAmount(amount: number, type: "income" | "expense"): number {
  const abs = Math.round(Math.abs(amount) * 100) / 100;
  return type === "income" ? abs : -abs;
}

export function mapDbRowToSerializable(row: {
  id: string;
  date: string;
  description: string;
  amount: number | string;
  type: "income" | "expense";
}): SerializableBankTx {
  const amountNum =
    typeof row.amount === "number" ? row.amount : Number.parseFloat(String(row.amount));
  const safeAmount = Number.isFinite(amountNum) ? amountNum : 0;
  const libelle = row.description.trim() || "Opération";
  const dateISO = String(row.date).slice(0, 10);

  return {
    id: row.id,
    dateISO,
    libelle,
    categorie: categorizeFromDescription(libelle, row.type),
    montantEUR: signedAmount(safeAmount, row.type),
    type: row.type,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localYmdKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  const end = new Date(to);
  end.setHours(12, 0, 0, 0);
  while (d <= end) {
    keys.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

export function buildChartRolling7Days(
  txs: { dateISO: string; montantEUR: number }[],
  reference = new Date()
): { jour: string; entrees: number; sorties: number }[] {
  const end = new Date(reference);
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const keys = localYmdKeysBetween(start, end);

  const byDay = new Map<string, { entrees: number; sorties: number }>();
  for (const k of keys) {
    byDay.set(k, { entrees: 0, sorties: 0 });
  }

  for (const tx of txs) {
    const k = tx.dateISO.slice(0, 10);
    const bucket = byDay.get(k);
    if (!bucket) continue;
    if (tx.montantEUR >= 0) bucket.entrees += tx.montantEUR;
    else bucket.sorties += Math.abs(tx.montantEUR);
  }

  const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

  return keys.map((ymd) => {
    const [y, m, dd] = ymd.split("-").map(Number);
    const d = new Date(y, m - 1, dd, 12, 0, 0, 0);
    const jourLbl = `${dayFmt.format(d).replace(/\.$/, "")}. ${pad2(dd)}/${pad2(m)}`;
    const b = byDay.get(ymd)!;
    return {
      jour: jourLbl,
      entrees: Math.round(b.entrees * 100) / 100,
      sorties: Math.round(b.sorties * 100) / 100,
    };
  });
}
