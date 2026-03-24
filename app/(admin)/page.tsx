"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Euro,
  ShoppingBag,
  AlertTriangle,
  Calendar,
  User,
  Receipt,
  TrendingUp,
  Trophy,
  AlertCircle,
  Clock,
  ChevronRight,
  ArrowUpRight,
  Medal,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useNotifications } from "@/contexts/NotificationsContext";
import { playNotificationSound } from "@/lib/notification-sound";

type Vente = {
  id: string;
  vendeur_id: string;
  total: number;
  created_at: string;
};

type VenteItem = {
  produit_id: string;
  quantite: number;
};

type Produit = {
  id: string;
  nom: string;
  stock?: number;
};

type Tache = {
  id: string;
  titre: string;
  statut: string;
  deadline: string | null;
};

type VendeurMap = Record<string, string>;

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(prix);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const ACCENT = "#c9a98c"; // Doré Latifa Shopping
const CHART_COLORS = [ACCENT, "#374151", "#4b5563", "#6b7280", "#9ca3af"];

function getTodayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function getMonthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function getYesterdayStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

export default function Home() {
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [alertesStock, setAlertesStock] = useState<number>(0);
  const [vendeurMap, setVendeurMap] = useState<VendeurMap>({});
  const [ventesItems, setVentesItems] = useState<VenteItem[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [produitsRupture, setProduitsRupture] = useState<Produit[]>([]);
  const [taches, setTaches] = useState<Tache[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowserClient();
  const { triggerNewSale } = useNotifications();

  const kpis = useMemo(() => {
    const todayStart = getTodayStart();
    const monthStart = getMonthStart();
    const yesterdayStart = getYesterdayStart();
    let caJour = 0;
    let caMois = 0;
    let caTotal = 0;
    let caHier = 0;
    let nbVentesJour = 0;
    ventes.forEach((v) => {
      const t = v.total ?? 0;
      const date = v.created_at?.split("T")[0] ?? "";
      caTotal += t;
      if (date >= monthStart) caMois += t;
      if (date === todayStart) {
        caJour += t;
        nbVentesJour += 1;
      }
      if (date === yesterdayStart) caHier += t;
    });
    const panierMoyen = nbVentesJour > 0 ? caJour / nbVentesJour : 0;
    const evolutionPct =
      caHier > 0 && caJour > caHier
        ? Math.round(((caJour - caHier) / caHier) * 100)
        : null;
    return { caJour, caMois, caTotal, nbVentesJour, panierMoyen, evolutionPct };
  }, [ventes]);

  const dernieresVentes = useMemo(
    () => [...ventes].sort((a, b) => (b.created_at > a.created_at ? 1 : -1)).slice(0, 10),
    [ventes]
  );

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, []);

  const allVentesForChart = useMemo(
    () => ventes.filter((v) => (v.created_at?.split("T")[0] ?? "") >= thirtyDaysAgo),
    [ventes, thirtyDaysAgo]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          ventesRes,
          alertesRes,
          itemsRes,
          produitsRes,
          ruptureRes,
          tachesRes,
        ] = await Promise.all([
          supabase
            .from("ventes")
            .select("id, vendeur_id, total, created_at")
            .order("created_at", { ascending: false }),
          supabase.from("produits").select("id").lt("stock", 5),
          supabase.from("ventes_items").select("produit_id, quantite"),
          supabase.from("produits").select("id, nom, stock"),
          supabase.from("produits").select("id, nom").eq("stock", 0),
          supabase
            .from("taches")
            .select("id, titre, statut, deadline")
            .neq("statut", "Terminé"),
        ]);

        setVentes((ventesRes.data as Vente[]) ?? []);
        setAlertesStock(alertesRes.data?.length ?? 0);
        setVentesItems((itemsRes.data ?? []) as VenteItem[]);
        setProduits((produitsRes.data ?? []) as Produit[]);
        setProduitsRupture((ruptureRes.data ?? []) as Produit[]);
        const allTaches = (tachesRes.data ?? []) as Tache[];
        const now = new Date().toISOString();
        setTaches(allTaches.filter((t) => t.deadline && t.deadline < now));

        const vendeurIds = [
          ...new Set(
            ((ventesRes.data ?? []) as Vente[])
              .map((v) => v.vendeur_id)
              .filter(Boolean)
          ),
        ];
        if (vendeurIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", vendeurIds);
          const map: VendeurMap = {};
          (profiles ?? []).forEach(
            (p: { id: string; full_name?: string | null; email?: string | null }) => {
              const name = p.full_name?.trim() || p.email?.trim();
              map[p.id] = name || "Vendeur";
            }
          );
          setVendeurMap(map);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("ventes-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ventes" },
        async (payload) => {
          const newVente = payload.new as Vente;
          const montant = newVente.total ?? 0;
          triggerNewSale(montant);
          playNotificationSound();
          toast("💰 Nouvelle Vente !", {
            description: formatPrix(montant),
            duration: 5000,
          });
          setVentes((prev) => [newVente, ...prev]);
          setVendeurMap((prev) => {
            if (newVente.vendeur_id && !prev[newVente.vendeur_id]) {
              return { ...prev, [newVente.vendeur_id]: "Vendeur" };
            }
            return prev;
          });
          setTimeout(async () => {
            const { data: items } = await supabase
              .from("ventes_items")
              .select("produit_id, quantite")
              .eq("vente_id", newVente.id);
            if (items?.length) {
              setVentesItems((prev) => [...(items as VenteItem[]), ...prev]);
            }
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, triggerNewSale]);

  const evolutionCA = useMemo(() => {
    const byDate: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      byDate[key] = 0;
    }
    allVentesForChart.forEach((v) => {
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
  }, [allVentesForChart]);

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
      .slice(0, 3);
  }, [ventesItems, produits]);

  const topVendeuses = useMemo(() => {
    const byVendeur: Record<string, number> = {};
    ventes.forEach((v) => {
      if (v.vendeur_id) {
        byVendeur[v.vendeur_id] =
          (byVendeur[v.vendeur_id] ?? 0) + (v.total ?? 0);
      }
    });
    return Object.entries(byVendeur)
      .map(([id, ca]) => ({ id, ca, nom: vendeurMap[id] ?? "Vendeur" }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5);
  }, [ventes, vendeurMap]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 lg:p-10">
      <header className="mb-12">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 lg:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Vue d&apos;ensemble de votre activité Latifa Shop
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        </div>
      ) : (
        <>
          {/* Compteur de Vitesse : CA du Mois (priorité) */}
          <div className="mb-8">
            <div className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-10 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] lg:p-12">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 transition-colors duration-300 group-hover:bg-[#c9a98c]">
                  <Euro className="h-7 w-7 text-gray-600 transition-colors duration-300 group-hover:text-white" />
                </div>
                {kpis.evolutionPct != null && (
                  <span className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-600">
                    <ArrowUpRight className="h-4 w-4" />
                    +{kpis.evolutionPct}%
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-400">CA du mois</p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 tabular-nums lg:text-5xl">
                {formatPrix(kpis.caMois)}
              </p>
            </div>
          </div>

          {/* Cartes KPI */}
          <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 transition-colors duration-300 group-hover:bg-[#c9a98c]">
                <Euro className="h-6 w-6 text-gray-600 transition-colors duration-300 group-hover:text-white" />
              </div>
              <p className="text-sm font-medium text-gray-400">CA du jour</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 tabular-nums lg:text-3xl">
                {formatPrix(kpis.caJour)}
              </p>
            </div>

            <div className="group rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 transition-colors duration-300 group-hover:bg-[#c9a98c]">
                <Euro className="h-6 w-6 text-gray-600 transition-colors duration-300 group-hover:text-white" />
              </div>
              <p className="text-sm font-medium text-gray-400">CA total</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 tabular-nums lg:text-3xl">
                {formatPrix(kpis.caTotal)}
              </p>
            </div>

            <div className="group rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 transition-colors duration-300 group-hover:bg-[#c9a98c]">
                <ShoppingBag className="h-6 w-6 text-gray-600 transition-colors duration-300 group-hover:text-white" />
              </div>
              <p className="text-sm font-medium text-gray-400">Ventes du jour</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 tabular-nums lg:text-3xl">
                {kpis.nbVentesJour}
              </p>
            </div>

            <div className="group rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 transition-colors duration-300 group-hover:bg-[#c9a98c]">
                <Receipt className="h-6 w-6 text-gray-600 transition-colors duration-300 group-hover:text-white" />
              </div>
              <p className="text-sm font-medium text-gray-400">Panier moyen</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 tabular-nums lg:text-3xl">
                {formatPrix(kpis.panierMoyen)}
              </p>
            </div>

            <div
              className={`group rounded-3xl border p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] ${
                alertesStock > 0
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-gray-100 bg-white"
              }`}
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-300 ${
                  alertesStock > 0
                    ? "bg-amber-100 group-hover:bg-amber-600"
                    : "bg-gray-100 group-hover:bg-gray-900"
                }`}
              >
                <AlertTriangle
                  className={`h-6 w-6 transition-colors duration-300 ${
                    alertesStock > 0
                      ? "text-amber-600 group-hover:text-white"
                      : "text-gray-600 group-hover:text-white"
                  }`}
                />
              </div>
              <p className="text-sm font-medium text-gray-400">Alertes stock</p>
              <p
                className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${
                  alertesStock > 0 ? "text-amber-700" : "text-gray-900"
                }`}
              >
                {alertesStock}
              </p>
              {alertesStock > 0 && (
                <p className="mt-1 text-xs text-amber-600/80">
                  Produits avec stock &lt; 5
                </p>
              )}
            </div>
          </div>

          {/* Alertes Prioritaires */}
          {(produitsRupture.length > 0 || taches.length > 0) && (
            <div className="mb-12 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Alertes Prioritaires
              </h2>
              <div className="flex flex-col gap-3">
                {produitsRupture.map((p) => (
                  <div
                    key={`rupture-${p.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50/80 px-5 py-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-xl bg-red-100">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      </div>
                      <span className="font-medium text-red-800">
                        🚨 RUPTURE : {p.nom}
                      </span>
                    </div>
                    <Link
                      href="/produits"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                    >
                      Gérer
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
                {taches.map((t) => (
                  <div
                    key={`retard-${t.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-xl bg-amber-100">
                        <Clock className="h-5 w-5 text-amber-600" />
                      </div>
                      <span className="font-medium text-amber-800">
                        ⏳ RETARD : {t.titre}
                      </span>
                    </div>
                    <Link
                      href="/taches"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
                    >
                      Gérer
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Graphiques */}
          <div className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Évolution du CA */}
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] lg:col-span-2">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <TrendingUp className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Évolution du Chiffre d&apos;Affaires
                  </h2>
                  <p className="text-sm text-gray-400">
                    Derniers 30 jours
                  </p>
                </div>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={evolutionCA}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="caGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={ACCENT}
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor={ACCENT}
                          stopOpacity={0}
                        />
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
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k€` : `${v}€`)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #f3f4f6",
                        borderRadius: "12px",
                        boxShadow: "0 4px 20px -8px rgba(0,0,0,0.15)",
                      }}
                      labelStyle={{ color: "#6b7280", fontWeight: 600 }}
                      formatter={(value) => [
                        typeof value === "number" ? formatPrix(value) : "—",
                        "CA",
                      ]}
                      labelFormatter={(label) => label}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke={ACCENT}
                      strokeWidth={2}
                      fill="url(#caGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top 3 Produits */}
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <Trophy className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Poule aux œufs d&apos;or
                  </h2>
                  <p className="text-sm text-gray-400">Top 3 produits</p>
                </div>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProduits}
                    layout="vertical"
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="nom"
                      width={90}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #f3f4f6",
                        borderRadius: "12px",
                        boxShadow: "0 4px 20px -8px rgba(0,0,0,0.15)",
                      }}
                      formatter={(value) => [
                        `${value ?? 0} unités`,
                        "Vendu",
                      ]}
                    />
                    <Bar
                      dataKey="quantite"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={28}
                    >
                      {topProduits.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Vendeuses */}
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  <Medal className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Meilleures vendeuses
                  </h2>
                  <p className="text-sm text-gray-400">Classement par CA</p>
                </div>
              </div>
              {topVendeuses.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Aucune vente.</p>
              ) : (
                <div className="space-y-3">
                  {topVendeuses.map((v, i) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50/80 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                            i === 0
                              ? "bg-amber-100 text-amber-700"
                              : i === 1
                                ? "bg-gray-200 text-gray-600"
                                : i === 2
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="font-medium text-gray-900">{v.nom}</span>
                      </div>
                      <span className="font-bold tabular-nums text-gray-900">
                        {formatPrix(v.ca)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tableau des dernières ventes */}
          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                <Receipt className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Dernières ventes
                </h2>
                <p className="text-sm text-gray-400">
                  Les 10 transactions les plus récentes
                </p>
              </div>
            </div>

            {dernieresVentes.length === 0 ? (
              <p className="py-12 text-center text-gray-400">
                Aucune vente enregistrée.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-100">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Date / Heure
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Vendeur
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Montant
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dernieresVentes.map((v) => (
                      <tr
                        key={v.id}
                        className="border-b border-gray-50 transition-colors hover:bg-gray-50/30 last:border-b-0"
                      >
                        <td className="flex items-center gap-2 px-6 py-4 text-sm text-gray-700">
                          <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                          {formatDate(v.created_at)}
                        </td>
                        <td className="flex items-center gap-2 px-6 py-4 text-sm text-gray-700">
                          <User className="h-4 w-4 shrink-0 text-gray-400" />
                          {vendeurMap[v.vendeur_id] ?? "Vendeur"}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900 tabular-nums">
                          {formatPrix(v.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
