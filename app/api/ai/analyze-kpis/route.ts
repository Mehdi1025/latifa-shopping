import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type KpiAiPayload = {
  chiffreAffaires: number;
  depenses: number;
  panierMoyen: number;
  ventesSemaine: number;
  caJour?: number;
  croissancePct?: number;
  nbVentesMois?: number;
  tauxConversionPct?: number | null;
};

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

function isValidPayload(body: unknown): body is KpiAiPayload {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  const nums = ["chiffreAffaires", "depenses", "panierMoyen", "ventesSemaine"] as const;
  return nums.every(
    (k) => typeof o[k] === "number" && Number.isFinite(o[k] as number)
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!isAdminRole((profile as { role?: string } | null)?.role)) {
      return NextResponse.json(
        { error: "Accès réservé aux administrateurs." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
    }

    if (!isValidPayload(body)) {
      return NextResponse.json(
        {
          error:
            "Payload invalide. Champs requis : chiffreAffaires, depenses, panierMoyen, ventesSemaine (nombres).",
        },
        { status: 400 }
      );
    }

    const key = process.env.GROQ_API_KEY?.trim();
    if (!key) {
      return NextResponse.json({ error: "GROQ_API_KEY manquante côté serveur." }, { status: 500 });
    }

    const { default: Groq } = await import("groq-sdk");
    const model =
      process.env.GROQ_KPI_MODEL?.trim() ||
      process.env.GROQ_MODEL?.trim() ||
      "llama-3.1-8b-instant";

    const systemPrompt =
      "Tu es le directeur financier et stratégique d'une boutique de vêtements de détail (Latifa B.). Analyse ces KPIs, sois concis, professionnel et donne 3 recommandations d'actions immédiates en format Markdown (bullet points).";

    const userContent = JSON.stringify({
      chiffreAffaires: Math.round(body.chiffreAffaires * 100) / 100,
      depenses: Math.round(body.depenses * 100) / 100,
      panierMoyen: Math.round(body.panierMoyen * 100) / 100,
      ventesSemaine: body.ventesSemaine,
      caJour: body.caJour,
      croissancePct: body.croissancePct,
      nbVentesMois: body.nbVentesMois,
      tauxConversionPct: body.tauxConversionPct,
    });

    const client = new Groq({ apiKey: key });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Voici les KPIs actuels de la boutique (JSON) :\n${userContent}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 768,
    });

    const analysis = response.choices[0]?.message?.content?.trim() ?? "";

    if (!analysis) {
      return NextResponse.json({ error: "Réponse vide du modèle Groq." }, { status: 502 });
    }

    return NextResponse.json({ analysis });
  } catch (e) {
    console.error("Groq analyze-kpis error:", e);
    const msg = e instanceof Error ? e.message : "Erreur lors de l'analyse IA.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
