import { createSupabaseServerClient } from "@/utils/supabase/server";

const SYSTEM_PROMPT =
  "Tu es un directeur financier expert. Analyse ce JSON de transactions bancaires récentes. Fais un résumé hyper concis en français en 3 points : 1/ 🟢 Un point positif. 2/ 🔴 Une alerte ou dépense anormale. 3/ 💡 Un conseil stratégique. Ne fais aucune introduction ni conclusion, donne uniquement les 3 points formatés.";

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

  const { default: Groq } = await import("groq-sdk");
  const model =
    process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";

  const client = new Groq({ apiKey: key });
  const chatCompletion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify(transactions, null, 2),
      },
    ],
    temperature: 0.35,
    max_tokens: 512,
  });

  return chatCompletion.choices[0]?.message?.content ?? "";
}
