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
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOut },
  },
};

const bentoVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.12 },
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
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl bg-white/[0.03] py-16">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        <span className="text-sm text-neutral-500">Synchronisation…</span>
      </div>
    );
  }
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" strokeWidth={1.75} />
        </div>
        <p className="max-w-xs text-sm font-medium leading-relaxed text-neutral-700">
          Aucune alerte active — la boutique respire.
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <li key={alert.id}>
          <Link
            href={alert.href}
            className={`group relative flex items-start gap-4 overflow-hidden rounded-2xl px-4 py-4 transition-all duration-300 hover:shadow-lg ${
              alert.severity === "danger"
                ? "border border-red-200/60 bg-gradient-to-br from-red-50/90 to-white shadow-[0_0_0_1px_rgba(239,68,68,0.08)] hover:border-red-300/80"
                : "border border-amber-200/50 bg-gradient-to-br from-amber-50/80 to-white shadow-[0_0_0_1px_rgba(245,158,11,0.06)] hover:border-amber-300/70"
            }`}
          >
            <span
              className={`absolute left-0 top-1/2 h-12 w-1 -translate-y-1/2 rounded-full ${
                alert.severity === "danger" ? "bg-red-500" : "bg-amber-500"
              } animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]`}
              aria-hidden
            />
            <span
              className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                alert.severity === "danger"
                  ? "bg-red-500/15 text-red-600"
                  : "bg-amber-500/15 text-amber-700"
              }`}
            >
              {alert.severity === "danger" ? (
                <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Info className="h-5 w-5" strokeWidth={1.75} />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold leading-snug text-neutral-900">
                {alert.message}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition group-hover:gap-2">
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
    gradient: "from-indigo-500/15 to-violet-500/10",
    iconClass: "text-indigo-600 group-hover:text-indigo-700",
  },
  {
    href: "/organisation",
    label: "Tâches & projet",
    icon: ListTodo,
    gradient: "from-emerald-500/15 to-teal-500/10",
    iconClass: "text-emerald-600 group-hover:text-emerald-700",
  },
  {
    href: "/organisation",
    label: "Calendrier éditorial",
    icon: CalendarDays,
    gradient: "from-rose-500/12 to-orange-500/10",
    iconClass: "text-rose-600 group-hover:text-rose-700",
  },
  {
    href: "/import",
    label: "Import CSV",
    icon: FileUp,
    gradient: "from-slate-500/12 to-slate-600/10",
    iconClass: "text-slate-700 group-hover:text-slate-900",
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
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/[0.35] p-4 md:p-6 lg:p-10 dark:from-neutral-950 dark:via-neutral-950 dark:to-indigo-950/30">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.09),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.15),transparent)]"
        aria-hidden
      />

      <motion.div
        className="relative mx-auto max-w-6xl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Morning Brief */}
        <motion.header variants={itemVariants} className="mb-10 md:mb-12">
          <p className="text-[13px] font-medium tracking-wide text-neutral-400 dark:text-neutral-500">
            {dateLongue}
          </p>
          <h1 className="mt-3 max-w-4xl font-serif text-[1.65rem] font-light leading-[1.2] tracking-tight text-neutral-900 dark:text-white sm:text-3xl md:text-[2.15rem]">
            Bonjour Latifa, voici l&apos;état de la boutique aujourd&apos;hui.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            Morning brief — chiffres clés, alertes et accès rapides. Le détail
            analytique vit sur{" "}
            <Link href="/kpi" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
              KPI
            </Link>
            .
          </p>
        </motion.header>

        {/* Flash metrics */}
        <motion.section
          variants={itemVariants}
          className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
        >
          {loading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-3xl bg-white/60 shadow-[0_4px_32px_-12px_rgba(0,0,0,0.08)] dark:bg-white/5"
                />
              ))}
            </>
          ) : (
            <>
              <div className="group flex flex-col rounded-3xl bg-white/90 px-5 py-6 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.03] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_12px_40px_-16px_rgba(99,102,241,0.18)] dark:bg-white/[0.06] dark:ring-white/10">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    CA jour
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 transition-transform duration-300 group-hover:scale-105 dark:bg-indigo-400/15 dark:text-indigo-300">
                    <Euro className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="text-3xl font-light tabular-nums tracking-tight text-neutral-900 dark:text-white">
                  {formatPrix(caJour)}
                </p>
                {progressionObjectif !== null && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>Objectif journalier</span>
                      <span className="tabular-nums font-medium text-neutral-700 dark:text-neutral-300">
                        {Math.round(progressionObjectif)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressionObjectif}%` }}
                        transition={{ duration: 0.9, ease: easeOut }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
                      Cible : {formatPrix(objectifCAJour ?? 0)}
                    </p>
                  </div>
                )}
                {progressionObjectif === null && (
                  <p className="mt-3 text-[12px] text-neutral-400 dark:text-neutral-500">
                    Définissez l&apos;objectif du jour dans{" "}
                    <Link href="/objectifs" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      Objectifs
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div className="group flex flex-col rounded-3xl bg-white/90 px-5 py-6 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.03] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_12px_40px_-16px_rgba(14,165,233,0.15)] dark:bg-white/[0.06] dark:ring-white/10">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Passages
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 transition-transform duration-300 group-hover:scale-105 dark:text-sky-400">
                    <Users className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="text-3xl font-light tabular-nums tracking-tight text-neutral-900 dark:text-white">
                  {nombreEntrees !== null ? nombreEntrees : "—"}
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Saisis en caisse vendeuse — flux quotidien.
                </p>
              </div>

              <div className="group flex flex-col rounded-3xl bg-white/90 px-5 py-6 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.03] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_12px_40px_-16px_rgba(245,158,11,0.18)] dark:bg-white/[0.06] dark:ring-white/10">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Tâches prioritaires
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 transition-transform duration-300 group-hover:scale-105 dark:text-amber-400">
                    <Kanban className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="text-3xl font-light tabular-nums tracking-tight text-neutral-900 dark:text-white">
                  {tachesUrgentes !== null ? tachesUrgentes : "—"}
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Non terminées, échéance aujourd&apos;hui ou en retard.
                </p>
              </div>

              <div className="group flex flex-col rounded-3xl bg-white/90 px-5 py-6 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.03] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_12px_40px_-16px_rgba(16,185,129,0.15)] dark:bg-white/[0.06] dark:ring-white/10">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    Ventes (jour)
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 transition-transform duration-300 group-hover:scale-105 dark:text-emerald-400">
                    <Sparkles className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="text-3xl font-light tabular-nums tracking-tight text-neutral-900 dark:text-white">
                  {nbVentesJour}
                </p>
                <p className="mt-3 text-[12px] text-neutral-500 dark:text-neutral-400">
                  Tickets enregistrés aujourd&apos;hui.
                </p>
              </div>
            </>
          )}
        </motion.section>

        {/* Bento */}
        <motion.section
          variants={bentoVariants}
          initial="hidden"
          animate="show"
          className="mb-10 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6"
        >
          <motion.div
            variants={itemVariants}
            className="lg:col-span-7"
          >
            <div className="rounded-[1.75rem] border border-white/60 bg-white/70 p-6 shadow-[0_8px_40px_-24px_rgba(0,0,0,0.15)] ring-1 ring-black/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:ring-white/5 md:p-8">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-40" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
                      Action Center
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Alertes live — stock, flux, conversion, objectifs
                    </p>
                  </div>
                </div>
                {!alertsLoading && alerts.length > 0 && (
                  <span className="rounded-full bg-neutral-900/5 px-3 py-1 text-xs font-bold tabular-nums text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                    {alerts.length}
                  </span>
                )}
              </div>
              <AlertsFeed alerts={alerts} loading={alertsLoading} />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="lg:col-span-5">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              Accès rapides
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {QUICK_ACTIONS.map((action, i) => (
                <motion.div
                  key={action.href + action.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.45, ease: easeOut }}
                >
                  <Link
                    href={action.href}
                    className={`group flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border border-white/50 bg-gradient-to-br ${action.gradient} p-4 text-center shadow-[0_4px_24px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:ring-white/5`}
                  >
                    <action.icon
                      className={`h-11 w-11 transition-colors duration-300 ${action.iconClass}`}
                      strokeWidth={1.35}
                    />
                    <span className="text-[13px] font-semibold leading-tight text-neutral-800 dark:text-neutral-100">
                      {action.label}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.section>

        {/* Trésorerie + dernieres ventes compact */}
        <motion.div variants={itemVariants} className="space-y-8">
          <BankWidget className="min-h-[180px]" />

          <div className="overflow-hidden rounded-[1.5rem] border border-white/50 bg-white/80 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.03] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between border-b border-neutral-100/80 px-5 py-4 dark:border-white/10 md:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900/5 dark:bg-white/10">
                  <Receipt className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Dernières ventes
                  </h2>
                  <p className="text-xs text-neutral-500">Activité récente</p>
                </div>
              </div>
              <Link
                href="/kpi"
                className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Analyse →
              </Link>
            </div>
            {loading ? (
              <p className="px-6 py-12 text-center text-sm text-neutral-400">
                Chargement…
              </p>
            ) : dernieresVentes.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-neutral-400">
                Aucune vente récente.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100/80 dark:divide-white/5">
                {dernieresVentes.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-neutral-50/80 dark:hover:bg-white/[0.03] md:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                        {vendeurMap[v.vendeur_id] ?? "Vendeur"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="md:hidden">{formatHeure(v.created_at)}</span>
                        <span className="hidden md:inline">
                          {formatDate(v.created_at)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <MethodePaiementBadge methode={v.methode_paiement} />
                      <p className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-white">
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
