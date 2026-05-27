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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type HistoryRow = {
  date: string;
  revenue: number;
  sales_count: number;
  average_basket: number;
};

function summarizeHistory(rows: HistoryRow[]) {
  if (rows.length === 0) {
    return {
      nbJours: 0,
      caTotal: 0,
      caMoyenJour: 0,
      panierMoyen: 0,
      ventesTotales: 0,
      top5Ca: [] as { date: string; revenue: number }[],
    };
  }

  let caTotal = 0;
  let ventesTotales = 0;
  let panierSum = 0;
  let panierCount = 0;

  for (const r of rows) {
    caTotal += Number(r.revenue) || 0;
    ventesTotales += Number(r.sales_count) || 0;
    const basket = Number(r.average_basket) || 0;
    if (basket > 0) {
      panierSum += basket;
      panierCount += 1;
    }
  }

  const top5Ca = [...rows]
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 5)
    .map((r) => ({ date: r.date, revenue: round2(Number(r.revenue)) }));

  return {
    nbJours: rows.length,
    caTotal: round2(caTotal),
    caMoyenJour: round2(caTotal / rows.length),
    panierMoyen: panierCount > 0 ? round2(panierSum / panierCount) : 0,
    ventesTotales,
    top5Ca,
  };
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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const from30 = thirtyDaysAgo.toISOString();

    const [{ data: historyRows, error: histError }, { data: recentSales, error: salesError }] =
      await Promise.all([
        supabase
          .from("historical_kpis")
          .select("date, revenue, sales_count, average_basket")
          .order("date", { ascending: false })
          .limit(365),
        supabase
          .from("ventes")
          .select("total, created_at")
          .gte("created_at", from30),
      ]);

    if (histError) {
      console.error("historical_kpis fetch error:", histError.message);
    }
    if (salesError) {
      console.error("ventes fetch error:", salesError.message);
    }

    const history = (historyRows ?? []) as HistoryRow[];
    const histSummary = summarizeHistory(history);

    const ventesLive = (recentSales ?? []) as { total: number | null }[];
    const caLive30j = round2(
      ventesLive.reduce((s, v) => s + (typeof v.total === "number" ? v.total : 0), 0)
    );

    const key = process.env.GROQ_API_KEY?.trim();
    if (!key) {
      return NextResponse.json({ error: "GROQ_API_KEY manquante côté serveur." }, { status: 500 });
    }

    const { default: Groq } = await import("groq-sdk");
    const model =
      process.env.GROQ_KPI_MODEL?.trim() ||
      process.env.GROQ_MODEL?.trim() ||
      "llama-3.1-8b-instant";

    const systemPrompt = `Tu es le DAF de Latifa B. (commerce de détail d'habillement). Compare les performances actuelles (temps réel) avec l'historique importé. Analyse froidement et professionnellement. Ne sois jamais alarmiste.
Fournis exactement 3 puces au format Markdown :
- 📈 Tendance Générale : [Comparaison CA / panier / volume actuel vs historique].
- ⚠️ Point de vigilance : [Un écart ou risque mesuré, sans dramatisation].
- 💡 Recommandation : [Action concrète et réaliste pour la boutique].`;

    const userContent = `Performances actuelles (mois / live — JSON) :
${JSON.stringify({
  chiffreAffairesMois: round2(body.chiffreAffaires),
  panierMoyenMois: round2(body.panierMoyen),
  ventesSemaine: body.ventesSemaine,
  nbVentesMois: body.nbVentesMois,
  caJour: body.caJour,
  croissancePct: body.croissancePct,
  tauxConversionPct: body.tauxConversionPct,
  caLive30j,
  nbVentesLive30j: ventesLive.length,
})}

Historique importé — synthèse (${histSummary.nbJours} jours archivés) :
${JSON.stringify(histSummary)}

Échantillon récent de l'historique (10 derniers jours archivés) :
${JSON.stringify(history.slice(0, 10))}`;

    const client = new Groq({ apiKey: key });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
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
