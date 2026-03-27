"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Euro,
  ShoppingBag,
  TrendingUp,
  Percent,
  Trophy,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import CrossSellInsights from "@/components/admin/CrossSellInsights";

type Vente = {
  id: string;
  total: number;
  created_at: string;
  vendeur_id: string;
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

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(prix);
}

/** Mois civil local (France) pour cohérence avec « mois en cours ». */
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

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const { start: monthStart, end: monthEnd } = monthRangeLocal(now);
        const { start: prevStart, end: prevEnd } = prevMonthRangeLocal(now);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const from30 = thirtyDaysAgo.toISOString();

        const [
          moisRes,
          moisPrecRes,
          ventes30Res,
          itemsRes,
          produitsRes,
        ] = await Promise.all([
          supabase
            .from("ventes")
            .select("id, total, created_at, vendeur_id")
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
        ]);

        const ventesM = (moisRes.data ?? []) as Vente[];
        setVentesMois(ventesM);
        setVentesMoisPrec((moisPrecRes.data ?? []) as Vente[]);
        setVentes30j((ventes30Res.data ?? []) as Vente[]);

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

  const evolutionCA = useMemo(() => {
    const byDate: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
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

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-6 lg:p-10">
      <header className="mb-8 lg:mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 lg:text-3xl">
          Analyses &amp; Performances
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Indicateurs mensuels, tendances et classements
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        </div>
      ) : (
        <>
          {/* Section 1 — 4 KPIs globaux */}
          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <Euro className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                CA mensuel
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                {formatPrix(caMois)}
              </p>
              <p className="mt-2 text-xs text-gray-400">Mois en cours</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <Percent className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Panier moyen
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                {formatPrix(panierMoyen)}
              </p>
              <p className="mt-2 text-xs text-gray-400">Sur le mois</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <ShoppingBag className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Total ventes
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                {nbVentesMois}
              </p>
              <p className="mt-2 text-xs text-gray-400">Mois en cours</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Croissance CA
              </p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  croissancePct >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {croissancePct >= 0 ? "+" : ""}
                {croissancePct}%
              </p>
              <p className="mt-2 text-xs text-gray-400">vs mois précédent</p>
            </div>
          </section>

          <CrossSellInsights />

          {/* Section 2 — Graphique CA pleine largeur */}
          <section className="mb-8 overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                <TrendingUp className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Évolution du chiffre d&apos;affaires
                </h2>
                <p className="text-sm text-gray-400">30 derniers jours</p>
              </div>
            </div>
            <div className="h-[320px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={evolutionCA}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="kpiCaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f3f4f6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${v / 1000}k€` : `${v}€`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #f3f4f6",
                      borderRadius: "12px",
                      boxShadow: "0 4px 20px -8px rgba(0,0,0,0.15)",
                    }}
                    formatter={(value) => [
                      typeof value === "number" ? formatPrix(value) : "—",
                      "CA",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={ACCENT}
                    strokeWidth={2}
                    fill="url(#kpiCaGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Section 3 — deux colonnes */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4 md:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                    <Trophy className="h-4 w-4 text-amber-700" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Top produits
                    </h2>
                    <p className="text-xs text-gray-400">
                      Quantités vendues — mois en cours
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6">
                {topProduits.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">
                    Aucune donnée sur la période.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {topProduits.map((p, i) => (
                      <li key={p.nom + i}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium text-gray-900">
                            <span className="mr-2 tabular-nums text-gray-400">
                              {i + 1}.
                            </span>
                            {p.nom}
                          </span>
                          <span className="shrink-0 tabular-nums text-gray-600">
                            {p.quantite} u.
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-[#c9a98c] transition-all"
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
            </section>

            <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4 md:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
                    <Users className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Performances vendeuses
                    </h2>
                    <p className="text-xs text-gray-400">
                      CA généré — mois en cours
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-6">
                {perfVendeuses.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">
                    Aucune vente ce mois-ci.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {perfVendeuses.map((v, i) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">
                              {v.nom}
                            </p>
                            <p className="text-xs text-gray-400">
                              {v.count} vente{v.count > 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                          {formatPrix(v.total)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
