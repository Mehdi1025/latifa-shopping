"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
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
  Building2,
  Landmark,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Wifi,
  X,
  Zap,
} from "lucide-react";

const FALLBACK_IBAN_DISPLAY = "FR** **** **** **** ****";

type TxCategory = "Fournisseur" | "Salaire" | "Taxes" | "Recette" | "Autre";

type PlaidFinancePayload =
  | { connected: false; diagnostics?: string }
  | {
      connected: true;
      plaidItemId: string;
      balanceEUR: number;
      primaryAccountLabel: string;
      ibanMasked: string | null;
      transactions: {
        id: string;
        dateISO: string;
        libelle: string;
        categorie: string;
        montantEUR: number;
      }[];
      chartData7j: { jour: string; entrees: number; sorties: number }[];
      upstreamError?: string;
    };

const KNOWN_CAT = new Set<string>([
  "Fournisseur",
  "Salaire",
  "Taxes",
  "Recette",
  "Autre",
]);

function categoryForBadge(c: string): TxCategory {
  const t = typeof c === "string" ? c.trim() : "";
  return KNOWN_CAT.has(t) ? (t as TxCategory) : "Autre";
}

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
  Autre: {
    className:
      "border-slate-200/80 bg-slate-50 text-slate-800 ring-1 ring-slate-100",
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
  const searchParams = useSearchParams();

  const [payload, setPayload] = useState<PlaidFinancePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openBankingModal, setOpenBankingModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const isConnected = payload?.connected === true;
  const transactions = useMemo(() => {
    if (!payload?.connected) return [];
    return payload.transactions;
  }, [payload]);

  useEffect(() => {
    const err = searchParams.get("error");
    if (!err) return;

    const map: Record<string, string> = {
      cancelled: "Connexion bancaire annulée.",
      forbidden: "Accès refusé pour ce compte.",
      save_failed: "Impossible d’enregistrer la liaison bancaire. Réessayez.",
    };
    toast.error(map[err] ?? `Erreur : ${err}`);
    router.replace("/dashboard/finance", { scroll: false });
  }, [searchParams, router]);

  const loadFinanceData = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/finance/plaid-data", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/dashboard/finance")}`);
        return;
      }
      const body = (await res.json()) as PlaidFinancePayload | { error?: string };

      if (!res.ok && "error" in body && typeof body.error === "string") {
        setLoadError(body.error);
        setPayload({ connected: false });
        return;
      }
      if ("connected" in body) setPayload(body);
      else {
        setLoadError("Réponse Plaid inattendue.");
        setPayload({ connected: false });
      }
    } catch {
      setLoadError("Impossible de charger les données de trésorerie.");
      setPayload({ connected: false });
    }
  }, [router]);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/plaid/create-link-token", {
          method: "POST",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { link_token?: unknown };
        if (!cancelled && typeof body.link_token === "string" && body.link_token.trim()) {
          setLinkToken(body.link_token.trim());
        }
      } catch {
        if (!cancelled) setLinkToken(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      setExchangeLoading(true);
      try {
        const res = await fetch("/api/plaid/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ public_token: publicToken }),
        });
        const body = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !body.success) {
          toast.error(typeof body.error === "string" ? body.error : "Échange Plaid impossible.");
          return;
        }
        toast.success("Banque connectée avec succès via Plaid.");
        setOpenBankingModal(false);
        await loadFinanceData();
      } catch {
        toast.error("Impossible de finaliser la connexion Plaid.");
      } finally {
        setExchangeLoading(false);
      }
    },
    [loadFinanceData]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => {
      void onPlaidSuccess(publicToken);
    },
  });

  const plaidLinkReady = ready && Boolean(linkToken);

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
    if (!isConnected || transactions.length === 0) {
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
  }, [isConnected, iaPayload, transactions.length]);

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

  const handleConnect = useCallback(() => {
    if (!plaidLinkReady || exchangeLoading) return;
    open();
  }, [exchangeLoading, open, plaidLinkReady]);

  const bankModal = openBankingModal && (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/55 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-bank-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 id="modal-bank-title" className="text-lg font-semibold text-slate-900">
            Connexion sécurisée (Plaid)
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
        <div className="space-y-5 px-6 py-6 text-sm leading-relaxed text-slate-600">
          <p>
            Connectez votre compte via <strong>Open Banking</strong> (DSP2). Plaid Link s’ouvre
            directement dans cette fenêtre ; une fois la banque reliée, vos soldes et opérations
            seront synchronisés automatiquement.
          </p>
          <button
            type="button"
            disabled={!plaidLinkReady || exchangeLoading}
            onClick={handleConnect}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exchangeLoading || !linkToken ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                {exchangeLoading ? "Finalisation…" : "Préparation de Plaid Link…"}
              </>
            ) : (
              "Continuer avec Plaid"
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpenBankingModal(false)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );

  /** Chargement initial */
  if (payload === null) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 pb-16 text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
        <p className="text-sm font-medium">Synchronisation avec votre tableau de trésorerie…</p>
        {bankModal}
      </div>
    );
  }

  /** Non connecté : CTA minimal, aucune liste factice */
  if (!payload.connected) {
    return (
      <div className="min-h-0 pb-16">
        <header className="mb-10 border-b border-slate-200/80 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Bureau privé
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
                Trésorerie &amp; synchronisation bancaire
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Connectez votre banque une première fois pour afficher vos soldes et vos opérations
                Plaid côté admin.
              </p>
              {payload.diagnostics && process.env.NODE_ENV === "development" ? (
                <p className="mt-3 text-xs text-amber-800">{payload.diagnostics}</p>
              ) : null}
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
              Aucune banque reliée pour l’instant
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

        <div className="flex min-h-[42vh] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-slate-200/90 bg-white/70 px-6 py-16 text-center shadow-[0_8px_40px_-24px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <Landmark className="h-14 w-14 text-indigo-500/90" strokeWidth={1.25} />
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">
            Reliez votre compte principal
          </h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Nous chargerons vos soldes, un graphique des 7 derniers jours et l’historique des
            opérations, puis nous enverrons ces données réelles à l’analyse financière IA.
          </p>
          <button
            type="button"
            disabled={!plaidLinkReady || exchangeLoading}
            onClick={() => {
              if (plaidLinkReady) {
                open();
                return;
              }
              setOpenBankingModal(true);
            }}
            className="mt-10 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#4338CA] via-[#4F46E5] to-[#6366F1] px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/30 transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wifi className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            Connecter ma banque
          </button>
        </div>

        {bankModal}
      </div>
    );
  }

  const conn = payload;
  const balanceEUR = conn.balanceEUR;
  const chartData = conn.chartData7j;
  const ibanDisplay = conn.ibanMasked?.trim() ? conn.ibanMasked.trim() : FALLBACK_IBAN_DISPLAY;

  /** Connecté — dashboard complet avec données Plaid */
  return (
    <div className="min-h-0 pb-16">
      <header className="mb-10 border-b border-slate-200/80 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Bureau privé
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
              Trésorerie &amp; synchronisation bancaire
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Soldes et opérations issus de Plaid (Open Banking) — mise à jour à chaque visite de
              cette page.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1.5 text-xs font-medium text-emerald-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Banque reliée • données Plaid
          </span>
        </div>
      </header>

      {conn.upstreamError ? (
        <div
          className="mb-8 flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} />
          <div>
            <p className="font-semibold text-amber-950">Synchronisation Plaid partielle</p>
            <p className="mt-1 leading-relaxed">{conn.upstreamError}</p>
          </div>
        </div>
      ) : null}

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
                Basée sur vos{" "}
                <strong className="font-semibold text-slate-700">transactions Plaid réelles</strong>{" "}
                ({transactions.length} opération
                {transactions.length > 1 ? "s" : ""} analysée
                {transactions.length > 1 ? "s" : ""}, échantillon max. 500).
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-5 min-h-[5.5rem]">
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucune transaction récupérée pour analyser vos flux pour le moment (compte nouveau ou
              opérations en attente).
            </p>
          ) : aiLoading ? (
            <div className="space-y-3" aria-busy aria-live="polite">
              <p className="text-sm font-medium text-slate-600">
                Groq analyse vos flux financiers…
              </p>
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

      <section aria-labelledby="sec-comptes" className="mb-12">
        <h2 id="sec-comptes" className="sr-only">
          Compte connecté
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
                      Open Banking
                    </p>
                    <p className="truncate text-sm font-medium text-white/90">
                      {conn.primaryAccountLabel}
                    </p>
                  </div>
                </div>
                <Wifi className="h-5 w-5 shrink-0 text-white/40" aria-hidden />
              </div>

              <p className="relative mt-8 font-mono text-sm tracking-[0.06em] text-white/85">
                {ibanDisplay}
              </p>

              <div className="relative mt-8">
                <p className="text-xs font-medium text-white/55">Solde actuel (EUR)</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-white">
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    minimumFractionDigits: 2,
                  }).format(balanceEUR)}
                </p>
              </div>

              <div className="relative mt-6 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/25 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/15">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                  Lien Plaid actif • item relié à la boutique
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!plaidLinkReady || exchangeLoading}
            onClick={() => {
              if (plaidLinkReady) open();
              else setOpenBankingModal(true);
            }}
            className="group flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] transition-all hover:border-indigo-300 hover:bg-white hover:shadow-[0_12px_32px_-12px_rgba(79,70,229,0.15)] disabled:cursor-not-allowed disabled:opacity-60 md:col-span-1"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600">
              <Plus className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <span className="mt-4 text-sm font-semibold text-slate-800">Relier ou renouveler</span>
            <span className="mt-2 max-w-[260px] text-xs leading-snug text-slate-500">
              Si Plaid vous demande une nouvelle authentification, ouvrez de nouveau cette étape —
              nous mettons à jour l’item automatiquement.
            </span>
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] md:col-span-1">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Building2 className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Agrégateur &amp; conformité PSD2
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Les transactions affichées proviennent de l’API Plaid. Un second compte peut être
                  relié depuis le flux Link si votre banque le permet.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

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
              Agrégés sur les transactions Plaid des 7 derniers jours (entrées positives / sorties
              débitées).
            </p>
          </div>
        </div>

        <div className="h-[300px] w-full md:h-[320px]">
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
        </div>
      </section>

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
              Flux synchronisés via Plaid • tri par date récente
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
                  <td
                    colSpan={4}
                    className="px-8 py-12 text-center text-sm text-slate-500"
                  >
                    Aucune opération trouvée.
                  </td>
                </tr>
              ) : (
                filteredTx.map((row) => {
                  const isCredit = row.montantEUR >= 0;
                  const badgeKey = categoryForBadge(row.categorie);
                  const cat = CATEGORY_STYLES[badgeKey];
                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
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
                        <span
                          className={isCredit ? "text-emerald-600" : "text-red-600"}
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

      {bankModal}
    </div>
  );
}
