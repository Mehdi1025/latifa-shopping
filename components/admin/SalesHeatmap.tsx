"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

import {
  HEATMAP_HOUR_START,
  HEATMAP_NUM_HOURS,
  type HeatmapCellData,
  type SalesHeatmapPayload,
} from "@/lib/server/sales-heatmap";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;
const DAY_NAMES_LONG = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

function emptyMatrix(): HeatmapCellData[][] {
  return Array.from({ length: 7 }, () =>
    Array.from({ length: HEATMAP_NUM_HOURS }, () => ({
      count: 0,
      caTotal: 0,
      caMoyenne: 0,
      isPeak: false,
    }))
  );
}

function slotLabel(hourStart: number, hourIndex: number): string {
  const start = hourStart + hourIndex;
  return `${start}h-${start + 1}h`;
}

function axisHourLabel(hourStart: number, hourIndex: number): string {
  return `${hourStart + hourIndex}h`;
}

function cellClasses(count: number, maxCount: number): string {
  if (count === 0) {
    return "border border-slate-100 bg-slate-50";
  }
  if (maxCount <= 0) {
    return "border border-slate-100 bg-slate-50";
  }
  const ratio = count / maxCount;
  if (ratio < 0.25) return "bg-indigo-100";
  if (ratio < 0.5) return "bg-indigo-200";
  if (ratio < 0.75) return "bg-indigo-400";
  return "bg-indigo-600";
}

function formatEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function HeatmapSkeleton({ numHours }: { numHours: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy aria-live="polite">
      <div className="h-3 w-48 rounded-full bg-slate-200" />
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `2.75rem repeat(${numHours}, minmax(1.35rem, 1.5rem))`,
        }}
      >
        {Array.from({ length: 7 * (numHours + 1) }, (_, i) => (
          <div key={i} className="h-6 rounded-sm bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

type GridProps = {
  matrix: HeatmapCellData[][];
  hourStart: number;
  numHours: number;
  maxCount: number;
};

function HeatmapGrid({ matrix, hourStart, numHours, maxCount }: GridProps) {
  return (
    <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className="inline-grid min-w-full gap-y-1.5"
        style={{
          gridTemplateColumns: `minmax(2rem,2.75rem) repeat(${numHours}, minmax(1.35rem, 1.5rem))`,
        }}
      >
        <div aria-hidden className="min-h-[1rem]" />

        {Array.from({ length: numHours }, (_, h) => (
          <div
            key={`h-${h}`}
            className="flex justify-center text-[10px] font-medium tabular-nums text-neutral-400"
          >
            {axisHourLabel(hourStart, h)}
          </div>
        ))}

        {matrix.map((row, d) => (
          <div key={d} className="contents">
            <div className="flex items-center pr-1 text-[10px] font-medium text-neutral-400">
              {DAY_LABELS[d]}
            </div>
            {row.map((cell, h) => {
              const slot = slotLabel(hourStart, h);
              const dayName = DAY_NAMES_LONG[d];
              const hourLabel = `${hourStart + h}h`;
              const saleLabel = cell.count === 1 ? "1 vente" : `${cell.count} ventes`;
              const title =
                cell.count === 0
                  ? `${dayName} ${slot} — aucune vente`
                  : `${saleLabel} le ${dayName} à ${hourLabel}`;

              return (
                <div
                  key={`c-${d}-${h}`}
                  className="group relative flex items-center justify-center py-0.5"
                >
                  <div
                    className={`h-6 w-6 shrink-0 rounded-sm transition-transform duration-200 group-hover:z-10 group-hover:scale-110 group-hover:ring-2 group-hover:ring-indigo-200/80 ${cellClasses(cell.count, maxCount)} ${cell.isPeak ? "ring-1 ring-amber-400/80" : ""}`}
                    title={title}
                    role="img"
                    aria-label={title}
                  />
                  <div
                    className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-neutral-200/90 bg-white px-3 py-2 text-left text-[11px] leading-snug text-neutral-700 opacity-0 shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-opacity duration-150 group-hover:opacity-100"
                    role="tooltip"
                  >
                    {cell.count === 0 ? (
                      <>
                        <span className="font-medium text-neutral-900">
                          {dayName} {slot}
                        </span>
                        <span className="mt-0.5 block text-neutral-500">Aucune vente</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-neutral-900">
                          {saleLabel} le {dayName} à {hourLabel}
                        </span>
                        {cell.caMoyenne > 0 ? (
                          <span className="mt-0.5 block tabular-nums text-neutral-600">
                            Panier moyen : {formatEUR(cell.caMoyenne)}
                          </span>
                        ) : null}
                        {cell.isPeak ? (
                          <span className="mt-1 block font-semibold text-amber-700">
                            Créneau le plus actif (30 j.)
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SalesHeatmap() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [payload, setPayload] = useState<SalesHeatmapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/kpi/sales-heatmap", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await res.json()) as SalesHeatmapPayload & { error?: string };
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Chargement impossible.");
        setPayload(null);
        return;
      }
      setPayload(body);
    } catch {
      setError("Impossible de charger la heatmap.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Rafraîchit la heatmap dès qu'une vente est encaissée en caisse. */
  useEffect(() => {
    const channel = supabase
      .channel("heatmap-ventes-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ventes" },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const hourStart = payload?.hourStart ?? HEATMAP_HOUR_START;
  const numHours = payload?.numHours ?? HEATMAP_NUM_HOURS;
  const matrix = payload?.matrix ?? emptyMatrix();
  const maxCount = payload?.maxCount ?? 0;
  const totalSales = payload?.totalSales ?? 0;

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Météo des ventes (30 derniers jours · caisse live)
        </p>
        {payload && !loading ? (
          <p className="text-[10px] tabular-nums text-neutral-400">
            {totalSales} vente{totalSales > 1 ? "s" : ""} · fuseau Europe/Paris
          </p>
        ) : null}
      </div>

      {loading ? (
        <HeatmapSkeleton numHours={numHours} />
      ) : error ? (
        <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : (
        <>
          {totalSales === 0 ? (
            <div className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-center">
              <p className="text-sm font-medium text-slate-700">En attente de données de caisse</p>
              <p className="mt-1 text-xs text-slate-500">
                Encaissez une vente depuis l&apos;espace Vendeuse — la carte s&apos;actualisera
                automatiquement.
              </p>
            </div>
          ) : null}

          <HeatmapGrid
            matrix={matrix}
            hourStart={hourStart}
            numHours={numHours}
            maxCount={maxCount}
          />

          <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm border border-slate-100 bg-slate-50" />
              Vide
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm bg-indigo-100" />
              Faible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm bg-indigo-200" />
              Modéré
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm bg-indigo-400" />
              Élevé
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-sm bg-indigo-600" />
              Fort
            </span>
          </div>
        </>
      )}
    </div>
  );
}
