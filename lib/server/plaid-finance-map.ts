/** Types alignés avec l’API Groq et la page finance. */
export type SerializableBankTx = {
  id: string;
  dateISO: string;
  libelle: string;
  /** Doit être une valeur de badge côté UI (Fournisseur, Salaire, Taxes, Recette, Autre). */
  categorie: string;
  montantEUR: number;
};

export type PlaidTransactionLike = {
  transaction_id: string;
  name?: string | null;
  merchant_name?: string | null;
  amount: number;
  date: string;
  iso_currency_code?: string | null;
  payment_channel?: string | null;
  personal_finance_category?: { primary?: string | null; detailed?: string | null } | null;
};

export function categorizeFromPlaidTransaction(
  amount: number,
  libelle: string,
  paymentChannel?: string | null,
  pfCategory?: string | null
): string {
  const desc = libelle.toLowerCase();
  const channel = (paymentChannel || "").toLowerCase();
  const category = (pfCategory || "").toLowerCase();

  if (amount >= 0) return "Recette";

  if (/urssaf|impôt|impot|cfe|dgfip|tva\b|tax/.test(desc)) return "Taxes";
  if (
    (/virement\s+salaire/.test(desc) ||
      /\bsalaire\b/.test(desc) ||
      /paye\b/.test(desc)) &&
    amount <= -400
  ) {
    return "Salaire";
  }

  if (category.includes("income") || category.includes("payroll")) {
    return amount <= -400 ? "Salaire" : "Recette";
  }
  if (category.includes("tax")) return "Taxes";
  if (category.includes("food") || category.includes("shops") || category.includes("service")) {
    return "Fournisseur";
  }

  if (channel === "online" || channel === "in store") return "Fournisseur";
  if (channel === "transfer") return amount <= -800 ? "Fournisseur" : "Autre";

  return "Autre";
}

export function mapPlaidTransactionToSerializable(
  t: PlaidTransactionLike
): SerializableBankTx | null {
  if (!t.transaction_id) return null;
  if (typeof t.amount !== "number" || !Number.isFinite(t.amount)) return null;

  const currency = (t.iso_currency_code || "EUR").toUpperCase();
  if (currency !== "EUR") return null;

  const dateISO = String(t.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;

  const libelle = (
    typeof t.merchant_name === "string" && t.merchant_name.trim()
      ? t.merchant_name
      : typeof t.name === "string" && t.name.trim()
        ? t.name
        : "Opération"
  ).trim();

  const montantEUR = Math.round(-t.amount * 100) / 100;
  const categorie = categorizeFromPlaidTransaction(
    montantEUR,
    libelle,
    t.payment_channel,
    t.personal_finance_category?.primary
  );

  return {
    id: t.transaction_id,
    dateISO,
    libelle,
    categorie,
    montantEUR,
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
