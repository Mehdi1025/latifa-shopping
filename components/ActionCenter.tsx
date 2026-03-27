"use client";

import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, Loader2 } from "lucide-react";
import type { AlertItem } from "@/hooks/useAlerts";

type ActionCenterProps = {
  alerts: AlertItem[];
  loading?: boolean;
  /** Titre du panneau (admin : complet, vendeuse : plus discret). */
  title?: string;
  /** full = carte large avec sous-titre ; compact = bandeau dense pour caisse. */
  variant?: "full" | "compact";
  className?: string;
};

export default function ActionCenter({
  alerts,
  loading = false,
  title = "Problèmes & Actions",
  variant = "full",
  className = "",
}: ActionCenterProps) {
  const isCompact = variant === "compact";

  return (
    <section
      className={[
        "rounded-[1.35rem] border border-white/60 bg-white/70 shadow-[0_8px_40px_-16px_rgba(0,0,0,0.12)] backdrop-blur-xl backdrop-saturate-150",
        isCompact ? "p-4" : "p-5 sm:p-6",
        className,
      ].join(" ")}
      aria-label="Centre d'alertes"
    >
      <div
        className={[
          "flex items-baseline justify-between gap-3",
          isCompact ? "mb-3" : "mb-4",
        ].join(" ")}
      >
        <h2 className="text-sm font-semibold tracking-tight text-gray-900 sm:text-base">
          {title}
        </h2>
        {!loading && alerts.length > 0 && (
          <span className="rounded-full bg-gray-900/5 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-gray-500">
            {alerts.length}
          </span>
        )}
      </div>

      {!isCompact && (
        <p className="mb-4 text-xs text-gray-400">
          Alertes issues du stock et des échéances.
        </p>
      )}

      {loading ? (
        <div className="flex min-h-[88px] items-center justify-center gap-2 rounded-2xl bg-gray-50/80 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className="text-sm text-gray-400">Analyse…</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-emerald-100/80 bg-emerald-50/40 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600/90" aria-hidden />
          <p className="text-sm font-medium text-emerald-900/80">
            Aucune alerte — tout est sous contrôle.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <div
                className={[
                  "flex flex-col gap-3 rounded-2xl border border-gray-100/90 bg-gray-50/40 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                  isCompact ? "sm:p-3" : "",
                ].join(" ")}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gray-100"
                    aria-hidden
                  >
                    {alert.severity === "danger" ? (
                      <AlertTriangle className="h-5 w-5 text-red-500" strokeWidth={2} />
                    ) : (
                      <Bell className="h-5 w-5 text-amber-500" strokeWidth={2} />
                    )}
                  </span>
                  <p className="min-w-0 text-sm font-semibold leading-snug text-gray-900">
                    {alert.message}
                  </p>
                </div>
                <Link
                  href={alert.href}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 active:scale-[0.98] sm:self-center"
                >
                  {alert.actionLabel}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
