"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export type LogActivite = {
  id: string;
  created_at: string;
  vendeur_nom: string | null;
  type_action: string;
  details: string | null;
  niveau_alerte: string;
};

type FiltreRapide = "tous" | "suspects" | "jour";

const ITEMS_PER_PAGE = 10;

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

export default function HistoriqueLogsPage() {
  const [logs, setLogs] = useState<LogActivite[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<FiltreRapide>("tous");
  const [currentPage, setCurrentPage] = useState(1);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtre]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
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
        setError(err.message ?? "Impossible de charger les logs.");
        setLogs([]);
        setTotalCount(0);
        return;
      }
      setLogs((data ?? []) as LogActivite[]);
      setTotalCount(count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue.");
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [supabase, currentPage, filtre]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const totalPages =
    totalCount <= 0 ? 0 : Math.ceil(totalCount / ITEMS_PER_PAGE);

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
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
                Journal d&apos;activité caisse avec pagination temps réel depuis
                Supabase. Consultation réservée aux administrateurs.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
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
      </header>

      <div className="mx-auto max-w-6xl">
        <article className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center gap-3 py-16 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">Chargement des logs…</span>
            </div>
          ) : error ? (
            <div className="px-8 py-16 text-center text-sm text-red-600">
              {error}
            </div>
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
                    <th className="min-w-[120px] px-4 py-3.5">Action</th>
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

          {!loading && !error && totalCount > 0 && (
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
