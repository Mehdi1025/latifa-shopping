"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  Building2,
  Plus,
  Search,
  Wifi,
  X,
  Landmark,
  ShieldCheck,
  Zap,
  AlertTriangle,
} from "lucide-react";
const SOLDE_ACTUEL_EUR = 14250;

const chartData7j = [
  { jour: "Lun.", entrees: 2100, sorties: 1680 },
  { jour: "Mar.", entrees: 890, sorties: 2340 },
  { jour: "Mer.", entrees: 3420, sorties: 920 },
  { jour: "Jeu.", entrees: 1200, sorties: 4100 },
  { jour: "Ven.", entrees: 4890, sorties: 1150 },
  { jour: "Sam.", entrees: 6720, sorties: 890 },
  { jour: "Dim.", entrees: 980, sorties: 320 },
];

type TxCategory = "Fournisseur" | "Salaire" | "Taxes" | "Recette";

type BankTx = {
  id: string;
  dateISO: string;
  libelle: string;
  categorie: TxCategory;
  montantEUR: number; // positif crédit, négatif débit
};

const MOCK_TRANSACTIONS: BankTx[] = [
  {
    id: "1",
    dateISO: "2026-05-12",
    libelle: "Prélèvement URSSAF — Cotisations sociales T1",
    categorie: "Taxes",
    montantEUR: -845.62,
  },
  {
    id: "2",
    dateISO: "2026-05-11",
    libelle: "Virement entrant SUMUP BV — Ventes carte J-1",
    categorie: "Recette",
    montantEUR: 2156.78,
  },
  {
    id: "3",
    dateISO: "2026-05-11",
    libelle: "PRLV SEP Direct Qamis Textiles — Facture FAC-8921",
    categorie: "Fournisseur",
    montantEUR: -1280.45,
  },
  {
    id: "4",
    dateISO: "2026-05-10",
    libelle: "Virement salaire Marie D. — Salaire mensuel Mai",
    categorie: "Salaire",
    montantEUR: -1890,
  },
  {
    id: "5",
    dateISO: "2026-05-10",
    libelle: "Virement Maison du Hijab Grossiste — Réassort Hijab satin",
    categorie: "Fournisseur",
    montantEUR: -743.08,
  },
  {
    id: "6",
    dateISO: "2026-05-09",
    libelle: "Virement entrant cliente — Àcompte événement privatif",
    categorie: "Recette",
    montantEUR: 450,
  },
  {
    id: "7",
    dateISO: "2026-05-09",
    libelle: "Prélèvement impôt sur les sociétés — Acompte 15/05",
    categorie: "Taxes",
    montantEUR: -1250,
  },
  {
    id: "8",
    dateISO: "2026-05-08",
    libelle: "CB Carrefour Pro — Petit matériel caisse et consommables",
    categorie: "Fournisseur",
    montantEUR: -67.34,
  },
  {
    id: "9",
    dateISO: "2026-05-07",
    libelle: "Virement Shopify Payments — Décaissement hebdomadaire",
    categorie: "Recette",
    montantEUR: 892.1,
  },
  {
    id: "10",
    dateISO: "2026-05-06",
    libelle: "Règlement CFE / CCI — Taxes locales",
    categorie: "Taxes",
    montantEUR: -342.89,
  },
];

const CATEGORY_STYLES: Record<
  TxCategory,
  { className: string; label: string }
> = {
  Fournisseur: {
    className:
      "border-amber-200/80 bg-amber-50 text-amber-950 ring-1 ring-amber-100",
    label: "Fournisseur",
  },
  Salaire: {
    className:
      "border-slate-200/90 bg-slate-100 text-slate-900 ring-1 ring-slate-100",
    label: "Salaire",
  },
  Taxes: {
    className:
      "border-red-200/70 bg-red-50 text-red-950 ring-1 ring-red-100",
    label: "Taxes",
  },
  Recette: {
    className:
      "border-emerald-200/80 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-100",
    label: "Recette",
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

export default function TresorerieFinancePage() {
  const [openBankingModal, setOpenBankingModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);

  const iaPayload = useMemo(
    () =>
      MOCK_TRANSACTIONS.map((t) => ({
        id: t.id,
        dateISO: t.dateISO,
        libelle: t.libelle,
        categorie: t.categorie,
        montantEUR: t.montantEUR,
      })),
    []
  );

  useEffect(() => {
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
          setAiError(e instanceof Error ? e.message : "Erreur d’analyse IA.");
          setAiInsights(null);
        }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [iaPayload]);

  const filteredTx = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MOCK_TRANSACTIONS;
    return MOCK_TRANSACTIONS.filter(
      (t) =>
        t.libelle.toLowerCase().includes(q) ||
        t.categorie.toLowerCase().includes(q) ||
        t.dateISO.includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="min-h-0 pb-16">
      <header className="mb-10 border-b border-slate-200/80 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Bureau privé
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
              Trésorerie &amp; Synchronisation Bancaire
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Flux, soldes et opérations bancaires hors du tableau de vente —
              données de démo pour validation du parcours.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Connexion PSD2 mockée — aucune donnée réelle
          </span>
        </div>
      </header>

      {/* Analyse IA — Groq */}
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
                ⚡ Analyse IA (Propulsé par Groq)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 md:text-[13px]">
                Synthèse directeur financier — données de démo, modèle Llama&nbsp;3&nbsp;via Groq.
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-5 min-h-[5.5rem]">
          {aiLoading ? (
            <div className="space-y-3" aria-busy aria-live="polite">
              <p className="text-sm font-medium text-slate-600">
                Groq analyse vos flux financiers à la vitesse de la lumière...
              </p>
              <div className="space-y-2.5 pt-1">
                <div className="h-3 max-w-[92%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />
                <div className="h-3 max-w-[78%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 [animation-delay:120ms]" />
                <div className="h-3 max-w-[65%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 [animation-delay:240ms]" />
              </div>
            </div>
          ) : aiError ? (
            <div
              className="flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
              role="alert"
            >
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                strokeWidth={1.75}
              />
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

      {/* Section 1 — Comptes */}
      <section aria-labelledby="sec-comptes" className="mb-12">
        <h2 id="sec-comptes" className="sr-only">
          Comptes connectés
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Carte bancaire principale */}
          <div className="md:col-span-1">
            <div className="relative h-full overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-[#122234] via-[#1c3550] to-[#0f1b2b] p-6 text-white shadow-[0_20px_48px_-16px_rgba(17,42,68,0.45)] md:p-7">
              <div
                className="pointer-events-none absolute right-[-20%] top-[-35%] h-56 w-56 rounded-full bg-sky-500/25 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute bottom-[-30%] left-[-15%] h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl"
                aria-hidden
              />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/25">
                    <Landmark className="h-5 w-5 text-white/95" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
                      Crédit Mutuel
                    </p>
                    <p className="text-sm font-medium text-white/90">
                      Compte courant principal
                    </p>
                  </div>
                </div>
                <Wifi className="h-5 w-5 shrink-0 text-white/40" aria-hidden />
              </div>

              <p className="relative mt-8 font-mono text-sm tracking-[0.12em] text-white/80">
                FR76 **** **** **** 4567
              </p>

              <div className="relative mt-8">
                <p className="text-xs font-medium text-white/55">Solde actuel</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-white">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    minimumFractionDigits: 2,
                  }).format(SOLDE_ACTUEL_EUR)}
                </p>
              </div>

              <div className="relative mt-6 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/25 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/15">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                  Synchronisé il y a 12 min
                </span>
              </div>
            </div>
          </div>

          {/* Ajouter un compte */}
          <button
            type="button"
            onClick={() => setOpenBankingModal(true)}
            className="group flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] transition-all hover:border-indigo-300 hover:bg-white hover:shadow-[0_12px_32px_-12px_rgba(79,70,229,0.15)] md:col-span-1"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600">
              <Plus className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <span className="mt-4 text-sm font-semibold text-slate-800">
              Ajouter un compte
            </span>
            <span className="mt-2 max-w-[240px] text-xs leading-snug text-slate-500">
              Connexion Open Banking (DSP2). Interface mockée — aucune
              authentification réelle ne sera envoyée.
            </span>
          </button>

          {/* Placeholder troisième colonne — résumé discret */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] md:col-span-1">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Building2 className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Réserves &amp; mouvements
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Prochain étape : rattacher un second compte épargne-pro ou un
                  compte dédiée fournisseurs pour suivre vos fonds disponibles sans
                  mélanger caisse boutique et trésorerie long terme.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — Flux */}
      <section
        aria-labelledby="sec-flux"
        className="mb-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] md:p-8"
      >
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <h2
              id="sec-flux"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              Flux de trésorerie
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Entrées (vert) et sorties (rouge), 7 derniers jours —
              données factices pour maquette.
            </p>
          </div>
        </div>

        <div className="h-[300px] w-full md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData7j}
              margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
              barGap={6}
              barCategoryGap={18}
            >
              <CartesianGrid
                strokeDasharray="4 8"
                vertical={false}
                stroke="#e2e8f0"
              />
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
                tickFormatter={(v: number) =>
                  `${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}k €`
                }
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                }}
                labelStyle={{
                  fontWeight: 600,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
                formatter={(value, name) => {
                  const label =
                    name === "entrees" ? "Entrées" : "Sorties";
                  if (value == null) {
                    return ["—", label];
                  }
                  const n =
                    typeof value === "number" ? value : Number(value);
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
                formatter={(value) =>
                  value === "entrees" ? "Entrées" : "Sorties"
                }
              />
              <Bar dataKey="entrees" fill="#16a34a" radius={[5, 5, 0, 0]} />
              <Bar dataKey="sorties" fill="#dc2626" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Section 3 — Grand livre */}
      <section
        aria-labelledby="sec-operations"
        className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)]"
      >
        <div className="flex flex-col gap-5 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2
              id="sec-operations"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              Dernières opérations bancaires
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Grand livre simplifié — maquette hors connexion métier réelle.
            </p>
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
              placeholder="Ex. URSSAF, SumUp, Qamis…"
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
                <th className="whitespace-nowrap px-6 py-3.5 md:px-8">
                  Catégorie
                </th>
                <th className="whitespace-nowrap px-6 py-3.5 text-right md:px-8">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredTx.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-8 py-12 text-center text-sm text-slate-500"
                  >
                    Aucune opération ne correspond au filtre.
                  </td>
                </tr>
              ) : (
                filteredTx.map((row) => {
                  const isCredit = row.montantEUR >= 0;
                  const cat = CATEGORY_STYLES[row.categorie];
                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-6 py-3.5 align-middle text-slate-600 md:px-8">
                        <time dateTime={row.dateISO}>
                          {formatDateShort(row.dateISO)}
                        </time>
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
                        <span
                          className={
                            isCredit ? "text-emerald-600" : "text-red-600"
                          }
                        >
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

      {/* Modale connexion banque mockée */}
      {openBankingModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/55 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-bank-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3
                id="modal-bank-title"
                className="text-lg font-semibold text-slate-900"
              >
                Connecter une banque
              </h3>
              <button
                type="button"
                onClick={() => setOpenBankingModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5 text-sm leading-relaxed text-slate-600">
              <p>
                Sélectionnez votre établissement pour initier une demande PSD2 —
                cette étape est simulée. Aucune donnée sensible n’est transmise.
              </p>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Banque
              </label>
              <select
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800"
              >
                <option>Crédit Mutuel</option>
                <option>LCL</option>
                <option>BNP Paribas Pro</option>
              </select>
              <button
                type="button"
                disabled
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white opacity-75"
              >
                Continuer (mock désactivé)
              </button>
              <button
                type="button"
                onClick={() => setOpenBankingModal(false)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
