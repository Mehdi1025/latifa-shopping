import type { BridgeTransactionResource } from "@/lib/server/bridge-aggregator";

/** Types alignés avec l’API Groq et la page finance. */
export type SerializableBankTx = {
  id: string;
  dateISO: string;
  libelle: string;
  /** Doit être une valeur de badge côté UI (Fournisseur, Salaire, Taxes, Recette, Autre). */
  categorie: string;
  montantEUR: number;
};

export function categorizeFromBridgeOperation(
  operationType: string | undefined,
  amount: number,
  providerDescription?: string | null
): string {
  const op = String(operationType || "unknown").toLowerCase();
  const desc = (providerDescription || "").toLowerCase();

  if (amount >= 0) return "Recette";

  if (/urssaf|impôt|impot|cfe|cfe|dgfip|tva\b|tax/.test(desc)) return "Taxes";
  if (
    (/virement\s+salaire/.test(desc) ||
      /\bsalaire\b/.test(desc) ||
      /paye\b/.test(desc)) &&
    amount <= -400
  ) {
    return "Salaire";
  }

  switch (op) {
    case "direct_debit":
      return /impot|cfe|social|pole emploi|caf/.test(desc) ? "Taxes" : "Fournisseur";
    case "card":
      return amount <= -3500 ? "Fournisseur" : "Fournisseur";
    case "transfer":
    case "open_banking":
      return amount <= -800 ? "Fournisseur" : "Autre";
    case "check":
    case "withdrawal":
    case "deposit":
      return amount >= 0 ? "Recette" : "Fournisseur";
    default:
      return "Autre";
  }
}

export function mapBridgeTransactionToSerializable(
  t: BridgeTransactionResource
): SerializableBankTx | null {
  if (t.deleted) return null;
  if (t.id === undefined || t.id === null) return null;
  if (typeof t.amount !== "number" || !Number.isFinite(t.amount)) return null;
  const currency = (t.currency_code || "EUR").toUpperCase();
  if (currency !== "EUR") return null;

  const dateISO = String(t.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;

  const libelle = (
    typeof t.clean_description === "string" && t.clean_description.trim()
      ? t.clean_description
      : typeof t.provider_description === "string" && t.provider_description.trim()
        ? t.provider_description
        : "Opération"
  ).trim();

  const montantEUR = Math.round(t.amount * 100) / 100;
  const categorie = categorizeFromBridgeOperation(
    t.operation_type,
    montantEUR,
    typeof t.provider_description === "string" ? t.provider_description : null
  );

  return {
    id: String(t.id),
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
