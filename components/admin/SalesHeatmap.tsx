"use client";

import { useMemo } from "react";

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
/** Créneaux 10h–11h … 18h–19h (9 colonnes, boutique 10h–19h) */
const HOUR_START = 10;
const NUM_HOURS = 9;

/** Pseudo-aléatoire déterministe (pas de décalage SSR / client). */
function cellNoise(day: number, hour: number): number {
  const n = Math.sin(day * 12.9898 + hour * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export type HeatmapCell = {
  value: number;
  eurosMoyenne: number;
  isHeureOr: boolean;
};

function buildMockMatrix(): HeatmapCell[][] {
  const sat = 5; // Samedi
  const rows: HeatmapCell[][] = [];

  for (let d = 0; d < 7; d++) {
    const row: HeatmapCell[] = [];
    for (let h = 0; h < NUM_HOURS; h++) {
      const noise = cellNoise(d, h);
      let value = Math.floor(12 + noise * 38);

      // Samedi après-midi : pic (14h–17h → indices 4–6)
      if (d === sat && h >= 4 && h <= 6) {
        value = Math.floor(72 + noise * 28);
      }
      // Heure d'or : 15h–16h (indice 5)
      const isHeureOr = d === sat && h === 5;
      if (isHeureOr) {
        value = Math.floor(92 + noise * 8);
      }

      // Quelques cases vides (boutique calme)
      if (noise < 0.07 && !isHeureOr && (d === 0 || d === 6)) {
        value = 0;
      }

      value = Math.min(100, Math.max(0, value));
      const eurosMoyenne = Math.round(40 + value * 9.2);

      row.push({ value, eurosMoyenne, isHeureOr });
    }
    rows.push(row);
  }
  return rows;
}

function slotLabel(hourIndex: number): string {
  const start = HOUR_START + hourIndex;
  const end = start + 1;
  return `${start}h-${end}h`;
}

function axisHourLabel(hourIndex: number): string {
  return `${HOUR_START + hourIndex}h`;
}

function cellClasses(value: number): string {
  if (value === 0) {
    return "border border-slate-100 bg-slate-50";
  }
  if (value < 30) {
    return "bg-emerald-100";
  }
  if (value < 65) {
    return "bg-emerald-300";
  }
  return "bg-emerald-600";
}

export function SalesHeatmap() {
  const matrix = useMemo(() => buildMockMatrix(), []);

  return (
    <div className="w-full">
      <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
        Météo des ventes (affluence moyenne)
      </p>

      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          className="inline-grid min-w-full gap-y-1.5"
          style={{
            gridTemplateColumns: `minmax(2rem,2.75rem) repeat(${NUM_HOURS}, minmax(1.35rem, 1.5rem))`,
          }}
        >
          {/* coin vide pour aligner axes */}
          <div aria-hidden className="min-h-[1rem]" />

          {Array.from({ length: NUM_HOURS }, (_, h) => (
            <div
              key={`h-${h}`}
              className="flex justify-center text-[10px] font-medium tabular-nums text-slate-400"
            >
              {axisHourLabel(h)}
            </div>
          ))}

          {matrix.map((row, d) => (
            <div key={d} className="contents">
              <div className="flex items-center pr-1 text-[10px] font-medium text-slate-400">
                {DAY_LABELS[d]}
              </div>
              {row.map((cell, h) => {
                const slot = slotLabel(h);
                const dayName = DAY_NAMES_LONG[d];

                const title =
                  cell.value === 0
                    ? `${dayName} ${slot} — faible affluence`
                    : cell.isHeureOr
                      ? `🔥 ${dayName} ${slot} : Heure d'Or (moyenne : ${cell.eurosMoyenne}€)`
                      : `${dayName} ${slot} — moyenne : ${cell.eurosMoyenne}€`;

                return (
                  <div
                    key={`c-${d}-${h}`}
                    className="group relative flex items-center justify-center py-0.5"
                  >
                    <div
                      className={`h-6 w-6 shrink-0 rounded-sm transition-transform duration-200 group-hover:z-10 group-hover:scale-110 group-hover:ring-2 group-hover:ring-slate-200/80 ${cellClasses(cell.value)}`}
                      title={title}
                      role="img"
                      aria-label={title}
                    />
                    <div
                      className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-left text-[11px] leading-snug text-slate-700 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
                      role="tooltip"
                    >
                      {cell.value === 0 ? (
                        <>
                          <span className="font-medium text-slate-900">
                            {dayName} {slot}
                          </span>
                          <span className="mt-0.5 block text-slate-500">
                            Affluence très faible
                          </span>
                        </>
                      ) : cell.isHeureOr ? (
                        <>
                          <span className="font-semibold text-emerald-700">
                            🔥 Heure d&apos;Or
                          </span>
                          <span className="mt-1 block text-slate-600">
                            {dayName} {slot}
                          </span>
                          <span className="mt-0.5 block tabular-nums text-slate-900">
                            Moyenne : {cell.eurosMoyenne}€
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-slate-900">
                            {dayName} {slot}
                          </span>
                          <span className="mt-0.5 block tabular-nums text-slate-600">
                            Moyenne : {cell.eurosMoyenne}€
                          </span>
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

      <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-sm border border-slate-100 bg-slate-50" />
          Vide
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-sm bg-emerald-100" />
          Faible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-sm bg-emerald-300" />
          Moyen
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-sm bg-emerald-600" />
          Fort
        </span>
      </div>
    </div>
  );
}
