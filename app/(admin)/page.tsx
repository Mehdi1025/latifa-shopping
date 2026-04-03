"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Euro,
  Calendar,
  Receipt,
  Users,
  BarChart3,
  CalendarDays,
  FileUp,
  Kanban,
  ListTodo,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { useNotifications } from "@/contexts/NotificationsContext";
import { playNotificationSound } from "@/lib/notification-sound";
import { useAlerts, type AlertItem } from "@/hooks/useAlerts";
import BankWidget from "@/components/admin/BankWidget";
import { MethodePaiementBadge } from "@/components/MethodePaiement";
import { localDateISO, pickMontantObjectif } from "@/hooks/useObjectifDuJour";

type Vente = {
  id: string;
  vendeur_id: string;
  total: number;
  created_at: string;
  methode_paiement?: string | null;
};

type VendeurMap = Record<string, string>;

/** Carte type Stripe / Apple Analytics — blanc, bordure cheveu, ombre très douce */
const card =
  "rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(0,0,0,0.05)]";

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

function endOfTodayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
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

function capitalizeFr(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const easeOut = [0.25, 0.46, 0.45, 0.94] as [number, number, number, number];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: easeOut },
  },
};

const bentoVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

function AlertsFeed({
  alerts,
  loading,
}: {
  alerts: AlertItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 py-16">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">Synchronisation…</span>
      </div>
    );
  }
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white px-6 py-14 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-100 bg-white">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" strokeWidth={1.75} />
        </div>
        <p className="max-w-xs text-sm font-medium leading-relaxed text-slate-600">
          Aucune alerte active — la boutique respire.
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {alerts.map((alert) => (
        <li key={alert.id}>
          <Link
            href={alert.href}
            className={`group flex items-start gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.04)] ${
              alert.severity === "danger"
                ? "border-l-[3px] border-l-red-500 border-t border-r border-b border-slate-100"
                : "border-l-[3px] border-l-amber-400 border-t border-r border-b border-slate-100"
            }`}
          >
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 ${
                alert.severity === "danger" ? "text-red-600" : "text-amber-600"
              }`}
            >
              {alert.severity === "danger" ? (
                <AlertTriangle className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Info className="h-4 w-4" strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium leading-snug text-slate-900">
                {alert.message}
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition group-hover:gap-1.5">
                {alert.actionLabel}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const QUICK_ACTIONS = [
  {
    href: "/kpi",
    label: "Voir les KPI",
    icon: BarChart3,
    iconClass: "text-blue-600",
  },
  {
    href: "/organisation",
    label: "Tâches & projet",
    icon: ListTodo,
    iconClass: "text-emerald-600",
  },
  {
    href: "/organisation",
    label: "Calendrier éditorial",
    icon: CalendarDays,
    iconClass: "text-rose-600",
  },
  {
    href: "/import",
    label: "Import CSV",
    icon: FileUp,
    iconClass: "text-slate-700",
  },
] as const;

export default function Home() {
  const [caJour, setCaJour] = useState<number>(0);
  const [nbVentesJour, setNbVentesJour] = useState<number>(0);
  const [dernieresVentes, setDernieresVentes] = useState<Vente[]>([]);
  const [vendeurMap, setVendeurMap] = useState<VendeurMap>({});
  const [nombreEntrees, setNombreEntrees] = useState<number | null>(null);
  const [objectifCAJour, setObjectifCAJour] = useState<number | null>(null);
  const [tachesUrgentes, setTachesUrgentes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { triggerNewSale } = useNotifications();
  const { alerts, loading: alertsLoading, refetch: refetchAlerts } = useAlerts({
    includeTasks: true,
    includeAdminIntelligence: true,
  });

  const dateLongue = useMemo(() => {
    const d = new Date();
    return capitalizeFr(
      d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );
  }, []);

  const progressionObjectif =
    objectifCAJour != null &&
    objectifCAJour > 0 &&
    Number.isFinite(objectifCAJour)
      ? Math.min(100, (caJour / objectifCAJour) * 100)
      : null;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const fromDay = startOfTodayISO();
        const jourKey = localDateISO();
        const endToday = endOfTodayISO();

        const [
          jourRes,
          lastVentesRes,
          trafficRes,
          objectifRes,
          tachesRes,
        ] = await Promise.all([
          supabase
            .from("ventes")
            .select("total, created_at")
            .gte("created_at", fromDay),
          supabase
            .from("ventes")
            .select("id, vendeur_id, total, created_at, methode_paiement")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("daily_traffic")
            .select("nombre_entrees")
            .eq("jour", jourKey)
            .maybeSingle(),
          supabase
            .from("objectifs_journaliers")
            .select("*")
            .eq("jour", jourKey)
            .maybeSingle(),
          supabase
            .from("taches")
            .select("id", { count: "exact", head: true })
            .not("statut", "eq", "termine")
            .not("deadline", "is", null)
            .lte("deadline", endToday),
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

        const row = objectifRes.data as Record<string, unknown> | null;
        const mont = row ? pickMontantObjectif(row) : null;
        setObjectifCAJour(mont != null && mont > 0 ? mont : null);

        const tc = tachesRes.count;
        setTachesUrgentes(
          typeof tc === "number" && !Number.isNaN(tc) ? tc : null
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
          setDernieresVentes((prev) => [newVente, ...prev.slice(0, 7)]);
          void refetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, triggerNewSale, refetchAlerts]);

  return (
    <div className="min-h-dvh bg-slate-50 p-4 md:p-6 lg:p-10">
      <motion.div
        className="relative mx-auto max-w-6xl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.header variants={itemVariants} className="mb-10 md:mb-12">
          <p className="text-[13px] font-medium tracking-wide text-slate-500">
            {dateLongue}
          </p>
          <h1 className="mt-3 max-w-4xl font-serif text-[1.65rem] font-light leading-[1.2] tracking-tight text-slate-900 sm:text-3xl md:text-[2.1rem]">
            Bonjour Latifa, voici l&apos;état de la boutique aujourd&apos;hui.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-500">
            Morning brief — chiffres clés, alertes et accès rapides. Le détail
            analytique sur{" "}
            <Link
              href="/kpi"
              className="font-medium text-blue-600 underline-offset-2 hover:underline"
            >
              KPI
            </Link>
            .
          </p>
        </motion.header>

        <motion.section
          variants={itemVariants}
          className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
        >
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-2xl border border-slate-100 bg-slate-100/60"
                />
              ))}
            </>
          ) : (
            <>
              <div className={`group flex flex-col px-5 py-6 ${card}`}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    CA jour
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-blue-600 transition-transform duration-200 group-hover:scale-[1.02]">
                    <Euro className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="text-3xl font-light tabular-nums tracking-tight text-emerald-600">
                  {formatPrix(caJour)}
                </p>
                {progressionObjectif !== null && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[11px] text-slate-500">
                      <span>Objectif journalier</span>
                      <span className="tabular-nums font-medium text-slate-700">
                        {Math.round(progressionObjectif)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className="h-full rounded-full bg-blue-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressionObjectif}%` }}
                        transition={{ duration: 0.85, ease: easeOut }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Cible : {formatPrix(objectifCAJour ?? 0)}
                    </p>
                  </div>
                )}
                {progressionObjectif === null && (
                  <p className="mt-3 text-[12px] text-slate-500">
                    Définissez l&apos;objectif du jour dans{" "}
                    <Link
                      href="/objectifs"
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Objectifs
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div className={`group flex flex-col px-5 py-6 ${card}`}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Passages
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-blue-600 transition-transform duration-200 group-hover:scale-[1.02]">
                    <Users className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="text-3xl font-light tabular-nums tracking-tight text-slate-900">
                  {nombreEntrees !== null ? nombreEntrees : "—"}
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                  Saisis en caisse vendeuse — flux quotidien.
                </p>
              </div>

              <div className={`group flex flex-col px-5 py-6 ${card}`}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Tâches prioritaires
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-amber-600 transition-transform duration-200 group-hover:scale-[1.02]">
                    <Kanban className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="text-3xl font-light tabular-nums tracking-tight text-slate-900">
                  {tachesUrgentes !== null ? tachesUrgentes : "—"}
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                  Non terminées, échéance aujourd&apos;hui ou en retard.
                </p>
              </div>

              <div className={`group flex flex-col px-5 py-6 ${card}`}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Ventes (jour)
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-emerald-600 transition-transform duration-200 group-hover:scale-[1.02]">
                    <Sparkles className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="text-3xl font-light tabular-nums tracking-tight text-slate-900">
                  {nbVentesJour}
                </p>
                <p className="mt-3 text-[12px] text-slate-500">
                  Tickets enregistrés aujourd&apos;hui.
                </p>
              </div>
            </>
          )}
        </motion.section>

        <motion.section
          variants={bentoVariants}
          initial="hidden"
          animate="show"
          className="mb-10 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6"
        >
          <motion.div variants={itemVariants} className="lg:col-span-7">
            <div className={`p-6 md:p-8 ${card}`}>
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-30" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-slate-900">
                      Action Center
                    </h2>
                    <p className="text-xs text-slate-500">
                      Stock, flux, conversion, objectifs
                    </p>
                  </div>
                </div>
                {!alertsLoading && alerts.length > 0 && (
                  <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                    {alerts.length}
                  </span>
                )}
              </div>
              <AlertsFeed alerts={alerts} loading={alertsLoading} />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="lg:col-span-5">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Accès rapides
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
              {QUICK_ACTIONS.map((action, i) => (
                <motion.div
                  key={action.href + action.label}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.05, duration: 0.42, ease: easeOut }}
                >
                  <Link
                    href={action.href}
                    className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]"
                  >
                    <action.icon
                      className={`h-10 w-10 ${action.iconClass} transition-transform duration-200 group-hover:scale-105`}
                      strokeWidth={1.35}
                    />
                    <span className="text-[13px] font-semibold leading-tight text-slate-900">
                      {action.label}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.section>

        <motion.div variants={itemVariants} className="space-y-8">
          <BankWidget className="min-h-[180px]" />

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
                  <Receipt className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Dernières ventes
                  </h2>
                  <p className="text-xs text-slate-500">Activité récente</p>
                </div>
              </div>
              <Link
                href="/kpi"
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Analyse →
              </Link>
            </div>
            {loading ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">
                Chargement…
              </p>
            ) : dernieresVentes.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">
                Aucune vente récente.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {dernieresVentes.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/80 md:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {vendeurMap[v.vendeur_id] ?? "Vendeur"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="md:hidden">{formatHeure(v.created_at)}</span>
                        <span className="hidden md:inline">
                          {formatDate(v.created_at)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <MethodePaiementBadge methode={v.methode_paiement} />
                      <p className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatPrix(v.total)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
