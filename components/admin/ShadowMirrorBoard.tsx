"use client";

import type { ReactNode } from "react";
import { Eye, EyeOff, Loader2, ShoppingCart, Skull, Trophy, UserX } from "lucide-react";
import type {
  ShadowStoreMetrics,
  ShadowGhostTicketRow,
} from "@/lib/shadowStore";
import { formatShadowEUR } from "@/lib/shadowStore";

type Props = {
  shadowMode: boolean;
  onShadowModeChange: (v: boolean) => void;
  metrics: ShadowStoreMetrics | null;
  loading: boolean;
  error: string | null;
  formatDt: (iso: string) => string;
};

export function ShadowMirrorBoard({
  shadowMode,
  onShadowModeChange,
  metrics,
  loading,
  error,
  formatDt,
}: Props) {
  return (
    <div className="space-y-10">
      {/* Toggle « Miroir sombre » */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Magasin de l&apos;ombre
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            Le miroir financier des annulations
          </h2>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={shadowMode}
          onClick={() => onShadowModeChange(!shadowMode)}
          className="group relative flex w-full shrink-0 items-center rounded-2xl border border-slate-200/95 bg-white p-1 shadow-sm ring-1 ring-black/[0.04] sm:w-[min(100%,28rem)]"
        >
          <span className="sr-only">
            {shadowMode ? "Mode boutique de l&apos;ombre activé" : "Mode boutique réelle"}
          </span>
          <span
            className={`relative z-[1] flex flex-1 items-center justify-center gap-2 rounded-[0.875rem] py-3 text-[13px] font-semibold transition-colors ${
              !shadowMode
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-500 group-hover:text-slate-700"
            }`}
          >
            <Eye className="h-4 w-4 opacity-95" aria-hidden strokeWidth={2} />
            Boutique réelle
          </span>
          <span
            className={`relative z-[1] flex flex-1 items-center justify-center gap-2 rounded-[0.875rem] py-3 text-[13px] font-semibold transition-colors ${
              shadowMode
                ? "bg-purple-950 text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] ring-2 ring-purple-700/95"
                : "text-slate-500 group-hover:text-slate-700"
            }`}
          >
            <Skull className="h-4 w-4 text-violet-200" aria-hidden strokeWidth={2} />
            Boutique de l&apos;ombre
          </span>
        </button>
      </div>

      {shadowMode && (
        <div className="rounded-[1.5rem] border border-zinc-800/90 bg-gradient-to-b from-[#09090f] via-[#0e0e16] to-[#050508] p-6 text-zinc-100 shadow-[0_50px_100px_-40px_rgba(0,0,0,.75)] ring-1 ring-white/[0.05] md:p-8 md:py-10">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center gap-3 py-14 text-zinc-400">
              <Loader2 className="h-9 w-9 animate-spin text-violet-400" />
              <span className="text-sm font-medium">Invocation des données fantômes…</span>
            </div>
          ) : error ? (
            <p className="py-14 text-center text-sm text-red-400">{error}</p>
          ) : metrics ? (
            <>
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.07] pb-8">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-violet-300/95">
                    Shadow dashboard
                  </p>
                  <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-zinc-400">
                    Synthèses sur jusqu&apos;à <strong className="text-zinc-200">2500 événements</strong> récents
                    (suppressions ligne + paniers vidés). Les montants proviennent de{" "}
                    <code className="rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-violet-200">
                      valeur_perdue
                    </code>{" "}
                    et du manifest JSON pour les vidages complets.
                  </p>
                </div>
                <div className="flex gap-6 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <span>
                    suppressions:&nbsp;
                    <strong className="text-zinc-300">{metrics.nbSuppressionsPanier}</strong>
                  </span>
                  <span>
                    vidages:&nbsp;
                    <strong className="text-zinc-300">{metrics.nbAnnulationsVente}</strong>
                  </span>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <KPICard
                  icon={<ShoppingCart className="h-8 w-8 text-emerald-300/95" />}
                  label="CA fantôme total"
                  value={
                    metrics.caFantomeTotalEUR > 0
                      ? formatShadowEUR(metrics.caFantomeTotalEUR)
                      : "—"
                  }
                  hint="Σ annulations · suppressions (€ enregistrés)"
                  glow="emerald"
                />
                <KPICard
                  icon={<UserX className="h-8 w-8 text-amber-200/95" />}
                  label="Top vendeur de l&apos;ombre"
                  value={metrics.topVendeur?.nom ?? "—"}
                  sub={metrics.topVendeur ? formatShadowEUR(metrics.topVendeur.montantEUR) : undefined}
                  hint="Plus gros cumul financier d&apos;écarts détectés"
                  glow="amber"
                />
                <KPICard
                  icon={<Trophy className="h-8 w-8 text-rose-200/95" />}
                  label="Top produit fantôme"
                  value={
                    metrics.topProduit?.label.slice(0, 80) ??
                    "—"
                  }
                  sub={metrics.topProduit ? `${metrics.topProduit.count} événements` : undefined}
                  hint="Article le plus retiré des paniers"
                  glow="rose"
                />
              </div>

              <div className="mt-14">
                <h3 className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-zinc-500">
                  <EyeOff className="h-4 w-4 text-zinc-500" aria-hidden strokeWidth={2} />
                  Tickets fantômes (paniers entièrement annulés)
                </h3>
                <GhostTicketsTable tickets={metrics.ghostTickets} formatDt={formatDt} />
              </div>
            </>
          ) : (
            <p className="py-14 text-center text-sm text-zinc-500">
              Pas de données d&apos;ombre à afficher.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  sub,
  hint,
  glow,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  hint: string;
  glow: "emerald" | "amber" | "rose";
}) {
  const ring =
    glow === "emerald"
      ? "shadow-[0_0_42px_-12px_rgba(52,211,153,.42)] ring-emerald-500/15"
      : glow === "amber"
        ? "shadow-[0_0_42px_-12px_rgba(251,191,36,.35)] ring-amber-400/14"
        : "shadow-[0_0_42px_-12px_rgba(244,114,182,.35)] ring-rose-400/13";

  return (
    <article
      className={`rounded-2xl border border-white/[0.07] bg-zinc-950/60 p-6 ring-1 backdrop-blur-sm ${ring}`}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 opacity-95">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold tracking-tight text-white md:text-2xl">
            {value}
          </p>
          {sub && (
            <p className="mt-2 text-[13px] font-semibold tabular-nums text-violet-200/95">{sub}</p>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">{hint}</p>
        </div>
      </div>
    </article>
  );
}

function GhostTicketsTable({
  tickets,
  formatDt,
}: {
  tickets: ShadowGhostTicketRow[];
  formatDt: (iso: string) => string;
}) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700/80 px-8 py-16 text-center text-sm text-zinc-500">
        Aucun panier vidé enregistré dans la fenêtre chargée — quand une vendeuse annule tout le
        panier, une ligne ticket fantôme apparaît ici avec le montant total perdu et les lignes
        reconstituées.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-black/55 ring-1 ring-white/[0.04]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-zinc-950/90 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              <th className="whitespace-nowrap px-5 py-4">Ticket fantôme</th>
              <th className="whitespace-nowrap px-5 py-4">Moment</th>
              <th className="whitespace-nowrap px-5 py-4">Vendeuse</th>
              <th className="whitespace-nowrap px-5 py-4 text-right">Valeur TTC perdue</th>
              <th className="min-w-[260px] px-5 py-4">Panier reconstitué</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] bg-black/35">
            {tickets.map((t) => (
              <tr
                key={t.id}
                className="transition-colors hover:bg-white/[0.03] [&>td]:align-top [&>td]:py-4"
              >
                <td className="px-5 font-mono text-[11px] text-zinc-500">{t.id.slice(0, 8)}…</td>
                <td className="whitespace-nowrap px-5 tabular-nums text-[13px] text-zinc-300">
                  {formatDt(t.created_at)}
                </td>
                <td className="px-5 text-[13px] font-medium text-zinc-100">{t.vendeur_nom}</td>
                <td className="whitespace-nowrap px-5 text-right text-[14px] font-bold tabular-nums text-emerald-200/95">
                  {formatShadowEUR(t.valeur)}
                </td>
                <td className="max-w-xl px-5 text-[12px] leading-relaxed text-zinc-400">
                  {t.lignesRésumé}
                  {t.manifest?.lignes?.length ? (
                    <details className="mt-3 group">
                      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-violet-300/95 outline-none [&::-webkit-details-marker]:hidden">
                        JSON lignes ({t.manifest.lignes.length})
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-lg border border-white/[0.08] bg-black/60 p-3 text-[10px] text-zinc-400">
                        {JSON.stringify(t.manifest.lignes, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
