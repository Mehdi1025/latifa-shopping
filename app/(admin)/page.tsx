"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Euro,
  ShoppingBag,
  Calendar,
  Receipt,
  Percent,
  Target,
  TrendingUp,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useNotifications } from "@/contexts/NotificationsContext";
import { playNotificationSound } from "@/lib/notification-sound";
import { useAlerts } from "@/hooks/useAlerts";
import { localDateISO } from "@/hooks/useObjectifDuJour";
import ActionCenter from "@/components/ActionCenter";

/** Objectif CA mensuel affiché (projection vs cible). */
const MONTHLY_GOAL_EUR = 15000;

type Vente = {
  id: string;
  vendeur_id: string;
  total: number;
  created_at: string;
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

function monthRangeLocalISO(ref: Date = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatPercentOneDecimal(n: number): string {
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
  const [loading, setLoading] = useState(true);
  const [nombreEntrees, setNombreEntrees] = useState<number | null>(null);
  const [caMois, setCaMois] = useState(0);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { triggerNewSale } = useNotifications();
  const { alerts, loading: alertsLoading, refetch: refetchAlerts } = useAlerts({
    includeTasks: true,
    includeAdminIntelligence: true,
  });

  const panierMoyenJour =
    nbVentesJour > 0 ? Math.round((caJour / nbVentesJour) * 100) / 100 : 0;

  const tauxConversionAffiche =
    nombreEntrees !== null && nombreEntrees > 0
      ? formatPercentOneDecimal((nbVentesJour / nombreEntrees) * 100)
      : "- %";

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const fromDay = startOfTodayISO();

        const jourKey = localDateISO();
        const { start: monthStart, end: monthEnd } = monthRangeLocalISO();

        const [jourRes, lastVentesRes, trafficRes, moisRes] = await Promise.all([
          supabase
            .from("ventes")
            .select("total, created_at")
            .gte("created_at", fromDay),
          supabase
            .from("ventes")
            .select("id, vendeur_id, total, created_at")
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

        if (trafficRes.error) {
          setNombreEntrees(null);
        } else {
          const ne = (trafficRes.data as { nombre_entrees?: number } | null)
            ?.nombre_entrees;
          setNombreEntrees(
            typeof ne === "number" && !Number.isNaN(ne) ? ne : null
          );
        }

        if (moisRes.error) {
          setCaMois(0);
        } else {
          const ventesMois = (moisRes.data ?? []) as { total: number }[];
          setCaMois(
            ventesMois.reduce((acc, v) => acc + (v.total ?? 0), 0)
          );
        }

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
            setCaMois((prev) => prev + montant);
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

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
            <div className="stat-card group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] md:p-6">
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
                <Target className="h-5 w-5 text-gray-600 transition-colors duration-300 group-hover:text-white" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Taux de conversion
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 tabular-nums md:text-3xl">
                {tauxConversionAffiche}
              </p>
              <p className="mt-2 text-[11px] leading-snug text-gray-400">
                Ventes du jour / entrées boutique
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

          <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] md:p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                    <TrendingUp className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Atterrissage estimé (mois)
                    </p>
                    <p className="text-sm text-gray-500">
                      Projection linéaire · CA mois : {formatPrix(caMois)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900 tabular-nums md:text-4xl">
                  {formatPrix(caProjeteFinMois)}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Objectif mensuel : {formatPrix(MONTHLY_GOAL_EUR)}
                </p>
              </div>
              <div className="w-full min-w-[200px] max-w-md flex-1 md:pt-2">
                <div className="mb-1.5 flex justify-between text-xs text-gray-500">
                  <span>Progression vs objectif (estim.)</span>
                  <span className="tabular-nums">
                    {progressionVersObjectif.toLocaleString("fr-FR", {
                      maximumFractionDigits: 0,
                    })}
                    %
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
                  role="progressbar"
                  aria-valuenow={Math.round(progressionVersObjectif)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-[#c9a98c] transition-[width] duration-500 ease-out"
                    style={{
                      width: `${progressionVersObjectif}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dernières ventes — liste épurée */}
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
                    <div className="flex shrink-0 items-center gap-3">
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
