"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Euro,
  ShoppingBag,
  TrendingUp,
  Percent,
  Trophy,
  Users,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Banknote,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { localDateISO } from "@/hooks/useObjectifDuJour";
import CrossSellInsights from "@/components/admin/CrossSellInsights";
import KpiFinanceIntel from "@/components/admin/KpiFinanceIntel";
import BusinessSimulator from "@/components/admin/kpi/BusinessSimulator";
import { SalesHeatmap } from "@/components/admin/SalesHeatmap";
import { MOCK_SOLDE_BANCAIRE } from "@/lib/finance-kpi";

type Vente = {
  id: string;
  total: number;
  created_at: string;
  vendeur_id: string;
  methode_paiement?: string | null;
};

type VenteItem = {
  produit_id: string;
  quantite: number;
  vente_id: string;
};

type Produit = {
  id: string;
  nom: string;
};

const ACCENT = "#c9a98c";
const MONTHLY_GOAL_EUR = 15000;

const FRAIS_CB_RATE = 0.015;

const PAYMENT_DONUT = {
  carte: { label: "Carte", fill: "#93c5fd" },
  especes: { label: "Espèces", fill: "#86efac" },
  mixte: { label: "Mixte", fill: "#c4b5fd" },
  paypal: { label: "PayPal", fill: "#d8b4fe" },
  autre: { label: "Autre", fill: "#d4d4d4" },
} as const;

const glassCard =
  "rounded-[1.35rem] border border-white/20 bg-white/55 shadow-[0_8px_40px_-16px_rgba(0,0,0,0.12)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10";

/** Carte blanche douce — alignée sur le fond clair KPI, cohérente avec la heatmap minimaliste */
const heatmapSurfaceCard =
  "rounded-[1.35rem] border border-neutral-200/90 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)] md:p-7";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

const bentoStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
};

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(prix);
}

function formatPercentOneDecimal(n: number): string {
  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

function monthRangeLocal(ref: Date = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function prevMonthRangeLocal(ref: Date = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function dayRangeLocal(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function sumTotals(rows: { total?: number }[]): number {
  return rows.reduce((s, v) => s + (v.total ?? 0), 0);
}

function KpiTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2.5 shadow-2xl ring-1 ring-white/5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight text-white">
        {typeof v === "number" ? formatPrix(v) : "—"}
      </p>
    </div>
  );
}

function PaymentDonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string;
    value?: number;
    payload?: { name?: string; value?: number; pct?: number };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.payload as
    | { name?: string; value?: number; pct?: number }
    | undefined;
  const name = raw?.name ?? payload[0]?.name ?? "";
  const value = raw?.value ?? payload[0]?.value ?? 0;
  const pct = raw?.pct;
  return (
    <div className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/75">
      <p className="text-xs font-semibold tracking-tight text-neutral-900 dark:text-white">
        {name}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-neutral-900 dark:text-white">
        {formatPrix(value)}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        Montant en euros (EUR)
      </p>
      {typeof pct === "number" && !Number.isNaN(pct) && (
        <p className="mt-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
          {formatPercentOneDecimal(pct)} du CA affiché dans le graphique
        </p>
      )}
    </div>
  );
}

function SimulationChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    dataKey?: string;
    value?: number;
    payload?: { total?: number; simulated?: number };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const total = row?.total;
  const sim = row?.simulated;
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-neutral-950/95 px-3 py-2.5 shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        CA jour (réel)
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
        {typeof total === "number" ? formatPrix(total) : "—"}
      </p>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-cyan-400/90">
        Simulé (scénario)
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-cyan-300">
        {typeof sim === "number" ? formatPrix(sim) : "—"}
      </p>
    </div>
  );
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null || Number.isNaN(pct)) {
    return (
      <span className="inline-flex items-center rounded-full bg-neutral-500/10 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
        — vs hier
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${
        up
          ? "bg-emerald-500/15 text-emerald-700"
          : "bg-red-500/12 text-red-700"
      }`}
    >
      {up ? (
        <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
      ) : (
        <ArrowDownRight className="h-3 w-3" strokeWidth={2.5} />
      )}
      {up ? "+" : ""}
      {pct.toFixed(1)}% vs hier
    </span>
  );
}

function ConversionPointsBadge({ pts }: { pts: number | null }) {
  if (pts === null || Number.isNaN(pts)) return null;
  const up = pts >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${
        up
          ? "bg-emerald-500/15 text-emerald-700"
          : "bg-red-500/12 text-red-700"
      }`}
    >
      {up ? (
        <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
      ) : (
        <ArrowDownRight className="h-3 w-3" strokeWidth={2.5} />
      )}
      {up ? "+" : ""}
      {pts.toFixed(1)} pts vs hier
    </span>
  );
}

export default function KPIPage() {
  const [loading, setLoading] = useState(true);
  const [ventesMois, setVentesMois] = useState<Vente[]>([]);
  const [ventesMoisPrec, setVentesMoisPrec] = useState<Vente[]>([]);
  const [ventes30j, setVentes30j] = useState<Vente[]>([]);
  const [ventesItems, setVentesItems] = useState<VenteItem[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [perfVendeuses, setPerfVendeuses] = useState<
    { id: string; nom: string; total: number; count: number }[]
  >([]);
  const [ventesJourRows, setVentesJourRows] = useState<
    { total: number; methode_paiement?: string | null; montant_especes?: number | null }[]
  >([]);

  const [caJour, setCaJour] = useState(0);
  const [nbVentesJour, setNbVentesJour] = useState(0);
  const [caHier, setCaHier] = useState(0);
  const [nbVentesHier, setNbVentesHier] = useState(0);
  const [nombreEntrees, setNombreEntrees] = useState<number | null>(null);
  const [nombreEntreesHier, setNombreEntreesHier] = useState<number | null>(null);
  const [simVarPrix, setSimVarPrix] = useState(0);
  const [simVarTrafic, setSimVarTrafic] = useState(0);
  const [simRecrue, setSimRecrue] = useState(false);
  /** Valeur fictive Espèces (donut KPI uniquement), stable tant que la page n’est pas rechargée. */
  const [montantEspecesPieSimule] = useState(
    () => Math.floor(Math.random() * (200 - 150 + 1)) + 150
  );

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const { start: monthStart, end: monthEnd } = monthRangeLocal(now);
        const { start: prevStart, end: prevEnd } = prevMonthRangeLocal(now);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const rToday = dayRangeLocal(now);
        const rYest = dayRangeLocal(yesterday);
        const jourKey = localDateISO(now);
        const jourHierKey = localDateISO(yesterday);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const from30 = thirtyDaysAgo.toISOString();

        const [
          moisRes,
          moisPrecRes,
          ventes30Res,
          itemsRes,
          produitsRes,
          ventesTodayRes,
          ventesYestRes,
          trafficTodayRes,
          trafficYestRes,
        ] = await Promise.all([
          supabase
            .from("ventes")
            .select("id, total, created_at, vendeur_id, methode_paiement")
            .gte("created_at", monthStart)
            .lte("created_at", monthEnd),
          supabase
            .from("ventes")
            .select("total, created_at")
            .gte("created_at", prevStart)
            .lte("created_at", prevEnd),
          supabase
            .from("ventes")
            .select("total, created_at")
            .gte("created_at", from30),
          supabase.from("ventes_items").select("produit_id, quantite, vente_id"),
          supabase.from("produits").select("id, nom"),
          supabase
            .from("ventes")
            .select("total, methode_paiement, montant_especes")
            .gte("created_at", rToday.start)
            .lte("created_at", rToday.end),
          supabase
            .from("ventes")
            .select("total")
            .gte("created_at", rYest.start)
            .lte("created_at", rYest.end),
          supabase
            .from("daily_traffic")
            .select("nombre_entrees")
            .eq("jour", jourKey)
            .maybeSingle(),
          supabase
            .from("daily_traffic")
            .select("nombre_entrees")
            .eq("jour", jourHierKey)
            .maybeSingle(),
        ]);

        const ventesM = (moisRes.data ?? []) as Vente[];
        setVentesMois(ventesM);
        setVentesMoisPrec((moisPrecRes.data ?? []) as Vente[]);
        setVentes30j((ventes30Res.data ?? []) as Vente[]);

        const vt = (ventesTodayRes.data ?? []) as {
          total: number;
          methode_paiement?: string | null;
          montant_especes?: number | null;
        }[];
        setVentesJourRows(vt);
        const vy = (ventesYestRes.data ?? []) as { total: number }[];
        setNbVentesJour(vt.length);
        setCaJour(sumTotals(vt));
        setNbVentesHier(vy.length);
        setCaHier(sumTotals(vy));

        if (trafficTodayRes.error) setNombreEntrees(null);
        else {
          const ne = (trafficTodayRes.data as { nombre_entrees?: number } | null)
            ?.nombre_entrees;
          setNombreEntrees(
            typeof ne === "number" && !Number.isNaN(ne) ? ne : null
          );
        }
        if (trafficYestRes.error) setNombreEntreesHier(null);
        else {
          const ne = (trafficYestRes.data as { nombre_entrees?: number } | null)
            ?.nombre_entrees;
          setNombreEntreesHier(
            typeof ne === "number" && !Number.isNaN(ne) ? ne : null
          );
        }

        const idsMois = new Set(ventesM.map((v) => v.id));
        const allItems = (itemsRes.data ?? []) as VenteItem[];
        const itemsFiltrés = allItems.filter((i) => idsMois.has(i.vente_id));
        setVentesItems(itemsFiltrés);
        setProduits((produitsRes.data ?? []) as Produit[]);

        const byVendeur: Record<string, { total: number; count: number }> = {};
        ventesM.forEach((v) => {
          const id = v.vendeur_id;
          if (!byVendeur[id]) byVendeur[id] = { total: 0, count: 0 };
          byVendeur[id].total += v.total ?? 0;
          byVendeur[id].count += 1;
        });
        const ids = Object.keys(byVendeur);
        if (ids.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", ids);
          const nameById: Record<string, string> = {};
          (profiles ?? []).forEach((p: { id: string; full_name?: string | null }) => {
            nameById[p.id] =
              typeof p.full_name === "string" && p.full_name.trim()
                ? p.full_name.trim()
                : "Vendeur";
          });
          const rows = ids.map((id) => ({
            id,
            nom: nameById[id] ?? "Vendeur",
            ...byVendeur[id],
          }));
          setPerfVendeuses(rows.sort((a, b) => b.total - a.total));
        } else {
          setPerfVendeuses([]);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [supabase]);

  const caMois = useMemo(
    () => ventesMois.reduce((s, v) => s + (v.total ?? 0), 0),
    [ventesMois]
  );

  /** Liquide attendu en caisse (espèces du jour uniquement). */
  const tiroirCaisseJour = useMemo(
    () =>
      ventesJourRows.reduce((s, v) => {
        if (v.methode_paiement === "especes") return s + (v.total ?? 0);
        if (v.methode_paiement === "mixte") {
          const esp = v.montant_especes;
          return s + (typeof esp === "number" && !Number.isNaN(esp) ? esp : 0);
        }
        return s;
      }, 0),
    [ventesJourRows]
  );

  /** Économie théorique vs frais CB (1,5 %) sur la part espèces du jour. */
  const fraisBancairesEvites = useMemo(
    () => Math.round(tiroirCaisseJour * FRAIS_CB_RATE * 100) / 100,
    [tiroirCaisseJour]
  );

  /** Données donut : carte, mixte, PayPal, autre = réel ; Espèces = montant fictif 150–200 €. */
  const paymentDonutData = useMemo(() => {
    const sums = {
      carte: 0,
      especes: montantEspecesPieSimule,
      mixte: 0,
      paypal: 0,
      autre: 0,
    };
    ventesMois.forEach((v) => {
      const t = v.total ?? 0;
      const m = v.methode_paiement;
      if (m === "especes") return;
      if (m === "carte") sums.carte += t;
      else if (m === "mixte") sums.mixte += t;
      else if (m === "paypal") sums.paypal += t;
      else sums.autre += t;
    });

    const totalPie =
      sums.carte + sums.especes + sums.mixte + sums.paypal + sums.autre;
    const totalPieRounded = Math.round(totalPie * 100) / 100;

    const row = (key: keyof typeof sums) => ({
      name: PAYMENT_DONUT[key].label,
      value: Math.round(sums[key] * 100) / 100,
      fill: PAYMENT_DONUT[key].fill,
      pct:
        totalPieRounded > 0 ? (sums[key] / totalPieRounded) * 100 : 0,
    });
    return (["carte", "especes", "mixte", "paypal", "autre"] as const)
      .map((k) => row(k))
      .filter((d) => d.value > 0);
  }, [ventesMois, montantEspecesPieSimule]);

  const caMoisPrec = useMemo(
    () => ventesMoisPrec.reduce((s, v) => s + (v.total ?? 0), 0),
    [ventesMoisPrec]
  );
  const nbVentesMois = ventesMois.length;
  const panierMoyen =
    nbVentesMois > 0 ? Math.round((caMois / nbVentesMois) * 100) / 100 : 0;

  const croissancePct = useMemo(() => {
    if (caMoisPrec <= 0) return caMois > 0 ? 100 : 0;
    return Math.round(((caMois - caMoisPrec) / caMoisPrec) * 1000) / 10;
  }, [caMois, caMoisPrec]);

  const tauxConversionAffiche =
    nombreEntrees !== null && nombreEntrees > 0
      ? formatPercentOneDecimal((nbVentesJour / nombreEntrees) * 100)
      : "- %";

  const tauxHier =
    nombreEntreesHier !== null &&
    nombreEntreesHier > 0 &&
    nbVentesHier >= 0
      ? (nbVentesHier / nombreEntreesHier) * 100
      : null;
  const tauxJour =
    nombreEntrees !== null && nombreEntrees > 0
      ? (nbVentesJour / nombreEntrees) * 100
      : null;

  const trendConversionPct =
    tauxHier !== null && tauxJour !== null ? tauxJour - tauxHier : null;

  const trendCaPct =
    caHier > 0 ? ((caJour - caHier) / caHier) * 100 : caJour > 0 ? null : null;

  const today = new Date();
  const jourDuMois = today.getDate();
  const joursDansMois = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();
  const caProjeteFinMois =
    jourDuMois > 0 ? (caMois / jourDuMois) * joursDansMois : 0;
  const progressionVersObjectif = Math.min(
    100,
    MONTHLY_GOAL_EUR > 0 ? (caProjeteFinMois / MONTHLY_GOAL_EUR) * 100 : 0
  );

  const trendProjectionPct =
    MONTHLY_GOAL_EUR > 0
      ? ((caProjeteFinMois - MONTHLY_GOAL_EUR) / MONTHLY_GOAL_EUR) * 100
      : null;

  const evolutionCA = useMemo(() => {
    const byDate: Record<string, number> = {};
    const ref = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(ref);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      byDate[key] = 0;
    }
    ventes30j.forEach((v) => {
      const key = v.created_at.split("T")[0];
      if (byDate[key] !== undefined) byDate[key] += v.total ?? 0;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        date: new Date(date).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        }),
        total: Math.round(total * 100) / 100,
      }));
  }, [ventes30j]);

  const simMult = useMemo(
    () => (1 + simVarPrix / 100) * (1 + simVarTrafic / 100),
    [simVarPrix, simVarTrafic]
  );

  const evolutionChartData = useMemo(
    () =>
      evolutionCA.map((r) => ({
        ...r,
        simulated: Math.round(r.total * simMult * 100) / 100,
      })),
    [evolutionCA, simMult]
  );

  const topProduits = useMemo(() => {
    const byProduit: Record<string, number> = {};
    ventesItems.forEach((item) => {
      byProduit[item.produit_id] =
        (byProduit[item.produit_id] ?? 0) + (item.quantite ?? 0);
    });
    const prodMap = Object.fromEntries(produits.map((p) => [p.id, p.nom]));
    return Object.entries(byProduit)
      .map(([id, quantite]) => ({
        nom: prodMap[id] ?? "Produit",
        quantite,
      }))
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 8);
  }, [ventesItems, produits]);

  const maxQ = topProduits[0]?.quantite ?? 1;

  const visiteursAffiche =
    nombreEntrees !== null ? nombreEntrees : "—";

  return (
    <div className="admin-container min-h-dvh bg-gradient-to-br from-slate-50 via-white to-slate-100/90 p-4 md:p-6 lg:p-10">
      <header className="mb-8 lg:mb-10">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500/90" />
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
            Pilotage &amp; performances
          </h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500 md:text-base">
          Centre de pilotage visuel — flux clients, conversion et trajectoire de
          CA.
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />
        </div>
      ) : (
        <motion.div
          className="space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Bento : graphique + pilotage jour (4 blocs en cascade) */}
          <motion.div
            className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:grid-rows-3 lg:gap-5"
            variants={bentoStagger}
            initial="hidden"
            animate="show"
          >
            <motion.section
              variants={itemVariants}
              className={`${glassCard} flex min-h-[400px] flex-col p-5 md:p-7 lg:col-span-8 lg:row-span-3`}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Chiffre d&apos;affaires
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-neutral-900 md:text-xl">
                    Tendance 30 jours
                  </h2>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Courbe pleine = réel · Pointillés néon = scénario simulateur
                  </p>
                </div>
                <TrendBadge pct={trendCaPct} />
              </div>
              <div className="min-h-0 flex-1 w-full min-w-0 pt-2">
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart
                    data={evolutionChartData}
                    margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="kpiAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                        <stop offset="55%" stopColor={ACCENT} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                      <filter
                        id="kpiNeonGlow"
                        x="-40%"
                        y="-40%"
                        width="180%"
                        height="180%"
                      >
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#a3a3a3" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#a3a3a3" }}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${v}`
                      }
                      width={36}
                    />
                    <Tooltip
                      content={<SimulationChartTooltip />}
                      cursor={{
                        stroke: "rgba(0,0,0,0.06)",
                        strokeWidth: 1,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke={ACCENT}
                      strokeWidth={2.25}
                      fill="url(#kpiAreaGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: ACCENT }}
                    />
                    <Line
                      type="monotone"
                      dataKey="simulated"
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      strokeDasharray="6 5"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0, fill: "#22d3ee" }}
                      filter="url(#kpiNeonGlow)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </motion.section>

              <motion.div
                variants={itemVariants}
                className={`${glassCard} group flex flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl md:p-6 lg:col-span-4 lg:row-start-1`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-900/5">
                    <Target className="h-5 w-5 text-neutral-800" strokeWidth={1.75} />
                  </div>
                  <ConversionPointsBadge pts={trendConversionPct} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  Taux de conversion
                </p>
                <p className="mt-2 text-4xl font-light tabular-nums tracking-tighter text-neutral-900 md:text-5xl">
                  {tauxConversionAffiche}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                  Tickets ÷ entrées boutique (jour)
                </p>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className={`${glassCard} group flex flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl md:p-6 lg:col-span-4 lg:row-start-2`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-900/5">
                  <Users className="h-5 w-5 text-neutral-800" strokeWidth={1.75} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  Visiteurs (entrées)
                </p>
                <p className="mt-2 text-4xl font-light tabular-nums tracking-tighter text-neutral-900 md:text-5xl">
                  {visiteursAffiche}
                </p>
                <p className="mt-2 text-xs text-neutral-500">Flux comptabilisé aujourd&apos;hui</p>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className={`${glassCard} group flex flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl md:p-6 lg:col-span-4 lg:row-start-3`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-900/5">
                    <TrendingUp className="h-5 w-5 text-neutral-800" strokeWidth={1.75} />
                  </div>
                  {trendProjectionPct !== null && (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        caProjeteFinMois >= MONTHLY_GOAL_EUR
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-amber-500/12 text-amber-800"
                      }`}
                    >
                      {caProjeteFinMois >= MONTHLY_GOAL_EUR ? "Au-dessus" : "Sous"} objectif
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  Atterrissage estimé (mois)
                </p>
                <p className="mt-2 text-3xl font-light tabular-nums tracking-tighter text-neutral-900 md:text-4xl">
                  {formatPrix(caProjeteFinMois)}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  CA cumulé mois : {formatPrix(caMois)} · Objectif {formatPrix(MONTHLY_GOAL_EUR)}
                </p>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                    <span>vs objectif</span>
                    <span className="tabular-nums text-neutral-600">
                      {Math.round(progressionVersObjectif)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200/80">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-neutral-800 to-[#c9a98c]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressionVersObjectif}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.div>
          </motion.div>

          {/* Encaissements : tiroir espèces (jour) + répartition mensuelle */}
          <motion.div variants={itemVariants} className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Moyens de paiement
              </p>
              <p className="mt-0.5 text-sm text-neutral-500">
                Liquide du soir · mix du mois en cours
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`${glassCard} relative overflow-hidden p-5 md:p-7`}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/15 blur-2xl"
                  aria-hidden
                />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 ring-1 ring-emerald-500/20">
                    <Banknote
                      className="h-6 w-6 text-emerald-700"
                      strokeWidth={1.75}
                    />
                  </div>
                  <span className="text-2xl" aria-hidden>
                    💵
                  </span>
                </div>
                <p className="relative mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                  Tiroir-caisse · espèces (aujourd&apos;hui)
                </p>
                <p className="relative mt-2 text-4xl font-light tabular-nums tracking-tighter text-neutral-900 md:text-5xl">
                  {formatPrix(tiroirCaisseJour)}
                </p>
                <p className="relative mt-3 text-sm leading-relaxed text-neutral-600">
                  Montant en liquide à contrôler en fin de journée (ventes
                  &quot;espèces&quot; uniquement).
                </p>
                <div className="relative mt-5 rounded-2xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-500/10">
                  <span className="font-semibold">Frais bancaires économisés : </span>
                  <span className="tabular-nums font-bold">
                    +{formatPrix(fraisBancairesEvites)}
                  </span>
                  <span className="ml-1 text-xs font-normal text-emerald-800/80">
                    (équivalent 1,5 % CB sur cette part espèces)
                  </span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`${glassCard} flex flex-col p-5 md:p-7`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      KPI — moyens de paiement
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight text-neutral-900">
                      Répartition du CA (Mois en cours)
                    </h3>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10">
                    <PieChartIcon className="h-5 w-5 text-violet-700" strokeWidth={1.75} />
                  </div>
                </div>

                {paymentDonutData.length === 0 ? (
                  <p className="flex flex-1 items-center justify-center py-16 text-center text-sm text-neutral-500">
                    Aucune vente ce mois-ci avec méthode renseignée.
                  </p>
                ) : (
                  <>
                    <div className="relative mx-auto mt-2 h-[260px] w-full max-w-[320px]">
                      <motion.div
                        className="h-full w-full"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.65,
                          delay: 0.1,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                            <Pie
                              data={paymentDonutData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={74}
                              outerRadius={108}
                              paddingAngle={2.5}
                              cornerRadius={7}
                              stroke="rgba(255,255,255,0.85)"
                              strokeWidth={2}
                              animationBegin={80}
                              animationDuration={900}
                              animationEasing="ease-out"
                            >
                              {paymentDonutData.map((entry, i) => (
                                <Cell
                                  key={`${entry.name}-${i}`}
                                  fill={entry.fill}
                                  className="outline-none transition-opacity hover:opacity-90"
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              content={<PaymentDonutTooltip />}
                              cursor={false}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </motion.div>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
                        <span className="text-3xl font-light tabular-nums tracking-tight text-neutral-900 md:text-4xl">
                          {nbVentesMois}
                        </span>
                        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                          transactions
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-neutral-100/80 pt-4">
                      {paymentDonutData.map((d) => (
                        <span
                          key={d.name}
                          className="inline-flex items-center gap-2 text-[11px] font-medium text-neutral-600"
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ring-1 ring-black/5"
                            style={{ backgroundColor: d.fill }}
                          />
                          <span>{d.name}</span>
                          <span className="tabular-nums text-neutral-900">
                            {formatPercentOneDecimal(d.pct)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="w-full">
            <BusinessSimulator
              varPrix={simVarPrix}
              varTrafic={simVarTrafic}
              recrue={simRecrue}
              onVarPrixChange={setSimVarPrix}
              onVarTraficChange={setSimVarTrafic}
              onRecrueChange={setSimRecrue}
              onReset={() => {
                setSimVarPrix(0);
                setSimVarTrafic(0);
                setSimRecrue(false);
              }}
              caProjeteFinMois={caProjeteFinMois}
              soldeBancaire={MOCK_SOLDE_BANCAIRE}
            />
          </motion.div>

          <motion.div variants={itemVariants} className="w-full">
            <div className={heatmapSurfaceCard}>
              <SalesHeatmap />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Trésorerie &amp; fiscalité
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-neutral-900 md:text-xl">
                Intelligence financière
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-500">
                Runway, TVA estimée et budget réassort à partir du CA du mois et
                du solde bancaire (mock jusqu&apos;à Open Banking).
              </p>
            </div>
            <KpiFinanceIntel caMois={caMois} />
          </motion.div>

          {/* KPI mois — grille secondaire */}
          <motion.section
            variants={itemVariants}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-5"
          >
            {(
              [
                {
                  icon: Euro,
                  label: "CA mensuel",
                  value: formatPrix(caMois),
                  sub: "Mois en cours",
                  valueClass: "text-neutral-900",
                },
                {
                  icon: Percent,
                  label: "Panier moyen",
                  value: formatPrix(panierMoyen),
                  sub: "Sur le mois",
                  valueClass: "text-neutral-900",
                },
                {
                  icon: ShoppingBag,
                  label: "Total ventes",
                  value: String(nbVentesMois),
                  sub: "Mois en cours",
                  valueClass: "text-neutral-900",
                },
                {
                  icon: TrendingUp,
                  label: "Croissance CA",
                  value: `${croissancePct >= 0 ? "+" : ""}${croissancePct}%`,
                  sub: "vs mois précédent",
                  valueClass:
                    croissancePct >= 0 ? "text-emerald-600" : "text-red-600",
                },
              ] as const
            ).map((k) => (
              <motion.div
                key={k.label}
                variants={itemVariants}
                className={`${glassCard} group flex flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:p-6`}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-900/5">
                  <k.icon className="h-5 w-5 text-neutral-700" strokeWidth={1.5} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-400">
                  {k.label}
                </p>
                <p
                  className={`mt-2 text-2xl font-light tabular-nums tracking-tighter md:text-3xl ${k.valueClass}`}
                >
                  {k.value}
                </p>
                <p className="mt-2 text-xs text-neutral-500">{k.sub}</p>
              </motion.div>
            ))}
          </motion.section>

          <motion.div variants={itemVariants}>
            <CrossSellInsights />
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6 lg:gap-8">
            <motion.section
              variants={itemVariants}
              className={`${glassCard} overflow-hidden`}
            >
              <div className="border-b border-neutral-200/60 px-5 py-4 md:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
                    <Trophy className="h-4 w-4 text-amber-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-neutral-900">
                      Top produits
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Quantités vendues — mois en cours
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6">
                {topProduits.length === 0 ? (
                  <p className="py-8 text-center text-sm text-neutral-500">
                    Aucune donnée sur la période.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {topProduits.map((p, i) => (
                      <li key={p.nom + i}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium text-neutral-900">
                            <span className="mr-2 tabular-nums text-neutral-400">
                              {i + 1}.
                            </span>
                            {p.nom}
                          </span>
                          <span className="shrink-0 tabular-nums text-neutral-600">
                            {p.quantite} u.
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-neutral-200/80">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-neutral-800 to-[#c9a98c]"
                            style={{
                              width: `${Math.max(8, (p.quantite / maxQ) * 100)}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.section>

            <motion.section
              variants={itemVariants}
              className={`${glassCard} overflow-hidden`}
            >
              <div className="border-b border-neutral-200/60 px-5 py-4 md:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
                    <Users className="h-4 w-4 text-indigo-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-neutral-900">
                      Performances vendeuses
                    </h2>
                    <p className="text-xs text-neutral-500">
                      CA généré — mois en cours
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6">
                {perfVendeuses.length === 0 ? (
                  <p className="py-8 text-center text-sm text-neutral-500">
                    Aucune vente ce mois-ci.
                  </p>
                ) : (
                  <ul className="divide-y divide-neutral-100/80">
                    {perfVendeuses.map((v, i) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900/5 text-xs font-semibold text-neutral-600">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-900">
                              {v.nom}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {v.count} vente{v.count > 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums tracking-tight text-neutral-900">
                          {formatPrix(v.total)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.section>
          </div>
        </motion.div>
      )}
    </div>
  );
}
