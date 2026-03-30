"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Euro, ShoppingBag, Calendar, Receipt, Percent } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useNotifications } from "@/contexts/NotificationsContext";
import { playNotificationSound } from "@/lib/notification-sound";
import { useAlerts } from "@/hooks/useAlerts";
import ActionCenter from "@/components/ActionCenter";

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

export default function Home() {
  const [caJour, setCaJour] = useState<number>(0);
  const [nbVentesJour, setNbVentesJour] = useState<number>(0);
  const [dernieresVentes, setDernieresVentes] = useState<Vente[]>([]);
  const [vendeurMap, setVendeurMap] = useState<VendeurMap>({});
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { triggerNewSale } = useNotifications();
  const { alerts, loading: alertsLoading, refetch: refetchAlerts } = useAlerts({
    includeTasks: true,
    includeAdminIntelligence: true,
  });

  const panierMoyenJour =
    nbVentesJour > 0 ? Math.round((caJour / nbVentesJour) * 100) / 100 : 0;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const fromDay = startOfTodayISO();

        const [jourRes, lastVentesRes] = await Promise.all([
          supabase
            .from("ventes")
            .select("total, created_at")
            .gte("created_at", fromDay),
          supabase
            .from("ventes")
            .select("id, vendeur_id, total, created_at")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const ventesJour = (jourRes.data ?? []) as { total: number }[];
        const ca = ventesJour.reduce((acc, v) => acc + (v.total ?? 0), 0);
        setCaJour(ca);
        setNbVentesJour(ventesJour.length);
        setDernieresVentes((lastVentesRes.data as Vente[]) ?? []);

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

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
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
