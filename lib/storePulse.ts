/**
 * Pulse « storefront » pour la visualisation Activité du jour — types hors page React pour éviter les imports circulaires.
 */

export type StorePulseWaveKind =
  | "scan"
  | "encaissement"
  | "annulation"
  | "anomalie";

export type StorePulseWaveEntry = {
  id: string;
  created_at: string;
  kind: StorePulseWaveKind;
  /** EUR si encaissement */
  amountEUR?: number;
  labelShort: string;
  ariaAction: string;
};

/** Ligne journale minimale nécessaire pour mapper une barre. */
export type LogActivitePulseInput = {
  id: string;
  created_at: string;
  type_action: string;
  details: string | null;
  niveau_alerte: string;
};

const EUR_DETAIL_RE = /(\d+(?:[.,]\d+)?)\s*€|€\s*(\d+(?:[.,]\d+)?)/i;

export function parseEncaissementEUR(details: string | null): number | undefined {
  if (!details) return undefined;
  const m = EUR_DETAIL_RE.exec(details);
  if (!m) return undefined;
  const raw = (m[1] ?? m[2] ?? "").replace(",", ".");
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function inferWaveKind(
  log: Pick<LogActivitePulseInput, "type_action" | "niveau_alerte">
): StorePulseWaveKind {
  const t = log.type_action.toLowerCase().replace(/\s+/g, "_");
  const n = log.niveau_alerte.toLowerCase().trim();
  if (t.includes("encaissement")) return "encaissement";
  if (
    t.includes("annulation") ||
    t.includes("suppression_panier") ||
    t === "suppression_ligne_complete"
  ) {
    return "annulation";
  }
  if (t.includes("scan")) return "scan";
  if (n === "critique" || n === "warning") return "anomalie";
  return "scan";
}

export function mapLogActiviteToPulseEntry(log: LogActivitePulseInput): StorePulseWaveEntry {
  const kind = inferWaveKind(log);
  const amountEUR =
    kind === "encaissement" ? parseEncaissementEUR(log.details) : undefined;
  const actionLabel = humanizeAction(log.type_action);
  const heure = formatHeureMinuteISO(log.created_at);
  const emoji =
    kind === "annulation" || kind === "anomalie"
      ? "🚨"
      : kind === "encaissement"
        ? "✅"
        : "📷";

  return {
    id: log.id,
    created_at: log.created_at,
    kind,
    amountEUR,
    labelShort: `${heure} — ${emoji} ${actionLabel}`,
    ariaAction: actionLabel,
  };
}

function humanizeAction(type_action: string): string {
  const s = type_action.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatHeureMinuteISO(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${h}h${mm}`;
}

function formatHMDate(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Démo dense en scans avec pics rouges (annulations) et encaissements verts. */
export function generateStorePulseDemoEntries(): StorePulseWaveEntry[] {
  const rnd = seededRandom(202602291);
  const out: StorePulseWaveEntry[] = [];

  /** Fixe SSR / client : une journée de référence (Paris horaire système utilisée pour heures locales). */
  const opening = new Date(2026, 4, 2, 9, 32, 0, 0);

  /** ~9h30 → 18h55 */
  const openMs = opening.getTime();
  const closeMs =
    opening.getTime() + (9 * 60 + 23) * 60_000 + 45 * 60_000;
  const spanMs = Math.max(1, closeMs - openMs);

  /** Annulations stratégiques = « spikes » rouges dans la vague verte. */
  const annIndices = new Set([18, 19, 40, 41, 64, 65]);
  const saleIndices = new Set([12, 13, 24, 25, 36, 50, 51, 72, 73, 88, 89]);
  const warnIndices = new Set([54, 55, 92]);

  let seq = 0;
  const total = 86;
  const year = opening.getFullYear();
  const mon = opening.getMonth() + 1;
  const day = opening.getDate();

  for (let i = 0; i < total; i++) {
    const phase = openMs + (spanMs * i) / (total - 1) + rnd() * 22_000;
    const capped = Math.min(closeMs + 180_000, phase);
    const d = new Date(capped);

    let kind: StorePulseWaveKind = "scan";
    let amountEUR: number | undefined;
    let labelShort: string;
    let aria: string;

    if (annIndices.has(i)) {
      kind = "annulation";
      aria = "Vente annulée";
      labelShort = `${formatHMDate(d)} — 🚨 Vente annulée (panier)`;
    } else if (saleIndices.has(i)) {
      kind = "encaissement";
      amountEUR = Math.round((48 + rnd() * 312) * 100) / 100;
      aria = "Encaissement";
      labelShort = `${formatHMDate(d)} — ✅ Encaissement (${amountEUR.toFixed(2)} €)`;
    } else if (warnIndices.has(i)) {
      kind = "anomalie";
      aria = "Anomalie";
      labelShort = `${formatHMDate(d)} — ⚠️ Alerte niveau suspicion`;
    } else {
      aria = "Scan";
      labelShort = `${formatHMDate(d)} — 📷 Scan EAN`;
    }

    out.push({
      id: `${year}${mon}-${day}-pulse-demo-${seq++}`,
      created_at: d.toISOString(),
      kind,
      amountEUR,
      labelShort,
      ariaAction: aria,
    });
  }

  out.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return out;
}

function seededRandom(seed: number) {
  let t = seed >>> 0;
  return (): number => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hauteurs en px (alignées Tailwind équivalences : scan≈16, vente scalable). */
export function pulseBarVisualHeight(kind: StorePulseWaveKind, amountEUR?: number): number {
  if (kind === "scan") return 16;
  if (kind === "annulation" || kind === "anomalie") return 64;
  const amt =
    typeof amountEUR === "number" && Number.isFinite(amountEUR) ? amountEUR : 60;
  const scaled = 52 + amt * 0.18 + 34;
  return Math.round(Math.min(118, Math.max(48, scaled)));
}
