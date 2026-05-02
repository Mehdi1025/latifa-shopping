"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  ShoppingCart,
  Trash2,
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

export default function HistoriqueLogsPage() {
  const [logs, setLogs] = useState<LogActivite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<FiltreRapide>("tous");

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("logs_activite")
        .select(
          "id, created_at, vendeur_nom, type_action, details, niveau_alerte"
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (err) {
        setError(err.message ?? "Impossible de charger les logs.");
        setLogs([]);
        return;
      }
      setLogs((data ?? []) as LogActivite[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const logsFiltres = useMemo(() => {
    let rows = [...logs];
    if (filtre === "suspects") {
      rows = rows.filter((r) => {
        const n = niveauNormalized(r.niveau_alerte);
        return n === "warning" || n === "critique";
      });
    } else if (filtre === "jour") {
      const a = startOfTodayISO();
      const b = endOfTodayISO();
      rows = rows.filter((r) => r.created_at >= a && r.created_at <= b);
    }
    return rows;
  }, [logs, filtre]);

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

  const badgeClass =
    "inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors";

  return (
    <div className="admin-container min-h-dvh bg-slate-50/80 px-4 py-8 pb-24 md:px-8 lg:px-12">
      <header className="mx-auto mb-8 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <ClipboardList className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
              Historique &amp; Logs
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Activité récente relevée sur la caisse (consultation réservée
              aux administrateurs).
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFiltre("tous")}
            className={`${badgeClass} ${
              filtre === "tous"
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Tout voir
          </button>
          <button
            type="button"
            onClick={() => setFiltre("suspects")}
            className={`${badgeClass} ${
              filtre === "suspects"
                ? "bg-amber-600 text-white shadow-sm"
                : "border border-amber-200 bg-amber-50/80 text-amber-950 hover:bg-amber-100"
            }`}
          >
            ⚠️ Suspects uniquement
          </button>
          <button
            type="button"
            onClick={() => setFiltre("jour")}
            className={`${badgeClass} ${
              filtre === "jour"
                ? "bg-emerald-700 text-white shadow-sm"
                : "border border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100"
            }`}
          >
            Aujourd&apos;hui
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center gap-3 py-16 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm font-medium">Chargement des logs…</span>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm text-red-600">
            {error}
          </div>
        ) : logsFiltres.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            Aucune entrée à afficher pour ce filtre.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logsFiltres.map((row) => {
              const lvl = niveauNormalized(row.niveau_alerte);
              const Icon =
                lvl === "critique"
                  ? AlertTriangle
                  : lvl === "warning"
                    ? PauseCircle
                    : CheckCircle2;
              const subtleIcon =
                lvl === "info" &&
                ["scan", "scan_ean"].includes(
                  (row.type_action ?? "").toLowerCase()
                ) ? (
                  <ShoppingCart
                    className="h-[18px] w-[18px] text-emerald-600"
                    aria-hidden
                  />
                ) : null;

              return (
                <li
                  key={row.id}
                  className={`flex gap-4 px-4 py-4 transition-colors md:gap-5 md:px-6 ${
                    lvl === "critique"
                      ? "border-l-[3px] border-l-red-500 bg-red-50/60"
                      : lvl === "warning"
                        ? "border-l-[3px] border-l-amber-500 bg-white"
                        : "border-l-[3px] border-l-transparent bg-white hover:bg-slate-50/80"
                  }`}
                >
                  <div className="shrink-0 pt-0.5">
                    {lvl === "critique" ? (
                      <span className="flex items-center gap-1" aria-hidden>
                        <AlertTriangle className="h-5 w-5 text-red-600" strokeWidth={2} />
                        <Trash2 className="h-4 w-4 text-red-500" strokeWidth={2} />
                      </span>
                    ) : subtleIcon ? (
                      subtleIcon
                    ) : (
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          lvl === "warning"
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }`}
                        strokeWidth={2}
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-xs tabular-nums text-slate-400">
                        {formatDt(row.created_at)}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${lvl === "critique"
                            ? "bg-red-200/80 text-red-900"
                            : lvl === "warning"
                              ? "bg-amber-200/70 text-amber-900"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                      >
                        {row.type_action.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 text-sm leading-relaxed md:text-[15px] ${lvl === "critique"
                          ? "font-bold text-red-950"
                          : lvl === "warning"
                            ? "font-medium text-amber-950"
                            : "text-slate-800"
                        }`}
                    >
                      {row.details ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.vendeur_nom?.trim()
                        ? `Vendeuse : ${row.vendeur_nom.trim()}`
                        : "Vendeuse : —"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
