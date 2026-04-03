"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Euro,
  ShoppingBag,
  Calendar,
  Receipt,
  Percent,
  Kanban,
  ChevronRight,
  Users,
  TrendingUp,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useNotifications } from "@/contexts/NotificationsContext";
import { playNotificationSound } from "@/lib/notification-sound";
import { useAlerts } from "@/hooks/useAlerts";
import ActionCenter from "@/components/ActionCenter";
import BankWidget from "@/components/admin/BankWidget";
import { MethodePaiementBadge } from "@/components/MethodePaiement";
import { localDateISO } from "@/hooks/useObjectifDuJour";

type Vente = {
  id: string;
  vendeur_id: string;
  total: number;
  created_at: string;
  methode_paiement?: string | null;
};

type VendeurMap = Record<string, string>;

function formatPrix(prix: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
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

function formatHeure(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isSameLocalDay(iso: string, ref: Date = new Date()): boolean {
  const a = new Date(iso);
  return (
    a.getFullYear() === ref.getFullYear() &&
    a.getMonth() === ref.getMonth() &&
    a.getDate() === ref.getDate()
  );
}

function monthRangeLocal(ref: Date = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatPercent0(n: number): string {
  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

export default function Home() {
  const [caJour, setCaJour] = useState<number>(0);
  const [nbVentesJour, setNbVentesJour] = useState<number>(0);
  const [dernieresVentes, setDernieresVentes] = useState<Vente[]>([]);
  const [vendeurMap, setVendeurMap] = useState<VendeurMap>({});
  const [nombreEntrees, setNombreEntrees] = useState<number | null>(null);
  const [caMois, setCaMois] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { triggerNewSale } = useNotifications();
  const { alerts, loading: alertsLoading, refetch: refetchAlerts } = useAlerts({
    includeTasks: true,
    includeAdminIntelligence: true,
  });

  const panierMoyenJour =
    nbVentesJour > 0 ? Math.round((caJour / nbVentesJour) * 100) / 100 : 0;

  const tauxConversionJour =
    nombreEntrees !== null && nombreEntrees > 0
      ? (nbVentesJour / nombreEntrees) * 100
      : null;

  const today = new Date();
  const jourDuMois = today.getDate();
  const joursDansMois = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();
  const projectionFinMois =
    jourDuMois > 0 ? (caMois / jourDuMois) * joursDansMois : 0;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const fromDay = startOfTodayISO();
        const { start: monthStart, end: monthEnd } = monthRangeLocal();
        const jourKey = localDateISO();

        const [jourRes, lastVentesRes, trafficRes, moisRes] = await Promise.all([
          supabase
            .from("ventes")
            .select("total, created_at")
            .gte("created_at", fromDay),
          supabase
            .from("ventes")
            .select("id, vendeur_id, total, created_at, methode_paiement")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("daily_traffic")
            .select("nombre_entrees")
            .eq("jour", jourKey)
            .maybeSingle(),
          supabase
            .from("ventes")
            .select("total")
            .gte("created_at", monthStart)
            .lte("created_at", monthEnd),
        ]);

        const ventesJour = (jourRes.data ?? []) as { total: number }[];
        const ca = ventesJour.reduce((acc, v) => acc + (v.total ?? 0), 0);
        setCaJour(ca);
        setNbVentesJour(ventesJour.length);
        setDernieresVentes((lastVentesRes.data as Vente[]) ?? []);

        const ne = (trafficRes.data as { nombre_entrees?: number } | null)
          ?.nombre_entrees;
        setNombreEntrees(
          typeof ne === "number" && !Number.isNaN(ne) ? ne : null
        );

        const ventesMoisRows = (moisRes.data ?? []) as { total?: number }[];
        setCaMois(
          ventesMoisRows.reduce((s, v) => s + (v.total ?? 0), 0)
        );

        const vendeurIds = [
          ...new Set(
            ((lastVentesRes.data ?? []) as Vente[])
              .map((v) => v.vendeur_id)
              .filter(Boolean)
          ),
        ];
        if (vendeurIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", vendeurIds);
          const map: VendeurMap = {};
          (profiles ?? []).forEach((p: { id: string; full_name?: string | null }) => {
            const name = p.full_name;
            map[p.id] =
              typeof name === "string" && name.trim() ? name.trim() : "Vendeur";
          });
          setVendeurMap(map);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("ventes-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ventes" },
        (payload) => {
          const newVente = payload.new as Vente;
          const montant = newVente.total ?? 0;
          triggerNewSale(montant);
          playNotificationSound();
          toast("💰 Nouvelle Vente !", {
            description: `${montant.toFixed(2)}€`,
            duration: 5000,
          });
          if (isSameLocalDay(newVente.created_at)) {
            setCaJour((prev) => prev + montant);
            setNbVentesJour((prev) => prev + 1);
          }
          setDernieresVentes((prev) => [newVente, ...prev.slice(0, 9)]);
          void refetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, triggerNewSale, refetchAlerts]);

  return (
    <div className="admin-container min-h-dvh bg-gray-50/50 p-4 md:p-6 lg:p-10">
      <header className="mb-8 flex flex-col gap-6 lg:mb-10 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
            Vue d&apos;ensemble - Aujourd&apos;hui
          </h1>
          <p className="mt-1 text-sm text-gray-400 md:text-base">
            Activité du jour et dernières transactions
          </p>
        </div>
        <ActionCenter
          alerts={alerts}
          loading={alertsLoading}
          variant="full"
          className="w-full shrink-0 lg:max-w-md xl:max-w-lg"
        />
      </header>

      <Link
        href="/organisation"
        className="group mb-6 flex items-center gap-4 rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-white to-indigo-50/40 p-4 shadow-[0_2px_12px_-4px_rgba(79,70,229,0.12)] transition-all hover:border-indigo-200 hover:shadow-[0_8px_24px_-12px_rgba(79,70,229,0.2)] md:mb-8 md:p-5"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25 transition-transform group-hover:scale-[1.02]">
          <Kanban className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
            Raccourci
          </p>
          <p className="mt-0.5 font-semibold text-gray-900">Organisation</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Kanban des tâches et calendrier éditorial
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-indigo-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" />
      </Link>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6">
        <div className="flex min-h-[200px] flex-col">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
              <p className="mt-3 text-xs text-gray-400">Chargement du CA…</p>
            </div>
          ) : (
            <div className="stat-card group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 transition-colors duration-300 group-hover:bg-[#c9a98c]">
                <Euro className="h-5 w-5 text-gray-600 transition-colors duration-300 group-hover:text-white" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                CA jour
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 tabular-nums md:text-3xl">
                {formatPrix(caJour)}
              </p>
            </div>
          )}
        </div>
        <BankWidget className="min-h-[200px] lg:min-h-0" />
      </div>

      {loading ? null : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
            <div className="stat-card group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 transition-colors duration-300 group-hover:bg-[#c9a98c]">
                <ShoppingBag className="h-5 w-5 text-gray-600 transition-colors duration-300 group-hover:text-white" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Ventes jour
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 tabular-nums md:text-3xl">
                {nbVentesJour}
              </p>
            </div>

            <div className="stat-card group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 transition-colors duration-300 group-hover:bg-[#c9a98c]">
                <Percent className="h-5 w-5 text-gray-600 transition-colors duration-300 group-hover:text-white" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Panier moyen (jour)
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 tabular-nums md:text-3xl">
                {formatPrix(panierMoyenJour)}
              </p>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
            <div className="stat-card group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 transition-colors duration-300 group-hover:bg-indigo-100">
                <Percent className="h-5 w-5 text-indigo-700" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Taux de conversion (jour)
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 tabular-nums md:text-3xl">
                {tauxConversionJour !== null
                  ? formatPercent0(tauxConversionJour)
                  : "—"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                Ventes du jour ÷ passages boutique. Les vendeuses saisissent le flux
                chaque soir dans{" "}
                <Link href="/vendeuse" className="font-medium text-indigo-600 hover:underline">
                  Flux boutique
                </Link>
                .
              </p>
            </div>

            <div className="stat-card group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 transition-colors duration-300 group-hover:bg-sky-100">
                <Users className="h-5 w-5 text-sky-800" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Passages (aujourd&apos;hui)
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 tabular-nums md:text-3xl">
                {nombreEntrees !== null ? nombreEntrees : "—"}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Compteur aligné sur la journée — même base que le pilotage KPI.
              </p>
            </div>

            <div className="stat-card group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] sm:col-span-2 lg:col-span-1 md:p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 transition-colors duration-300 group-hover:bg-amber-100">
                <TrendingUp className="h-5 w-5 text-amber-800" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Projection CA fin de mois
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 tabular-nums md:text-3xl">
                {formatPrix(projectionFinMois)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                Extrapolation : (CA mois ÷ jour du mois) × jours du mois. Scénarios
                détaillés sur{" "}
                <Link href="/kpi" className="font-medium text-indigo-600 hover:underline">
                  KPI
                </Link>
                .
              </p>
            </div>
          </div>

          <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
            <div className="border-b border-gray-100 px-5 py-4 md:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                  <Receipt className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    Dernières ventes
                  </h2>
                  <p className="text-xs text-gray-400">
                    Les 10 transactions les plus récentes
                  </p>
                </div>
              </div>
            </div>

            {dernieresVentes.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-gray-400 md:px-6">
                Aucune vente enregistrée.
              </p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {dernieresVentes.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/80 md:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {vendeurMap[v.vendeur_id] ?? "Vendeur"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="md:hidden">{formatHeure(v.created_at)}</span>
                        <span className="hidden md:inline">
                          {formatDate(v.created_at)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <MethodePaiementBadge methode={v.methode_paiement} />
                      <p className="text-sm font-semibold tabular-nums text-gray-900">
                        {formatPrix(v.total)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
