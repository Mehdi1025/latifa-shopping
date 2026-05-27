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
  /** Clés courtes pour limiter les tokens envoyés au modèle (évite 413 côté Groq). */
  const cleanData = recentTx.map((t) => ({
    d: t.dateISO.slice(0, 10),
    l: t.libelle.length > 160 ? t.libelle.slice(0, 160).trimEnd() : t.libelle,
    m: Math.round(t.montantEUR * 100) / 100,
  }));

  const { default: Groq } = await import("groq-sdk");
  const model =
    process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";

  const systemPrompt = `Tu es le DAF (Directeur Administratif et Financier) de la boutique Latifa B. (commerce de détail d'habillement). On te fournit un extrait de transactions récentes (qui peuvent inclure des dépenses courantes). Analyse ces données froidement et professionnellement. Ne sois jamais alarmiste. Concentre-toi sur les flux majeurs (principales rentrées d'argent, principaux postes de dépenses).
Fournis exactement 3 puces (bullet points) au format Markdown :
- 🟢 Rentrées majeures : [Analyse des revenus/virements reçus].
- 🔴 Postes de dépenses : [Analyse des dépenses principales].
- 💡 Recommandation DAF : [Une action concrète et mesurée pour optimiser la trésorerie].`;

  const userContent = `Extrait des transactions récentes (JSON — d=date, l=libellé, m=montant signé EUR) :\n${JSON.stringify(cleanData)}`;

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
