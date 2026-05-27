"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { FileSpreadsheet, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { GroqAnalysisMarkdown } from "@/components/GroqAnalysisMarkdown";
import {
  KPI_HISTORY_PARSE_OPTIONS,
  mapKpiHistoryCsvRows,
} from "@/lib/kpi-history-csv-parse";

type HistoricalKpiRow = {
  id: string;
  date: string;
  revenue: number;
  sales_count: number;
  average_basket: number;
  created_at: string;
};

function formatDateFr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function formatEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

function HistoryAnalysisSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-live="polite">
      <p className="text-sm font-medium text-neutral-600">Le DAF analyse vos archives…</p>
      <div className="space-y-2.5 pt-1">
        <div className="h-3 max-w-[92%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />
        <div className="h-3 max-w-[78%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 [animation-delay:120ms]" />
        <div className="h-3 max-w-[85%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 [animation-delay:240ms]" />
      </div>
    </div>
  );
}

export default function KpiHistoryArchives() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<HistoricalKpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kpi/import-history", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await res.json()) as { rows?: HistoricalKpiRow[]; error?: string };
      if (!res.ok) {
        toast.error(typeof body.error === "string" ? body.error : "Chargement impossible.");
        setRows([]);
        return;
      }
      setRows(Array.isArray(body.rows) ? body.rows : []);
    } catch {
      toast.error("Impossible de charger l'historique.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const importFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const text = await file.text();
        const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>(
          (resolve, reject) => {
            Papa.parse<Record<string, string>>(text, {
              ...KPI_HISTORY_PARSE_OPTIONS,
              complete: resolve,
              error: (err: Error) => reject(err),
            });
          }
        );

        const mapped = mapKpiHistoryCsvRows(parsed.data);
        if (mapped.length === 0) {
          toast.error(
            "Aucune ligne valide — vérifiez la colonne Date (JJ/MM/AAAA). Les jours fermés (CA vide) sont acceptés."
          );
          return;
        }

        const res = await fetch("/api/kpi/import-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ rows: mapped }),
        });

        const body = (await res.json()) as { upserted?: number; error?: string };
        if (!res.ok) {
          toast.error(typeof body.error === "string" ? body.error : "Import impossible.");
          return;
        }

        toast.success(
          `${body.upserted ?? mapped.length} jour${(body.upserted ?? mapped.length) > 1 ? "s" : ""} importé${(body.upserted ?? mapped.length) > 1 ? "s" : ""}.`
        );
        await loadHistory();
      } catch {
        toast.error("Erreur lors de la lecture du fichier CSV.");
      } finally {
        setImporting(false);
      }
    },
    [loadHistory]
  );

  const analyzeHistory = useCallback(async () => {
    if (rows.length === 0) {
      toast.error("Importez d'abord un historique CSV.");
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);

    try {
      const res = await fetch("/api/ai/analyze-history", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });

      const body = (await res.json()) as { analysis?: string; error?: string };

      if (!res.ok) {
        const msg = typeof body.error === "string" ? body.error : "Analyse impossible.";
        setAiError(msg);
        toast.error(msg);
        return;
      }

      const text = typeof body.analysis === "string" ? body.analysis.trim() : "";
      if (!text) {
        setAiError("Réponse vide du modèle.");
        toast.error("Réponse vide du modèle.");
        return;
      }

      setAiAnalysis(text);
      toast.success("Analyse comparative générée.");
    } catch {
      const msg = "Impossible de contacter le service IA.";
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  }, [rows.length]);

  return (
    <section
      aria-labelledby="kpi-history-title"
      className="mt-12 rounded-[1.35rem] border border-neutral-200/90 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)] md:mt-16 md:p-7"
    >
      <div className="mb-6 border-b border-neutral-100 pb-5">
        <h2
          id="kpi-history-title"
          className="text-lg font-semibold tracking-tight text-neutral-900 md:text-xl"
        >
          Historique &amp; Archives (Fichiers Excel)
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Importez vos archives CSV (Date, Chiffre d&apos;affaire, Panier moyen). Format attendu :
        dates JJ/MM/AAAA, séparateur virgule. Les jours fermés (CA vide) sont acceptés.
        </p>
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void importFile(file);
        }}
        className={`relative mb-6 flex min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all ${
          dragActive
            ? "border-indigo-400 bg-indigo-50/70"
            : "border-neutral-200 bg-neutral-50/50 hover:border-indigo-200"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = "";
          }}
        />

        {importing ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="mt-3 text-sm font-medium text-neutral-700">Import en cours…</p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Upload className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-sm font-medium text-neutral-800">
              Glissez votre CSV ou cliquez pour parcourir
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importer un historique (CSV)
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de l&apos;historique…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-6 text-center text-sm text-neutral-500">
          Aucune archive importée pour l&apos;instant.
        </p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">
              {rows.length} jour{rows.length > 1 ? "s" : ""} archivé{rows.length > 1 ? "s" : ""}
            </p>
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void analyzeHistory()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Analyse en cours…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Analyser l&apos;historique avec l&apos;IA
                </>
              )}
            </button>
          </div>

          {(aiLoading || aiError || aiAnalysis) && (
            <div className="mb-6 rounded-2xl border border-white/60 bg-white/50 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-neutral-200/80 backdrop-blur-sm md:p-6">
              <h3 className="mb-3 text-sm font-semibold tracking-tight text-neutral-900">
                Analyse comparative DAF
              </h3>
              {aiLoading ? (
                <HistoryAnalysisSkeleton />
              ) : aiError ? (
                <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-800">
                  {aiError}
                </p>
              ) : aiAnalysis ? (
                <GroqAnalysisMarkdown content={aiAnalysis} />
              ) : null}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-neutral-100">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Chiffre d&apos;affaires</th>
                <th className="px-4 py-3">Ventes (est.)</th>
                <th className="px-4 py-3">Panier moyen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((row) => (
                <tr key={row.id} className="text-neutral-800">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                    {formatDateFr(row.date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium tabular-nums">
                    {formatEUR(Number(row.revenue))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{row.sales_count}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                    {formatEUR(Number(row.average_basket))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
            {rows.length} jour{rows.length > 1 ? "s" : ""} affiché{rows.length > 1 ? "s" : ""}{" "}
            (120 max.)
          </p>
        </div>
        </>
      )}
    </section>
  );
}
