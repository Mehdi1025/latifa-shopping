import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
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

type VenteRow = {
  total: number | null;
  created_at: string;
};

function aggregateVentes(ventes: VenteRow[]) {
  const count = ventes.length;
  const caTotal = round2(
    ventes.reduce((s, v) => s + (typeof v.total === "number" ? v.total : 0), 0)
  );
  return {
    nbVentes: count,
    caTotal,
    panierMoyen: count > 0 ? round2(caTotal / count) : 0,
  };
}

function summarizeHistory(rows: HistoryRow[]) {
  if (rows.length === 0) {
    return {
      nbJours: 0,
      caTotal: 0,
      caMoyenJour: 0,
      panierMoyen: 0,
      ventesTotales: 0,
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

  return {
    nbJours: rows.length,
    caTotal: round2(caTotal),
    caMoyenJour: round2(caTotal / rows.length),
    panierMoyen: panierCount > 0 ? round2(panierSum / panierCount) : 0,
    ventesTotales,
  };
}

function monthStartISO(ref = new Date()): string {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  return start.toISOString();
}

export async function POST() {
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
      return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const from30 = thirtyDaysAgo.toISOString();
    const fromMonth = monthStartISO();

    const [
      { data: ventes30, error: ventes30Error },
      { data: ventesMois, error: ventesMoisError },
      { data: historyRows, error: histError },
    ] = await Promise.all([
      supabase.from("ventes").select("total, created_at").gte("created_at", from30),
      supabase.from("ventes").select("total, created_at").gte("created_at", fromMonth),
      supabase
        .from("historical_kpis")
        .select("date, revenue, sales_count, average_basket")
        .order("date", { ascending: false })
        .limit(30),
    ]);

    if (ventes30Error) {
      return NextResponse.json({ error: ventes30Error.message }, { status: 500 });
    }
    if (ventesMoisError) {
      return NextResponse.json({ error: ventesMoisError.message }, { status: 500 });
    }
    if (histError) {
      return NextResponse.json({ error: histError.message }, { status: 500 });
    }

    const history = (historyRows ?? []) as HistoryRow[];
    if (history.length === 0) {
      return NextResponse.json(
        { error: "Aucune archive historique importée à analyser." },
        { status: 400 }
      );
    }

    const live30 = aggregateVentes((ventes30 ?? []) as VenteRow[]);
    const liveMois = aggregateVentes((ventesMois ?? []) as VenteRow[]);
    const histSummary = summarizeHistory(history);

    const key = process.env.GROQ_API_KEY?.trim();
    if (!key) {
      return NextResponse.json({ error: "GROQ_API_KEY manquante côté serveur." }, { status: 500 });
    }

    const { default: Groq } = await import("groq-sdk");
    const model =
      process.env.GROQ_KPI_MODEL?.trim() ||
      process.env.GROQ_MODEL?.trim() ||
      "llama-3.1-8b-instant";

    const systemPrompt = `Tu es le DAF de la boutique Latifa B. On te donne les chiffres actuels (mois en cours) ET les chiffres historiques (archives importées). Fais une comparaison froide et professionnelle. Fait-on mieux ou moins bien que dans le passé ? Ne sois jamais alarmiste.
Fournis exactement 3 puces au format Markdown :
- 📈 Tendance Comparative : [Analyse]
- ⚠️ Point de Vigilance : [Analyse]
- 💡 Recommandation Stratégique : [Action]`;

    const userContent = `Performances actuelles — 30 derniers jours (caisse live) :
${JSON.stringify(live30)}

Performances actuelles — mois en cours (caisse live) :
${JSON.stringify(liveMois)}

Archives importées — synthèse (${histSummary.nbJours} jours les plus récents) :
${JSON.stringify(histSummary)}

Détail archives (30 lignes les plus récentes, du plus récent au plus ancien) :
${JSON.stringify(history)}`;

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
    console.error("Groq analyze-history error:", e);
    const msg = e instanceof Error ? e.message : "Erreur lors de l'analyse IA.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
