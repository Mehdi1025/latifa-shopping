/**
 * Replay rrweb jugé exploitable dans le VAR (timeline > 0s).
 * Aligne le filtre appliqué avec la colonne `replay_span_ms` (migration Postgres).
 */

export const MIN_RRWEB_EVENTS = 2;

/** Δ ms entre le timestamp min et max des événements (robuste si l’ordre du tableau vary). */
export function rrwebEventsSpanMs(events: unknown[]): number {
  if (!Array.isArray(events) || events.length === 0) return 0;

  let minT = Infinity;
  let maxT = -Infinity;
  let seen = false;

  for (const raw of events) {
    if (raw === null || typeof raw !== "object") continue;
    const t = (raw as { timestamp?: unknown }).timestamp;
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    seen = true;
    minT = Math.min(minT, t);
    maxT = Math.max(maxT, t);
  }

  if (!seen || minT === Infinity) return 0;
  return Math.max(0, maxT - minT);
}

/**
 * Timeline rrweb perceptible (> 500 ms environ) ; évite lecteurs « 0 s ».
 * À garder en phase avec `.gte(\"replay_span_ms\", …)` dans l’admin.
 */
export const MIN_RRWEB_REPLAY_SPAN_MS = 500;

export function isMeaningfulRrwebReplay(
  events: unknown | null | undefined
): events is unknown[] {
  if (!Array.isArray(events)) return false;
  if (events.length < MIN_RRWEB_EVENTS) return false;
  return rrwebEventsSpanMs(events) >= MIN_RRWEB_REPLAY_SPAN_MS;
}
