import { NextResponse, type NextRequest } from "next/server";
import {
  FinanceAiError,
  generateFinancialInsightsGroq,
  type FinanceTransactionAiInput,
} from "@/lib/server/finance-ai-groq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidTx(x: unknown): x is FinanceTransactionAiInput {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.dateISO === "string" &&
    typeof o.libelle === "string" &&
    typeof o.categorie === "string" &&
    typeof o.montantEUR === "number" &&
    Number.isFinite(o.montantEUR)
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
    }

    const raw = (body as { transactions?: unknown }).transactions;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "Le champ « transactions » doit être un tableau non vide." },
        { status: 400 }
      );
    }

    const transactions = raw.filter(isValidTx);
    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "Aucune transaction valide dans la requête." },
        { status: 400 }
      );
    }

    const content = await generateFinancialInsightsGroq(transactions);
    return NextResponse.json({ content });
  } catch (e) {
    if (e instanceof FinanceAiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg =
      e instanceof Error ? e.message : "Erreur lors de l’appel à l’IA.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
