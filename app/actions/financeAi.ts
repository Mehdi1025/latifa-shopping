"use server";

import Groq from "groq-sdk";
import { createSupabaseServerClient } from "@/utils/supabase/server";

const SYSTEM_PROMPT =
  "Tu es un directeur financier expert. Analyse ce JSON de transactions bancaires récentes. Fais un résumé hyper concis en français en 3 points : 1/ 🟢 Un point positif. 2/ 🔴 Une alerte ou dépense anormale. 3/ 💡 Un conseil stratégique. Ne fais aucune introduction ni conclusion, donne uniquement les 3 points formatés.";

/** Charge utile sérialisable pour l’IA (transactions). */
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

async function assertAdminFinanceAccess(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autorisé");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isAdminRole((profile as { role?: string } | null)?.role)) {
    throw new Error("Non autorisé");
  }
}

export async function generateFinancialInsights(
  transactions: FinanceTransactionAiInput[]
): Promise<string> {
  await assertAdminFinanceAccess();

  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error("GROQ_API_KEY manquante côté serveur.");
  }

  const client = new Groq({ apiKey: key });
  const chatCompletion = await client.chat.completions.create({
    model: "llama3-70b-8192",
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
