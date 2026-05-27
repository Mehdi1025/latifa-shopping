import { createSupabaseServerClient } from "@/utils/supabase/server";

export type FinanceTransactionAiInput = {
  id: string;
  dateISO: string;
  libelle: string;
  categorie: string;
  montantEUR: number;
};

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

export async function assertAdminFinanceGroq(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new FinanceAiError("Authentification requise.", 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isAdminRole((profile as { role?: string } | null)?.role)) {
    throw new FinanceAiError("Accès réservé aux administrateurs.", 403);
  }
}

export class FinanceAiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "FinanceAiError";
  }
}

function roundEUR(n: number): number {
  return Math.round(n * 100) / 100;
}

type FinanceAiSummary = {
  totalEntrees: number;
  totalSorties: number;
  variationNette: number;
  nbOperations: number;
  top5Rentrees: { d: string; l: string; m: number }[];
  top5Depenses: { d: string; l: string; m: number }[];
};

function buildFinanceAiSummary(
  transactions: FinanceTransactionAiInput[]
): FinanceAiSummary {
  let totalEntrees = 0;
  let totalSorties = 0;
  const rentrees: FinanceTransactionAiInput[] = [];
  const depenses: FinanceTransactionAiInput[] = [];

  for (const t of transactions) {
    if (t.montantEUR >= 0) {
      totalEntrees += t.montantEUR;
      rentrees.push(t);
    } else {
      totalSorties += Math.abs(t.montantEUR);
      depenses.push(t);
    }
  }

  const toCompact = (t: FinanceTransactionAiInput) => ({
    d: t.dateISO.slice(0, 10),
    l: t.libelle.length > 120 ? `${t.libelle.slice(0, 120).trimEnd()}…` : t.libelle,
    m: roundEUR(t.montantEUR),
  });

  const top5Rentrees = [...rentrees]
    .sort((a, b) => b.montantEUR - a.montantEUR)
    .slice(0, 5)
    .map(toCompact);

  const top5Depenses = [...depenses]
    .sort((a, b) => Math.abs(b.montantEUR) - Math.abs(a.montantEUR))
    .slice(0, 5)
    .map(toCompact);

  return {
    totalEntrees: roundEUR(totalEntrees),
    totalSorties: roundEUR(totalSorties),
    variationNette: roundEUR(totalEntrees - totalSorties),
    nbOperations: transactions.length,
    top5Rentrees,
    top5Depenses,
  };
}

/**
 * Appel Groq (Node uniquement). Pas d’import statique de groq-sdk.
 */
export async function generateFinancialInsightsGroq(
  transactions: FinanceTransactionAiInput[]
): Promise<string> {
  await assertAdminFinanceGroq();

  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new FinanceAiError("GROQ_API_KEY manquante côté serveur.", 500);
  }

  /** Max 40 dernières (déjà triées du plus récent au plus ancien côté appel). */
  const recentTx = transactions.slice(0, 40);
  const summary = buildFinanceAiSummary(transactions);
  /** Clés courtes pour limiter les tokens envoyés au modèle (évite 413 côté Groq). */
  const cleanData = recentTx.map((t) => ({
    d: t.dateISO.slice(0, 10),
    l: t.libelle.length > 160 ? t.libelle.slice(0, 160).trimEnd() : t.libelle,
    m: roundEUR(t.montantEUR),
  }));

  const { default: Groq } = await import("groq-sdk");
  const model =
    process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";

  const systemPrompt = `Tu es le DAF (Directeur Administratif et Financier) de la boutique Latifa B. (commerce de détail d'habillement). On te fournit un résumé analytique complet du fichier importé ainsi qu'un extrait des transactions récentes. Analyse ces données froidement et professionnellement. Ne sois jamais alarmiste. Concentre-toi sur les flux majeurs (principales rentrées d'argent, principaux postes de dépenses).
Fournis exactement 3 puces (bullet points) au format Markdown :
- 🟢 Rentrées majeures : [Analyse des revenus/virements reçus].
- 🔴 Postes de dépenses : [Analyse des dépenses principales].
- 💡 Recommandation DAF : [Une action concrète et mesurée pour optimiser la trésorerie].`;

  const userContent = `Résumé analytique du fichier importé (${summary.nbOperations} opérations) :
- Total des entrées : ${summary.totalEntrees} EUR
- Total des sorties : ${summary.totalSorties} EUR
- Variation nette sur la période : ${summary.variationNette} EUR
- Top 5 des plus grosses rentrées : ${JSON.stringify(summary.top5Rentrees)}
- Top 5 des plus grosses dépenses : ${JSON.stringify(summary.top5Depenses)}

Extrait des 40 transactions les plus récentes (JSON — d=date, l=libellé, m=montant signé EUR) :
${JSON.stringify(cleanData)}`;

  const client = new Groq({ apiKey: key });
  const chatCompletion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.3,
    max_tokens: 512,
  });

  return chatCompletion.choices[0]?.message?.content ?? "";
}
