/** Créneaux boutique : 9h–10h … 19h–20h (fuseau Europe/Paris). */
export const HEATMAP_HOUR_START = 9;
export const HEATMAP_NUM_HOURS = 11;

const PARIS_TZ = "Europe/Paris";

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export type HeatmapCellData = {
  count: number;
  caTotal: number;
  caMoyenne: number;
  isPeak: boolean;
};

export type SalesHeatmapPayload = {
  matrix: HeatmapCellData[][];
  maxCount: number;
  totalSales: number;
  hourStart: number;
  numHours: number;
  periodDays: number;
};

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

function parisDayHour(createdAt: string): { dayIndex: number; hour: number } | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PARIS_TZ,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const dayIndex = WEEKDAY_TO_INDEX[weekday];

  if (dayIndex === undefined || !Number.isFinite(hour)) return null;

  return { dayIndex, hour };
}

function roundEUR(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildSalesHeatmapMatrix(
  sales: { created_at: string; total: number | null }[],
  periodDays = 30
): SalesHeatmapPayload {
  const matrix = emptyMatrix();
  let totalSales = 0;
  let maxCount = 0;

  for (const sale of sales) {
    const slot = parisDayHour(sale.created_at);
    if (!slot) continue;

    const { dayIndex, hour } = slot;
    if (hour < HEATMAP_HOUR_START || hour >= HEATMAP_HOUR_START + HEATMAP_NUM_HOURS) {
      continue;
    }

    const hourIndex = hour - HEATMAP_HOUR_START;
    const cell = matrix[dayIndex][hourIndex];
    const amount = typeof sale.total === "number" && Number.isFinite(sale.total) ? sale.total : 0;

    cell.count += 1;
    cell.caTotal = roundEUR(cell.caTotal + amount);
    totalSales += 1;
  }

  let peakDay = -1;
  let peakHour = -1;

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < HEATMAP_NUM_HOURS; h++) {
      const cell = matrix[d][h];
      if (cell.count > 0) {
        cell.caMoyenne = roundEUR(cell.caTotal / cell.count);
      }
      if (cell.count > maxCount) {
        maxCount = cell.count;
        peakDay = d;
        peakHour = h;
      }
    }
  }

  if (peakDay >= 0 && peakHour >= 0 && maxCount > 0) {
    matrix[peakDay][peakHour].isPeak = true;
  }

  return {
    matrix,
    maxCount,
    totalSales,
    hourStart: HEATMAP_HOUR_START,
    numHours: HEATMAP_NUM_HOURS,
    periodDays,
  };
}

export function heatmapQueryFromDate(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
