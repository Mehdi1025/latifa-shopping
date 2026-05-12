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

  const systemPrompt = `Analyse ces 40 dernières transactions: ${JSON.stringify(cleanData)}. Donne 3 bullet points ultra-courts: 1/ 🟢 Point fort. 2/ 🔴 Alerte. 3/ 💡 Conseil.`;

  const client = new Groq({ apiKey: key });
  const chatCompletion = await client.chat.completions.create({
    model,
    messages: [{ role: "system", content: systemPrompt }],
    temperature: 0.35,
    max_tokens: 512,
  });

  return chatCompletion.choices[0]?.message?.content ?? "";
}
