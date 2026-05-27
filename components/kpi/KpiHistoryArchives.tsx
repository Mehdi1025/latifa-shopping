"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

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

export default function KpiHistoryArchives() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<HistoricalKpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

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
          toast.error("Aucune ligne valide (vérifiez Date, Chiffre d'affaire, Panier moyen).");
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
          Importez vos archives CSV (Date, Chiffre d&apos;affaire, Panier moyen). Les doublons de
          date sont mis à jour automatiquement.
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
      )}
    </section>
  );
}
