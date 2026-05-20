"use client";

import { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import type { KpiAiPayload } from "@/app/api/ai/analyze-kpis/route";

type Props = {
  kpis: KpiAiPayload;
  disabled?: boolean;
};

function AnalysisSkeleton() {
  return (
    <div className="mt-6 space-y-3" aria-busy aria-live="polite">
      <p className="text-sm font-medium text-slate-600">L&apos;IA analyse vos performances…</p>
      <div className="space-y-2.5 pt-1">
        <div className="h-3 max-w-[95%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />
        <div className="h-3 max-w-[88%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 [animation-delay:100ms]" />
        <div className="h-3 max-w-[72%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 [animation-delay:200ms]" />
        <div className="h-3 max-w-[80%] animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function AiKpiInsights({ kpis, disabled = false }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/analyze-kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(kpis),
      });

      const body = (await res.json()) as { analysis?: string; error?: string };

      if (!res.ok) {
        const msg = typeof body.error === "string" ? body.error : "Analyse IA impossible.";
        setError(msg);
        toast.error(msg);
        return;
      }

      const text = typeof body.analysis === "string" ? body.analysis.trim() : "";
      if (!text) {
        setError("Réponse vide du modèle.");
        toast.error("Réponse vide du modèle.");
        return;
      }

      setAnalysis(text);
      toast.success("Analyse stratégique générée.");
    } catch {
      const msg = "Impossible de contacter le service IA.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [kpis]);

  return (
    <section
      aria-labelledby="ai-kpi-title"
      className="relative overflow-hidden rounded-[1.35rem] border border-white/60 bg-gradient-to-br from-white via-slate-50/90 to-indigo-50/40 p-6 shadow-lg ring-1 ring-indigo-500/20 backdrop-blur-xl md:p-8"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-violet-400/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 ring-4 ring-white/70">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <h2
              id="ai-kpi-title"
              className="bg-gradient-to-r from-violet-700 via-indigo-600 to-sky-600 bg-clip-text text-lg font-semibold tracking-tight text-transparent md:text-xl"
            >
              Analyse IA Stratégique
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Recommandations actionnables sur votre CA, panier moyen et rythme de ventes — propulsé
              par Groq.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => void generateAnalysis()}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Analyse en cours…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" aria-hidden />
              Générer l&apos;analyse
            </>
          )}
        </button>
      </div>

      <div className="relative mt-6 min-h-[4rem]">
        {isLoading ? (
          <AnalysisSkeleton />
        ) : error ? (
          <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : analysis ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-inner">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-3 text-[15px] leading-relaxed text-slate-800 last:mb-0">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="my-3 space-y-2.5 pl-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-3 list-decimal space-y-2.5 pl-5">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="flex gap-2.5 text-[15px] leading-relaxed text-slate-800">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">{children}</span>
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-slate-900">{children}</strong>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-indigo-700">
                    {children}
                  </h3>
                ),
              }}
            >
              {analysis}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Cliquez sur « Générer l&apos;analyse » pour obtenir un diagnostic et 3 actions
            prioritaires adaptées à vos KPIs du moment.
          </p>
        )}
      </div>
    </section>
  );
}
