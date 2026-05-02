"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  Sunrise,
  Moon,
  Hourglass,
  Wallet,
  MonitorPlay,
} from "lucide-react";
import type { eventWithTime } from "@rrweb/types";
import type { SessionCaisse } from "@/components/caisse/CaisseSessionProvider";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  isMeaningfulRrwebReplay,
  MIN_RRWEB_REPLAY_SPAN_MS,
} from "@/lib/rrwebReplay";
import {
  generateStorePulseDemoEntries,
  mapLogActiviteToPulseEntry,
  type StorePulseWaveEntry,
} from "@/lib/storePulse";
import { StorePulseWave } from "@/components/store/StorePulseWave";
import { ShadowMirrorBoard } from "@/components/admin/ShadowMirrorBoard";
import type { ShadowLogRow } from "@/lib/shadowStore";
import { computeShadowStoreMetrics } from "@/lib/shadowStore";
import { toast } from "sonner";

export type LogActivite = {
  id: string;
  created_at: string;
  vendeur_nom: string | null;
  type_action: string;
  details: string | null;
  niveau_alerte: string;
  valeur_perdue?: number | string | null;
  shadow_manifest?: unknown | null;
};

const RrwebSessionPlayerLazy = dynamic(
  () =>
    import("@/components/admin/RrwebSessionPlayer").then((m) => ({
      default: m.RrwebSessionPlayer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[280px] items-center justify-center gap-2 rounded-xl border border-slate-800/40 bg-black/70 text-slate-300">
        <Loader2 className="h-6 w-6 shrink-0 animate-spin text-indigo-400" />
        <span className="text-sm font-medium">Chargement du lecteur VAR…</span>
      </div>
    ),
  }
);

type FiltreRapide = "tous" | "suspects" | "jour";

type OngletHistorique = "sessions" | "journal" | "replay";

type LogReplayListeRow = LogActivite;

const ITEMS_PER_PAGE = 10;
const REPLAY_ITEMS_PER_PAGE = 8;

/** Seuil retard d’ouverture (exclusivement après 09:30 locale). */
const OUVERTURE_MAX_MINUTES = 9 * 60 + 30;

function formatHeureFr(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}h${m}`;
}

/** ex. « lundi 14 mai 2026 » puis capitaliser le lendemain de phrase si besoin */
function formatDateJourFrancais(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const raw = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function minutesDepuisMinuitLocale(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function isOuvertureTard(d: Date): boolean {
  return minutesDepuisMinuitLocale(d) > OUVERTURE_MAX_MINUTES;
}

function formatEcartSigneEUR(n: number): {
  text: string;
  positive: boolean;
  zeroish: boolean;
} {
  const zeroish = Math.abs(n) < 0.005;
  const positive = n >= 0;
  const fmt = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return {
    text: `${positive ? "+" : "-"} ${fmt}`,
    positive,
    zeroish,
  };
}

function formatDureeDepuisOuverture(ouvert: Date, fermeOuNow: Date): string {
  const ms = Math.max(0, fermeOuNow.getTime() - ouvert.getTime());
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
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

function niveauNormalized(n: string): "info" | "warning" | "critique" {
  const x = n.toLowerCase().trim();
  if (x === "warning") return "warning";
  if (x === "critique") return "critique";
  return "info";
}

/** Numéros de page cliquables avec ellipses si le total est grand */
function pageItems(totalPages: number, currentPage: number): (number | "ellipsis")[] {
  if (totalPages <= 0) return [];
  const p = Math.min(Math.max(1, currentPage), totalPages);

  const addMiddle = (): number[] => {
    let start = Math.max(2, p - 2);
    let end = Math.min(totalPages - 1, p + 2);
    if (p <= 3) end = Math.min(totalPages - 1, Math.max(end, 4));
    if (p >= totalPages - 2) start = Math.max(2, totalPages - 4);
    if (totalPages <= 3) return [];
    const nums: number[] = [];
    for (let x = start; x <= end; x++) nums.push(x);
    return nums;
  };

  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const middle = addMiddle();
  const out: (number | "ellipsis")[] = [1];
  if ((middle[0] ?? Infinity) > 2) out.push("ellipsis");
  for (const n of middle) out.push(n);
  if ((middle[middle.length - 1] ?? 0) < totalPages - 1) out.push("ellipsis");
  if (totalPages > 1) out.push(totalPages);
  return out;
}

function ShiftSessionCard({ session }: { session: SessionCaisse }) {
  const dtOuverture = new Date(session.heure_ouverture);
  const enCours =
    session.statut === "ouverte" ||
    session.heure_fermeture == null ||
    session.heure_fermeture === "";
  const dtFermeture = !enCours && session.heure_fermeture
    ? new Date(session.heure_fermeture)
    : null;
  const finPourDuree = dtFermeture ?? new Date();
  const retard = isOuvertureTard(dtOuverture);

  let ecartFormat: ReturnType<typeof formatEcartSigneEUR> | null = null;
  if (
    typeof session.ecart === "number" &&
    Number.isFinite(session.ecart) &&
    !enCours
  ) {
    ecartFormat = formatEcartSigneEUR(session.ecart);
  }

  return (
    <article className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-200/60 ring-1 ring-black/[0.03] transition-shadow hover:shadow-md hover:shadow-slate-300/45">
      <header className="border-b border-slate-50 px-5 py-4">
        <p className="text-[13px] font-semibold leading-snug text-slate-800">
          {formatDateJourFrancais(dtOuverture)}
        </p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Session caisse · {session.id.slice(0, 8)}…
        </p>
      </header>

      <div className="space-y-4 px-5 py-4">
        <div className="flex gap-3">
          <Sunrise className="mt-0.5 h-5 w-5 shrink-0 text-amber-500/90" strokeWidth={1.85} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Ouverture
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <time
                dateTime={session.heure_ouverture}
                className={`text-lg font-semibold tabular-nums tracking-tight ${
                  retard ? "text-red-600" : "text-slate-900"
                }`}
              >
                {formatHeureFr(dtOuverture)}
              </time>
              {retard && (
                <span className="inline-flex rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-red-200/80">
                  Retard
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Moon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500/90" strokeWidth={1.85} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Clôture
            </p>
            {enCours ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700 shadow-sm ring-2 ring-emerald-200/70 animate-pulse">
                En cours…
              </span>
            ) : dtFermeture ? (
              <time
                dateTime={session.heure_fermeture ?? undefined}
                className="mt-1 block text-lg font-semibold tabular-nums text-slate-900"
              >
                {formatHeureFr(dtFermeture)}
              </time>
            ) : (
              <span className="mt-1 text-sm text-slate-400">—</span>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-auto grid gap-3 border-t border-slate-50 bg-slate-50/40 px-5 py-4">
        <div className="flex items-start gap-2.5">
          <Hourglass className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Temps de travail {enCours ? "(pour l’instant)" : ""}
            </p>
            <p className="mt-0.5 font-semibold tabular-nums text-slate-800">
              {formatDureeDepuisOuverture(dtOuverture, finPourDuree)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Wallet className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Bilan de caisse · écart espèces
            </p>
            {ecartFormat ? (
              <p
                className={`mt-0.5 text-[15px] font-bold tabular-nums tracking-tight ${
                  ecartFormat.zeroish || ecartFormat.positive
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {ecartFormat.text}
              </p>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-slate-400">
                À la clôture
              </p>
            )}
          </div>
        </div>
      </footer>
    </article>
  );
}

export default function HistoriqueLogsPage() {
  const [ongletActif, setOngletActif] = useState<OngletHistorique>("journal");

  const [sessions, setSessions] = useState<SessionCaisse[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogActivite[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<FiltreRapide>("tous");
  const [currentPage, setCurrentPage] = useState(1);

  const [replayLogs, setReplayLogs] = useState<LogReplayListeRow[]>([]);
  const [replayTotalCount, setReplayTotalCount] = useState(0);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayCurrentPage, setReplayCurrentPage] = useState(1);
  const [selectedReplayRow, setSelectedReplayRow] = useState<LogReplayListeRow | null>(
    null
  );
  const [replayDetailLoading, setReplayDetailLoading] = useState(false);
  const [replayEvents, setReplayEvents] = useState<eventWithTime[] | null>(null);

  const [shadowStoreMode, setShadowStoreMode] = useState(false);
  const [shadowLogsRaw, setShadowLogsRaw] = useState<ShadowLogRow[]>([]);
  const [shadowLoading, setShadowLoading] = useState(false);
  const [shadowError, setShadowError] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtre]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const { data, error: err } = await supabase
        .from("sessions_caisse")
        .select("*")
        .order("heure_ouverture", { ascending: false })
        .limit(7);

      if (err) {
        setSessions([]);
        setSessionsError(err.message ?? "Impossible de charger les sessions.");
        return;
      }
      setSessions((data ?? []) as SessionCaisse[]);
    } catch (e) {
      setSessions([]);
      setSessionsError(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setSessionsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let q = supabase
        .from("logs_activite")
        .select(
          "id, created_at, vendeur_nom, type_action, details, niveau_alerte",
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (filtre === "suspects") {
        q = q.or("niveau_alerte.eq.warning,niveau_alerte.eq.critique");
      } else if (filtre === "jour") {
        q = q
          .gte("created_at", startOfTodayISO())
          .lte("created_at", endOfTodayISO());
      }

      const { data, error: err, count } = await q.range(from, to);

      if (err) {
        setLogsError(err.message ?? "Impossible de charger les logs.");
        setLogs([]);
        setTotalCount(0);
        return;
      }
      setLogs((data ?? []) as LogActivite[]);
      setTotalCount(count ?? 0);
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : "Erreur inattendue.");
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLogsLoading(false);
    }
  }, [supabase, currentPage, filtre]);

  useEffect(() => {
    if (ongletActif !== "journal") return;
    void loadLogs();
  }, [ongletActif, loadLogs]);

  const loadReplayList = useCallback(async () => {
    setReplayLoading(true);
    setReplayError(null);
    try {
      const from = (replayCurrentPage - 1) * REPLAY_ITEMS_PER_PAGE;
      const to = from + REPLAY_ITEMS_PER_PAGE - 1;

      const { data, error: err, count } = await supabase
        .from("logs_activite")
        .select(
          "id, created_at, vendeur_nom, type_action, details, niveau_alerte",
          { count: "exact" }
        )
        .not("enregistrement_ecran", "is", null)
        .gte("replay_span_ms", MIN_RRWEB_REPLAY_SPAN_MS)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (err) {
        setReplayLogs([]);
        setReplayTotalCount(0);
        setReplayError(err.message ?? "Impossible de charger les replays.");
        return;
      }
      setReplayLogs((data ?? []) as LogReplayListeRow[]);
      setReplayTotalCount(count ?? 0);
    } catch (e) {
      setReplayError(e instanceof Error ? e.message : "Erreur inattendue.");
      setReplayLogs([]);
      setReplayTotalCount(0);
    } finally {
      setReplayLoading(false);
    }
  }, [supabase, replayCurrentPage]);

  useEffect(() => {
    if (ongletActif !== "replay") return;
    void loadReplayList();
  }, [ongletActif, loadReplayList]);

  useEffect(() => {
    if (!selectedReplayRow) {
      setReplayEvents(null);
      return;
    }
    let cancelled = false;
    setReplayDetailLoading(true);
    setReplayEvents(null);
    void (async () => {
      const { data, error: err } = await supabase
        .from("logs_activite")
        .select("enregistrement_ecran")
        .eq("id", selectedReplayRow.id)
        .maybeSingle();
      if (cancelled) return;
      setReplayDetailLoading(false);
      if (err || !data) {
        setReplayEvents(null);
        return;
      }
      const raw = (data as { enregistrement_ecran?: unknown }).enregistrement_ecran;
      if (!isMeaningfulRrwebReplay(raw)) {
        setReplayEvents(null);
        return;
      }
      setReplayEvents(raw as eventWithTime[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedReplayRow, supabase]);

  /** Pulse : démo très dense hors filtre temps réel, ou logs courants (« Aujourd’hui », page chargée). */
  const pulseWaveEntries = useMemo(() => {
    if (filtre === "jour" && logs.length >= 10) {
      return [...logs]
        .map((log) => mapLogActiviteToPulseEntry(log))
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );
    }
    return generateStorePulseDemoEntries();
  }, [filtre, logs]);

  const handlePulseBarActivate = useCallback(
    async (entry: StorePulseWaveEntry) => {
      if (entry.id.includes("-pulse-demo-")) {
        toast.message("Pulse démo", {
          description:
            "Timeline simulée. Utilise « Aujourd’hui » avec assez de logs pour relier une barre à un événement réel et ouvrir le VAR.",
        });
        setOngletActif("replay");
        void loadReplayList();
        return;
      }

      const { data, error } = await supabase
        .from("logs_activite")
        .select(
          "id, created_at, vendeur_nom, type_action, details, niveau_alerte"
        )
        .eq("id", entry.id)
        .not("enregistrement_ecran", "is", null)
        .gte("replay_span_ms", MIN_RRWEB_REPLAY_SPAN_MS)
        .maybeSingle();

      if (error || !data) {
        toast.error("Pas de replay VAR pour cet événement.");
        return;
      }

      setOngletActif("replay");
      setSelectedReplayRow(data as unknown as LogReplayListeRow);
      void loadReplayList();
    },
    [supabase, loadReplayList]
  );

  const loadShadowData = useCallback(async () => {
    setShadowLoading(true);
    setShadowError(null);
    try {
      const { data, error: err } = await supabase
        .from("logs_activite")
        .select(
          "id, created_at, vendeur_nom, type_action, details, niveau_alerte, valeur_perdue, shadow_manifest"
        )
        .in("type_action", ["suppression_panier", "annulation_vente"])
        .order("created_at", { ascending: false })
        .limit(2500);

      if (err) {
        setShadowLogsRaw([]);
        setShadowError(err.message ?? "Impossible de charger le magasin de l’ombre.");
        return;
      }
      setShadowLogsRaw((data ?? []) as ShadowLogRow[]);
    } catch (e) {
      setShadowLogsRaw([]);
      setShadowError(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setShadowLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!shadowStoreMode) {
      setShadowLogsRaw([]);
      setShadowError(null);
      setShadowLoading(false);
      return;
    }
    void loadShadowData();
  }, [shadowStoreMode, loadShadowData]);

  const shadowDashboardMetrics = useMemo(() => {
    if (!shadowStoreMode) return null;
    return computeShadowStoreMetrics(shadowLogsRaw);
  }, [shadowStoreMode, shadowLogsRaw]);

  const totalPages =
    totalCount <= 0 ? 0 : Math.ceil(totalCount / ITEMS_PER_PAGE);

  const replayTotalPages =
    replayTotalCount <= 0
      ? 0
      : Math.ceil(replayTotalCount / REPLAY_ITEMS_PER_PAGE);

  const replayRangeDisplay = useMemo(() => {
    if (replayTotalCount === 0) return { start: 0, end: 0 };
    const page = Math.min(
      Math.max(replayCurrentPage, 1),
      Math.max(replayTotalPages, 1)
    );
    const start = (page - 1) * REPLAY_ITEMS_PER_PAGE + 1;
    const end = Math.min(page * REPLAY_ITEMS_PER_PAGE, replayTotalCount);
    return { start, end };
  }, [replayTotalCount, replayCurrentPage, replayTotalPages]);

  const visibleReplayPages = useMemo(
    () =>
      replayTotalPages <= 0
        ? []
        : pageItems(
            replayTotalPages,
            Math.min(replayCurrentPage, replayTotalPages)
          ),
    [replayTotalPages, replayCurrentPage]
  );

  const onReplayPageClick = (p: number) => {
    if (replayTotalPages <= 0) return;
    setReplayCurrentPage(Math.max(1, Math.min(replayTotalPages, p)));
  };

  const isFirstReplayPage =
    replayCurrentPage <= 1 ||
    replayTotalCount === 0 ||
    replayTotalPages === 0;
  const isLastReplayPage =
    replayTotalCount === 0 ||
    replayTotalPages === 0 ||
    replayCurrentPage >= replayTotalPages;

  const rangeDisplay = useMemo(() => {
    if (totalCount === 0) return { start: 0, end: 0 };
    const page = Math.min(Math.max(currentPage, 1), totalPages);
    const start = (page - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(page * ITEMS_PER_PAGE, totalCount);
    return { start, end };
  }, [totalCount, currentPage, totalPages]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (replayTotalPages > 0 && replayCurrentPage > replayTotalPages) {
      setReplayCurrentPage(replayTotalPages);
    }
  }, [replayCurrentPage, replayTotalPages]);

  useEffect(() => {
    setSelectedReplayRow(null);
  }, [replayCurrentPage]);

  const formatDt = useCallback((iso: string) => {
    try {
      return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  }, []);

  const filtresClass =
    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all";

  const visiblePages = useMemo(
    () =>
      totalPages <= 0
        ? []
        : pageItems(totalPages, Math.min(currentPage, totalPages)),
    [totalPages, currentPage]
  );

  const onPageClick = (p: number) => {
    if (totalPages <= 0) return;
    setCurrentPage(Math.max(1, Math.min(totalPages, p)));
  };

  const isFirstPage = currentPage <= 1 || totalCount === 0 || totalPages === 0;
  const isLastPage =
    totalCount === 0 || totalPages === 0 || currentPage >= totalPages;

  const badgeForNiveau = (lvl: "info" | "warning" | "critique") => {
    const wrap =
      "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap";
    switch (lvl) {
      case "critique":
        return {
          Icon: AlertTriangle,
          cls: `${wrap} bg-red-100 text-red-700 ring-1 ring-red-200/80`,
          iconCls: "h-3.5 w-3.5 shrink-0",
          label: "Critique",
        };
      case "warning":
        return {
          Icon: PauseCircle,
          cls: `${wrap} bg-orange-100 text-orange-700 ring-1 ring-orange-200/80`,
          iconCls: "h-3.5 w-3.5 shrink-0 text-orange-600",
          label: "Attention",
        };
      default:
        return {
          Icon: CheckCircle2,
          cls: `${wrap} bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80`,
          iconCls: "h-3.5 w-3.5 shrink-0 text-emerald-600",
          label: "Info",
        };
    }
  };

  // TODO: Zone réservée pour les futurs modules (Détective IA, Score de Confiance, etc.) — voir `<section aria-label="Modules à venir">` ci‑dessous.

  return (
    <div className="admin-container min-h-dvh bg-slate-50/90 px-4 py-8 pb-28 md:px-8 lg:px-12">
      <header className="mx-auto mb-8 max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500/40">
              <ClipboardList className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
                Historique &amp; Logs
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                Quarts caisse (<strong className="font-medium text-slate-700">
                  ouvertures
                </strong>
                ,{" "}
                <strong className="font-medium text-slate-700">clôtures</strong>)
                puis journal audit — données Supabase, espace réservé aux admins.
              </p>
            </div>
          </div>
        </div>

        <div
          dir="ltr"
          className="mt-6 grid max-w-4xl grid-cols-1 gap-1 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm sm:grid-cols-3 [&>*]:min-w-0"
          role="tablist"
          aria-label="Vue historique"
        >
          <button
            type="button"
            role="tab"
            aria-selected={ongletActif === "journal"}
            aria-controls="tabpanel-journal"
            id="tab-journal-trigger"
            className={`flex w-full flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold tracking-tight transition-all sm:text-sm ${
              ongletActif === "journal"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => setOngletActif("journal")}
          >
            <span aria-hidden>🔎</span>
            <span className="truncate text-center">Journal des actions</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ongletActif === "sessions"}
            aria-controls="tabpanel-sessions"
            id="tab-sessions-trigger"
            className={`flex w-full flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold tracking-tight transition-all sm:text-sm ${
              ongletActif === "sessions"
                ? "bg-slate-900 text-white shadow-md"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => {
              setOngletActif("sessions");
              void loadSessions();
            }}
          >
            <span className="tabular-nums" aria-hidden>
              ⏱️
            </span>
            <span className="truncate text-center">
              Sessions &amp; horaires
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ongletActif === "replay"}
            aria-controls="tabpanel-var-replay"
            id="tab-replay-trigger"
            className={`flex w-full flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold tracking-tight transition-all sm:text-sm ${
              ongletActif === "replay"
                ? "bg-emerald-800 text-white shadow-md"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => {
              setOngletActif("replay");
              void loadReplayList();
            }}
          >
            <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
            <span className="truncate text-center">VAR · Replay</span>
          </button>
        </div>

        {ongletActif === "journal" && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltre("tous")}
              className={`${filtresClass} ${
                filtre === "tous"
                  ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-800"
                  : "border border-slate-200/90 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              Tout voir
            </button>
            <button
              type="button"
              onClick={() => setFiltre("suspects")}
              className={`${filtresClass} ${
                filtre === "suspects"
                  ? "bg-amber-600 text-white shadow-sm ring-1 ring-amber-500"
                  : "border border-amber-200/90 bg-white text-amber-950 shadow-sm hover:bg-amber-50"
              }`}
            >
              <AlertTriangle className="h-4 w-4" strokeWidth={2} />
              Suspects uniquement
            </button>
            <button
              type="button"
              onClick={() => setFiltre("jour")}
              className={`${filtresClass} ${
                filtre === "jour"
                  ? "bg-emerald-700 text-white shadow-sm ring-1 ring-emerald-600"
                  : "border border-emerald-200 bg-white text-emerald-900 shadow-sm hover:bg-emerald-50/80"
              }`}
            >
              Aujourd&apos;hui
            </button>
          </div>
        )}
      </header>

      <div
        className={
          shadowStoreMode
            ? "mx-auto max-w-6xl rounded-[1.85rem] border border-violet-950/40 bg-black/[0.02] px-4 py-10 ring-1 ring-violet-900/35 md:px-8"
            : "mx-auto max-w-6xl"
        }
      >
        <div className="mb-10 lg:mb-12">
          <ShadowMirrorBoard
            shadowMode={shadowStoreMode}
            onShadowModeChange={setShadowStoreMode}
            metrics={shadowDashboardMetrics}
            loading={shadowLoading}
            error={shadowError}
            formatDt={formatDt}
          />
        </div>
        {!shadowStoreMode && (
          <StorePulseWave
            entries={pulseWaveEntries}
            sourceBadge={
              filtre === "jour" && logs.length >= 10
                ? `Journée réelle · ${logs.length}`
                : "Synthèse démo"
            }
            onBarActivate={(e) => {
              void handlePulseBarActivate(e);
            }}
            className="mb-11"
          />
        )}
        {ongletActif === "journal" && !shadowStoreMode && (
          <article
            id="tabpanel-journal"
            role="tabpanel"
            aria-labelledby="tab-journal-trigger"
            className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80"
          >
            {logsLoading ? (
              <div className="flex min-h-[260px] items-center justify-center gap-3 py-16 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <span className="text-sm font-medium">Chargement des logs…</span>
              </div>
            ) : logsError ? (
              <div className="px-8 py-16 text-center text-sm text-red-600">{logsError}</div>
            ) : logs.length === 0 ? (
              <div className="px-8 py-20 text-center text-sm text-slate-500">
                Aucune entrée pour ce filtre sur cette page.
              </div>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="hidden w-12 px-3 py-3.5 md:table-cell" />
                      <th className="whitespace-nowrap px-4 py-3.5 md:min-w-[168px]">
                        Horodatage
                      </th>
                      <th className="whitespace-nowrap px-4 py-3.5">Niveau</th>
                      <th className="min-w-[140px] px-4 py-3.5">Action</th>
                      <th className="min-w-[112px] px-4 py-3.5">Vendeuse</th>
                      <th className="min-w-[220px] px-4 py-3.5 xl:max-w-xl">
                        Détails
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {logs.map((row) => {
                      const lvl = niveauNormalized(row.niveau_alerte);
                      const badge = badgeForNiveau(lvl);
                      const RowIcon = badge.Icon;

                      return (
                        <tr
                          key={row.id}
                          className="transition-colors hover:bg-slate-50 focus-within:bg-slate-50/80"
                        >
                          <td className="hidden align-middle px-3 py-3.5 md:table-cell">
                            <RowIcon
                              className={`h-[18px] w-[18px] shrink-0 ${
                                lvl === "critique"
                                  ? "text-red-500"
                                  : lvl === "warning"
                                    ? "text-orange-500"
                                    : "text-emerald-500"
                              }`}
                              aria-hidden
                              strokeWidth={2}
                            />
                          </td>
                          <td className="align-middle whitespace-nowrap px-4 py-3.5 tabular-nums text-[13px] text-slate-500">
                            <span>{formatDt(row.created_at)}</span>
                          </td>
                          <td className="align-middle whitespace-nowrap px-4 py-3.5">
                            <span className={badge.cls}>
                              <RowIcon
                                className={badge.iconCls}
                                strokeWidth={2}
                                aria-hidden
                              />
                              {badge.label}
                            </span>
                          </td>
                          <td className="align-middle px-4 py-3.5">
                            <span className="line-clamp-2 font-medium capitalize text-slate-800">
                              {row.type_action.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="align-middle px-4 py-3.5 text-[13px] text-slate-600">
                            <span className="line-clamp-2 break-words md:truncate md:leading-normal">
                              {row.vendeur_nom?.trim() || "—"}
                            </span>
                          </td>
                          <td className="max-w-xl align-middle px-4 py-3.5">
                            <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-700 md:line-clamp-3">
                              {row.details ?? "—"}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!logsLoading && !logsError && totalCount > 0 && (
              <footer className="border-t border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-5">
                <p className="mb-6 text-center text-[13px] text-slate-600 sm:text-left">
                  Affichage de{" "}
                  <span className="font-semibold tabular-nums text-slate-900">
                    {rangeDisplay.start}
                  </span>{" "}
                  à{" "}
                  <span className="font-semibold tabular-nums text-slate-900">
                    {rangeDisplay.end}
                  </span>{" "}
                  sur{" "}
                  <span className="font-semibold tabular-nums text-slate-900">
                    {totalCount}
                  </span>{" "}
                  résultat
                  {totalCount > 1 ? "s" : ""}.
                </p>

                <div className="mx-auto grid w-full max-w-3xl items-center gap-6 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
                  <div className="flex justify-center gap-2 sm:justify-self-start">
                    <button
                      type="button"
                      disabled={isFirstPage}
                      onClick={() => onPageClick(currentPage - 1)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
                      Précédent
                    </button>
                    <button
                      type="button"
                      disabled={isLastPage}
                      onClick={() => onPageClick(currentPage + 1)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                    >
                      Suivant
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
                    </button>
                  </div>

                  <nav
                    className="flex flex-wrap items-center justify-center gap-1 justify-self-center"
                    aria-label="Pages"
                  >
                    {visiblePages.map((item, i) =>
                      item === "ellipsis" ? (
                        <span
                          key={`ellipsis-${i}`}
                          className="min-w-[2rem] px-2 text-center text-slate-400"
                          aria-hidden
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => onPageClick(item)}
                          className={`min-h-[38px] min-w-[38px] rounded-lg text-[13px] font-semibold tabular-nums transition-colors ${
                            item === currentPage
                              ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500"
                              : "text-slate-600 hover:bg-slate-200/90"
                          }`}
                          aria-current={item === currentPage ? "page" : undefined}
                        >
                          {item}
                        </button>
                      )
                    )}
                  </nav>

                  <div className="hidden sm:block sm:justify-self-end" aria-hidden />
                </div>
              </footer>
            )}
          </article>
        )}

        {ongletActif === "sessions" && (
          <section
            id="tabpanel-sessions"
            role="tabpanel"
            aria-labelledby="tab-sessions-trigger"
            className="mb-12"
          >
            <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Ouvertures &amp; fermetures
                </p>
                <p className="text-lg font-semibold tracking-tight text-slate-900">
                  Shift cards · les 7 dernières sessions
                </p>
              </div>
              <p className="text-[13px] text-slate-500">
                Après{" "}
                <span className="font-semibold tabular-nums text-slate-700">
                  09h30
                </span>{" "}
                locale : ouverture en rouge + badge Retard (règle magasin).
              </p>
            </div>

            {sessionsLoading ? (
              <div className="flex min-h-[260px] items-center justify-center gap-3 rounded-xl border border-slate-100 bg-white py-16 shadow-sm ring-1 ring-slate-100/80">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <span className="text-sm font-medium text-slate-500">
                  Chargement des sessions…
                </span>
              </div>
            ) : sessionsError ? (
              <div className="rounded-xl border border-red-100 bg-red-50/50 px-8 py-12 text-center text-sm text-red-700 ring-1 ring-red-100/80">
                {sessionsError}
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-8 py-20 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-100/60">
                Aucune session enregistrée pour le moment.
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {sessions.map((s) => (
                  <ShiftSessionCard key={s.id} session={s} />
                ))}
              </div>
            )}
          </section>
        )}

        {ongletActif === "replay" && (
          <article
            id="tabpanel-var-replay"
            role="tabpanel"
            aria-labelledby="tab-replay-trigger"
            className="mb-12 space-y-8"
          >
            <header className="max-w-3xl space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Enregistrements critiques
              </p>
              <p className="text-lg font-semibold tracking-tight text-slate-900">
                Session replay rrweb · encaissement &amp; annulations panier
              </p>
              <p className="text-sm leading-relaxed text-slate-600">
                Ces replays correspondent aux actions enregistrées depuis la caisse uniquement lors
                d&apos;un encaissement validé, d&apos;un panier vidé ou d&apos;une ligne supprimée
                entièrement.
              </p>
            </header>

            <div className="grid gap-10 lg:grid-cols-2 xl:gap-14">
              <div className="min-w-0 space-y-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
                {replayLoading ? (
                  <div className="flex min-h-[260px] items-center justify-center gap-3 py-16 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    <span className="text-sm font-medium">Chargement des archives…</span>
                  </div>
                ) : replayError ? (
                  <div className="px-8 py-16 text-center text-sm text-red-600">{replayError}</div>
                ) : replayLogs.length === 0 ? (
                  <div className="px-8 py-20 text-center text-sm text-slate-500">
                    Aucun enregistrement d&apos;écran pour le moment. Les événements critiques depuis
                    la caisse apparaîtront ici.
                  </div>
                ) : (
                  <div className="relative overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="whitespace-nowrap px-4 py-3.5">Horodatage</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Niveau</th>
                          <th className="min-w-[120px] px-4 py-3.5">Action</th>
                          <th className="min-w-[112px] px-4 py-3.5">Vendeuse</th>
                          <th className="min-w-[200px] px-4 py-3.5">Lecture</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {replayLogs.map((row) => {
                          const lvl = niveauNormalized(row.niveau_alerte);
                          const badge = badgeForNiveau(lvl);
                          const RowIcon = badge.Icon;
                          const isSel = selectedReplayRow?.id === row.id;

                          return (
                            <tr
                              key={row.id}
                              className={
                                isSel
                                  ? "bg-emerald-50/60 transition-colors"
                                  : "transition-colors hover:bg-slate-50/80"
                              }
                            >
                              <td className="align-middle whitespace-nowrap px-4 py-3.5 tabular-nums text-[13px] text-slate-500">
                                {formatDt(row.created_at)}
                              </td>
                              <td className="align-middle whitespace-nowrap px-4 py-3.5">
                                <span className={badge.cls}>
                                  <RowIcon
                                    className={badge.iconCls}
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                  {badge.label}
                                </span>
                              </td>
                              <td className="align-middle px-4 py-3.5 capitalize text-[13px] font-medium text-slate-800">
                                {row.type_action.replace(/_/g, " ")}
                              </td>
                              <td className="align-middle px-4 py-3.5 text-[13px] text-slate-600">
                                <span className="line-clamp-2">{row.vendeur_nom ?? "—"}</span>
                              </td>
                              <td className="align-middle px-4 py-3.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedReplayRow(row)}
                                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-700/35 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-950 shadow-sm transition-colors hover:bg-emerald-100/90"
                                >
                                  <MonitorPlay className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                                  Lire
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {!replayLoading && !replayError && replayTotalCount > 0 && (
                  <footer className="border-t border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-5">
                    <p className="mb-6 text-center text-[13px] text-slate-600 sm:text-left">
                      Affichage de{" "}
                      <span className="font-semibold tabular-nums text-slate-900">
                        {replayRangeDisplay.start}
                      </span>{" "}
                      à{" "}
                      <span className="font-semibold tabular-nums text-slate-900">
                        {replayRangeDisplay.end}
                      </span>{" "}
                      sur{" "}
                      <span className="font-semibold tabular-nums text-slate-900">
                        {replayTotalCount}
                      </span>{" "}
                      résultat{replayTotalCount > 1 ? "s" : ""}.
                    </p>

                    <div className="mx-auto grid w-full max-w-3xl items-center gap-6 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
                      <div className="flex justify-center gap-2 sm:justify-self-start">
                        <button
                          type="button"
                          disabled={isFirstReplayPage}
                          onClick={() => onReplayPageClick(replayCurrentPage - 1)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                        >
                          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
                          Précédent
                        </button>
                        <button
                          type="button"
                          disabled={isLastReplayPage}
                          onClick={() => onReplayPageClick(replayCurrentPage + 1)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
                        </button>
                      </div>

                      <nav
                        className="flex flex-wrap items-center justify-center gap-1 justify-self-center"
                        aria-label="Pages replay"
                      >
                        {visibleReplayPages.map((item, i) =>
                          item === "ellipsis" ? (
                            <span
                              key={`r-ellipsis-${i}`}
                              className="min-w-[2rem] px-2 text-center text-slate-400"
                              aria-hidden
                            >
                              …
                            </span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              onClick={() => onReplayPageClick(item)}
                              className={`min-h-[38px] min-w-[38px] rounded-lg text-[13px] font-semibold tabular-nums transition-colors ${
                                item === replayCurrentPage
                                  ? "bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-700"
                                  : "text-slate-600 hover:bg-slate-200/90"
                              }`}
                              aria-current={
                                item === replayCurrentPage ? "page" : undefined
                              }
                            >
                              {item}
                            </button>
                          )
                        )}
                      </nav>

                      <div className="hidden sm:block sm:justify-self-end" aria-hidden />
                    </div>
                  </footer>
                )}
              </div>

              <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
                <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900 via-slate-900 to-black p-5 text-white shadow-xl ring-1 ring-white/10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
                    Visionnage VAR
                  </p>
                  {selectedReplayRow ? (
                    <div className="mt-3 space-y-1 text-[13px] leading-relaxed text-slate-200">
                      <p className="font-semibold tabular-nums text-white">
                        {formatDt(selectedReplayRow.created_at)}
                      </p>
                      <p>
                        <span className="text-slate-400">Vendeuse · </span>
                        {selectedReplayRow.vendeur_nom ?? "—"}
                      </p>
                      <p className="capitalize text-slate-300">
                        <span className="text-slate-500">Action · </span>
                        {selectedReplayRow.type_action.replace(/_/g, " ")}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
                      Sélectionnez une ligne dans la liste pour charger le replay rrweb correspondant à
                      la session de travail avant l&apos;événement.
                    </p>
                  )}
                </div>

                {selectedReplayRow && replayDetailLoading && (
                  <div className="flex min-h-[200px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    <span className="text-sm font-medium">Décodage de la séquence…</span>
                  </div>
                )}

                {selectedReplayRow &&
                  !replayDetailLoading &&
                  replayEvents &&
                  replayEvents.length >= 2 && (
                    <RrwebSessionPlayerLazy
                      key={selectedReplayRow.id}
                      events={replayEvents}
                      className="w-full"
                    />
                  )}

                {selectedReplayRow &&
                  !replayDetailLoading &&
                  (!replayEvents || replayEvents.length < 2) && (
                    <div className="flex min-h-[200px] items-center rounded-xl border border-amber-200/80 bg-amber-50/80 px-5 py-12 text-center text-sm text-amber-950">
                      Impossible de lire cet enregistrement (données manquantes ou corrompues).
                    </div>
                  )}

                {!selectedReplayRow && (
                  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/90 bg-white/70 px-6 py-14 text-center text-sm text-slate-500 shadow-inner ring-1 ring-slate-100/80">
                    <MonitorPlay
                      className="mb-3 h-10 w-10 text-slate-300"
                      aria-hidden
                      strokeWidth={1.5}
                    />
                    Aucun clip sélectionné.
                  </div>
                )}
              </aside>
            </div>
          </article>
        )}

        <section
          className="mt-10 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-24 text-center ring-1 ring-slate-100/80"
          aria-label="Modules à venir"
        >
          <p className="mx-auto max-w-md px-4 text-sm leading-relaxed text-slate-500">
            Espace réservé pour des extensions (analyses, anomalies, synthèses)
            lorsque vos flux de données auront grossi suffisamment.
          </p>
        </section>

      </div>
    </div>
  );
}
