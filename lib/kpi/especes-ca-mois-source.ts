/** Source distante pour le CA Espèces (mois KPI) affiché dans le donut admin. */
export const ESPECES_CA_MOIS_KPIS_URL =
  "https://latifa-shopping.vercel.app/kkkvvvhhh";

/**
 * Fallback demandé lorsque la source ne renvoie pas un montant lisible :
 * entier pseudo-aléatoire entre 150 et 200 inclus.
 */
export function randomEspecesCaMoisFallback(): number {
  return Math.floor(Math.random() * (200 - 150 + 1)) + 150;
}

function parseNombreDepuisPayload(data: unknown): number | null {
  if (typeof data === "number" && Number.isFinite(data) && data >= 0) return data;
  if (typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>;
    for (const k of [
      "montant_especes",
      "ca_especes",
      "caEspeces",
      "value",
      "amount",
      "euros",
    ]) {
      const v = o[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
      if (typeof v === "string") {
        const n = Number.parseFloat(v.replace(",", "."));
        if (Number.isFinite(n) && n >= 0) return n;
      }
    }
  }
  return null;
}

function parseNombreDepuisTexteBrut(text: string): number | null {
  const trimmed = text.trim();
  const direct = Number.parseFloat(trimmed.replace(",", "."));
  if (Number.isFinite(direct) && direct >= 0 && direct < 1e12) return direct;
  const match = trimmed.match(/\d+(?:[.,]\d{1,2})?/);
  if (match) {
    const n = Number.parseFloat(match[0].replace(",", "."));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Récupère le montant CA Espèces pour le donut (priorité au contenu renvoyé par l’URL).
 * Si HTTP JSON ou corps texte = nombre lisible → utilisé ; sinon fallback aléatoire 150–200.
 */
export async function fetchCaEspecesMoisPourDonut(): Promise<number> {
  try {
    const res = await fetch(ESPECES_CA_MOIS_KPIS_URL, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json,text/plain,text/html,*/*" },
    });
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("application/json")) {
      const json: unknown = await res.json();
      const n = parseNombreDepuisPayload(json);
      if (n != null) return Math.round(n * 100) / 100;
    }
    const text = await res.text();
    if (/^\s*</.test(text) || /<\s*html[\s>]/i.test(text)) {
      /* Page HTML serveur commerce (sans endpoint JSON brut) → fallback demandé */
    } else {
      const fromText = parseNombreDepuisTexteBrut(text);
      if (fromText != null) return Math.round(fromText * 100) / 100;
    }
  } catch {
    // ignore → fallback
  }
  return randomEspecesCaMoisFallback();
}
