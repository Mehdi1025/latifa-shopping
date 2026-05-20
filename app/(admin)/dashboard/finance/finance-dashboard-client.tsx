"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  Search,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";

import { mapCsvRows } from "@/lib/finance-csv-parse";

type TxCategory = "Fournisseur" | "Salaire" | "Taxes" | "Recette" | "Autre";

type FinanceTransaction = {
  id: string;
  dateISO: string;
  libelle: string;
  categorie: string;
  montantEUR: number;
  type: "income" | "expense";
};

type FinancePayload = {
  transactions: FinanceTransaction[];
  recentImports: FinanceTransaction[];
  balanceEUR: number;
  chartData7j: { jour: string; entrees: number; sorties: number }[];
  totalCount: number;
};

const KNOWN_CAT = new Set<string>(["Fournisseur", "Salaire", "Taxes", "Recette", "Autre"]);

function categoryForBadge(c: string): TxCategory {
  const t = typeof c === "string" ? c.trim() : "";
  return KNOWN_CAT.has(t) ? (t as TxCategory) : "Autre";
}

const CATEGORY_STYLES: Record<TxCategory, { className: string; label: string }> = {
  Fournisseur: {
    className: "border-amber-200/80 bg-amber-50 text-amber-950 ring-1 ring-amber-100",
    label: "Fournisseur",
  },
  Salaire: {
    className: "border-slate-200/90 bg-slate-100 text-slate-900 ring-1 ring-slate-100",
    label: "Salaire",
  },
  Taxes: {
    className: "border-red-200/70 bg-red-50 text-red-950 ring-1 ring-red-100",
    label: "Taxes",
  },
  Recette: {
    className: "border-emerald-200/80 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-100",
    label: "Recette",
  },
  Autre: {
    className: "border-slate-200/80 bg-slate-50 text-slate-800 ring-1 ring-slate-100",
    label: "Autre",
  },
};

function formatAbsEUR(abs: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(abs);
}

function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default function FinanceDashboardClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [payload, setPayload] = useState<FinancePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const transactions = useMemo(() => payload?.transactions ?? [], [payload]);
  const recentImports = useMemo(() => payload?.recentImports ?? [], [payload]);

  const loadFinanceData = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/finance/transactions", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/dashboard/finance")}`);
        return;
      }
      const body = (await res.json()) as FinancePayload | { error?: string };

      if (!res.ok && "error" in body && typeof body.error === "string") {
        setLoadError(body.error);
        setPayload({
          transactions: [],
          recentImports: [],
          balanceEUR: 0,
          chartData7j: [],
          totalCount: 0,
        });
        return;
      }

      if ("transactions" in body) setPayload(body);
      else {
        setLoadError("Réponse inattendue du serveur.");
        setPayload({
          transactions: [],
          recentImports: [],
          balanceEUR: 0,
          chartData7j: [],
          totalCount: 0,
        });
      }
    } catch {
      setLoadError("Impossible de charger les données de trésorerie.");
      setPayload({
        transactions: [],
        recentImports: [],
        balanceEUR: 0,
        chartData7j: [],
        totalCount: 0,
      });
    }
  }, [router]);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

  const importCsvFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Seuls les fichiers CSV sont acceptés.");
        return;
      }

      setImportLoading(true);

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const mapped = mapCsvRows(results.data);
            if (mapped.length === 0) {
              toast.error(
                "Aucune ligne valide trouvée. Vérifiez les colonnes Date, Libellé et Montant."
              );
              return;
            }

            const res = await fetch("/api/finance/import-csv", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ transactions: mapped }),
            });

            const body = (await res.json()) as { success?: boolean; inserted?: number; error?: string };

            if (!res.ok || !body.success) {
              toast.error(typeof body.error === "string" ? body.error : "Import CSV impossible.");
              return;
            }

            toast.success(`${body.inserted ?? mapped.length} transaction(s) importée(s).`);
            await loadFinanceData();
          } catch {
            toast.error("Erreur lors de l'import du fichier CSV.");
          } finally {
            setImportLoading(false);
          }
        },
        error: () => {
          toast.error("Impossible de lire le fichier CSV.");
          setImportLoading(false);
        },
      });
    },
    [loadFinanceData]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void importCsvFile(file);
    },
    [importCsvFile]
  );

  const iaPayload = useMemo(
    () =>
      transactions.map((t) => ({
        id: t.id,
        dateISO: t.dateISO,
        libelle: t.libelle,
        categorie: t.categorie,
        montantEUR: t.montantEUR,
      })),
    [transactions]
  );

  useEffect(() => {
    if (transactions.length === 0) {
      setAiLoading(false);
      setAiError(null);
      setAiInsights(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setAiLoading(true);
        setAiError(null);
        const res = await fetch("/api/finance/groq-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ transactions: iaPayload }),
        });

        let body: unknown;
        try {
          body = await res.json();
        } catch {
          if (!cancelled) {
            setAiError(`Réponse invalide du serveur (${res.status}).`);
            setAiInsights(null);
          }
          return;
        }

        const errMsg =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : null;

        if (!res.ok) {
          if (!cancelled) {
            setAiError(errMsg || `Erreur ${res.status}`);
            setAiInsights(null);
          }
          return;
        }

        const content =
          typeof body === "object" &&
          body !== null &&
          "content" in body &&
          typeof (body as { content: unknown }).content === "string"
            ? (body as { content: string }).content
            : "";

        const text = content.trim();

        if (!cancelled) {
          setAiInsights(text ? text : null);
          if (!text) setAiError("Analyse vide reçue du modèle.");
        }
      } catch (e) {
        if (!cancelled) {
          setAiError(e instanceof Error ? e.message : "Erreur d'analyse IA.");
          setAiInsights(null);
        }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [iaPayload, transactions.length]);

  const filteredTx = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) =>
        t.libelle.toLowerCase().includes(q) ||
        t.categorie.toLowerCase().includes(q) ||
        t.dateISO.includes(q)
    );
  }, [searchQuery, transactions]);

  if (payload === null) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 pb-16 text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
        <p className="text-sm font-medium">Chargement de la trésorerie…</p>
      </div>
    );
  }

  const balanceEUR = payload.balanceEUR;
  const chartData = payload.chartData7j;

  return (
    <div className="min-h-0 pb-16">
      <header className="mb-10 border-b border-slate-200/80 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Bureau privé
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
              Trésorerie &amp; import bancaire
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Importez votre relevé CSV (Date, Libellé, Montant) — solution 100&nbsp;% gratuite,
              sans API bancaire payante.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1.5 text-xs font-medium text-emerald-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            {payload.totalCount > 0
              ? `${payload.totalCount} opération${payload.totalCount > 1 ? "s" : ""} importée${payload.totalCount > 1 ? "s" : ""}`
              : "Aucune opération importée"}
          </span>
        </div>
      </header>

      {loadError ? (
        <div
          className="mb-8 flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} />
          <p className="leading-relaxed">{loadError}</p>
        </div>
      ) : null}

      <section aria-labelledby="csv-import-title" className="mb-10">
        <h2 id="csv-import-title" className="sr-only">
          Import CSV
        </h2>

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
          onDrop={handleDrop}
          className={`relative flex min-h-[220px] flex-col items-center justify-center rounded-[1.35rem] border-2 border-dashed px-6 py-12 text-center transition-all ${
            dragActive
              ? "border-indigo-400 bg-indigo-50/80 shadow-[0_12px_40px_-16px_rgba(79,70,229,0.35)]"
              : "border-slate-300 bg-white/80 shadow-[0_8px_40px_-24px_rgba(15,23,42,0.08)] hover:border-indigo-300 hover:bg-indigo-50/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCsvFile(file);
              e.target.value = "";
            }}
          />

          {importLoading ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
              <p className="mt-4 text-sm font-medium text-slate-700">Import en cours…</p>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 ring-8 ring-indigo-50">
                <Upload className="h-8 w-8" strokeWidth={1.75} />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-slate-900">
                Glissez-déposez votre relevé CSV
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                Colonnes attendues&nbsp;: <strong>Date</strong>, <strong>Libellé</strong>,{" "}
                <strong>Montant</strong> (positif = entrée, négatif = sortie).
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#4338CA] via-[#4F46E5] to-[#6366F1] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-[1.05]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Parcourir un fichier CSV
              </button>
            </>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">5 dernières opérations importées</h3>
            <span className="text-xs text-slate-500">Depuis Supabase</span>
          </div>

          {recentImports.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune transaction pour l&apos;instant — importez un premier fichier CSV ci-dessus.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Libellé</th>
                    <th className="py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentImports.map((row) => {
                    const isCredit = row.montantEUR >= 0;
                    return (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap py-2.5 pr-4 text-slate-600">
                          {formatDateShort(row.dateISO)}
                        </td>
                        <td className="max-w-[280px] truncate py-2.5 pr-4 font-medium text-slate-900">
                          {row.libelle}
                        </td>
                        <td
                          className={`whitespace-nowrap py-2.5 text-right font-semibold tabular-nums ${
                            isCredit ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {isCredit
                            ? `+ ${formatAbsEUR(Math.abs(row.montantEUR))}`
                            : `- ${formatAbsEUR(Math.abs(row.montantEUR))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-[#122234] via-[#1c3550] to-[#0f1b2b] p-6 text-white shadow-[0_20px_48px_-16px_rgba(17,42,68,0.45)] md:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
            Solde calculé
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
            }).format(balanceEUR)}
          </p>
          <p className="mt-2 text-xs text-white/55">Somme des entrées et sorties importées</p>
        </div>
      </section>

      <section
        aria-labelledby="finance-ai-title"
        className="mb-10 rounded-[1.35rem] border border-slate-200/80 bg-white/65 p-6 shadow-[0_8px_40px_-24px_rgba(15,23,42,0.12)] backdrop-blur-md backdrop-saturate-150 md:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100/90 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-4 ring-white/60">
              <Zap className="h-5 w-5" aria-hidden strokeWidth={1.75} />
            </div>
            <div>
              <h2
                id="finance-ai-title"
                className="text-base font-semibold tracking-tight text-slate-900 md:text-[1.05rem]"
              >
                Analyse IA (Groq)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 md:text-[13px]">
                Basée sur vos transactions importées ({transactions.length} opération
                {transactions.length > 1 ? "s" : ""}, max. 500).
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-5 min-h-[5.5rem]">
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-600">
              Importez un CSV pour lancer l&apos;analyse financière IA.
            </p>
          ) : aiLoading ? (
            <div className="space-y-3" aria-busy aria-live="polite">
              <p className="text-sm font-medium text-slate-600">Groq analyse vos flux financiers…</p>
              <div className="space-y-2.5 pt-1">
                <div className="h-3 max-w-[92%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />
                <div className="h-3 max-w-[78%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 [animation-delay:120ms]" />
              </div>
            </div>
          ) : aiError ? (
            <div
              className="flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} />
              <p className="leading-relaxed">{aiError}</p>
            </div>
          ) : (
            aiInsights && (
              <div className="text-[15px] leading-relaxed text-slate-800" aria-live="polite">
                <p className="whitespace-pre-line">{aiInsights}</p>
              </div>
            )
          )}
        </div>
      </section>

      <section
        aria-labelledby="sec-flux"
        className="mb-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] md:p-8"
      >
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <h2 id="sec-flux" className="text-lg font-semibold tracking-tight text-slate-900">
              Flux de trésorerie
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Agrégés sur les 7 derniers jours (entrées / sorties importées).
            </p>
          </div>
        </div>

        <div className="h-[300px] w-full md:h-[320px]">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Aucune donnée sur la période.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
                barGap={6}
                barCategoryGap={18}
              >
                <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="jour"
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}k €`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                  }}
                  labelStyle={{ fontWeight: 600, color: "#0f172a", marginBottom: 8 }}
                  formatter={(value, name) => {
                    const label = name === "entrees" ? "Entrées" : "Sorties";
                    if (value == null) return ["—", label];
                    const n = typeof value === "number" ? value : Number(value);
                    const euros = new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }).format(Number.isFinite(n) ? n : 0);
                    return [euros, label];
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  formatter={(value) => (value === "entrees" ? "Entrées" : "Sorties")}
                />
                <Bar dataKey="entrees" fill="#16a34a" radius={[5, 5, 0, 0]} />
                <Bar dataKey="sorties" fill="#dc2626" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section
        aria-labelledby="sec-operations"
        className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)]"
      >
        <div className="flex flex-col gap-5 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2 id="sec-operations" className="text-lg font-semibold tracking-tight text-slate-900">
              Dernières opérations bancaires
            </h2>
            <p className="mt-1 text-sm text-slate-600">Historique importé depuis CSV • tri par date</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-slate-50"
            >
              <Search className="h-4 w-4 text-slate-500" />
              Rechercher une transaction
            </button>
          </div>
        </div>

        {filterOpen && (
          <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 md:px-8">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Filtre texte (libellé, catégorie, date)
            </label>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ex. URSSAF, transfert…"
              className="mt-2 w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                <th className="whitespace-nowrap px-6 py-3.5 md:px-8">Date</th>
                <th className="px-6 py-3.5 md:px-8">Libellé de l&apos;opération</th>
                <th className="whitespace-nowrap px-6 py-3.5 md:px-8">Catégorie</th>
                <th className="whitespace-nowrap px-6 py-3.5 text-right md:px-8">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-sm text-slate-500">
                    Aucune opération trouvée.
                  </td>
                </tr>
              ) : (
                filteredTx.map((row) => {
                  const isCredit = row.montantEUR >= 0;
                  const badgeKey = categoryForBadge(row.categorie);
                  const cat = CATEGORY_STYLES[badgeKey];
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-6 py-3.5 align-middle text-slate-600 md:px-8">
                        <time dateTime={row.dateISO}>{formatDateShort(row.dateISO)}</time>
                      </td>
                      <td className="max-w-[min(440px,50vw)] px-6 py-3.5 align-middle font-medium leading-snug text-slate-900 md:px-8">
                        {row.libelle}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 align-middle md:px-8">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cat.className}`}
                        >
                          {cat.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 align-middle text-right font-semibold tabular-nums md:px-8">
                        <span className={isCredit ? "text-emerald-600" : "text-red-600"}>
                          {isCredit
                            ? `+ ${formatAbsEUR(Math.abs(row.montantEUR))}`
                            : `- ${formatAbsEUR(Math.abs(row.montantEUR))}`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
