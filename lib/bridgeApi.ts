"use server";

/**
 * Bridge API v3 — agrégation (OpenAPI 2025-01-15).
 *
 * Obligatoire sur chaque requête : `Client-Id`, `Client-Secret`, `Bridge-Version`,
 * ainsi que `Authorization: Bearer` quand la doc Bridge l’exige.
 *
 * Flux : utilisateur agrégé → POST /users → POST /authorization/token → connect-sessions → callback.
 */

import {
  bridgeAggregationJsonPostHeaders,
  bridgeAggregationRoot,
} from "@/lib/server/bridge-aggregator";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return String(v).trim();
}

function appPublicUrl(): string {
  return requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
}

/** Identité Bridge stable (une par boutique multi-admin). Obligatoire en prod sérieux ; défaut bac à sable. */
function aggregationExternalUserId(): string {
  const v = process.env.BRIDGE_EXTERNAL_USER_ID?.trim();
  if (v) return v;
  return "latifa-finance-shop";
}

async function parseJsonUnknown(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function formatBridgeApiError(kind: string, status: number, body: unknown, statusText?: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "errors" in body &&
    Array.isArray((body as { errors: unknown }).errors)
  ) {
    const rows = (body as { errors: { message?: string; code?: string }[] }).errors;
    const parts = rows
      .map((e) =>
        typeof e.message === "string" && e.message.trim()
          ? e.message.trim()
          : typeof e.code === "string"
            ? e.code
            : ""
      )
      .filter(Boolean);
    if (parts.length > 0) return `Bridge ${kind} (${status}): ${parts.join(" — ")}`;
  }
  const raw =
    typeof body === "object" && body !== null
      ? JSON.stringify(body).slice(0, 400)
      : String(body).slice(0, 120);
  return `Bridge ${kind} (${status}): ${raw || statusText || ""}`;
}

async function ensureBridgeAggregationUser(externalUserId: string): Promise<void> {
  const root = bridgeAggregationRoot();
  const res = await fetch(`${root}/users`, {
    method: "POST",
    headers: bridgeAggregationJsonPostHeaders(undefined),
    body: JSON.stringify({ external_user_id: externalUserId }),
    cache: "no-store",
  });

  const body = await parseJsonUnknown(res);

  /** 409 = utilisateur déjà créé avec cet external_user_id. */
  if (res.ok || res.status === 409) return;

    throw new Error(formatBridgeApiError("aggregation/users", res.status, body, res.statusText));
}

type BridgeAuthTokenResponse = {
  access_token?: string;
};

type BridgeConnectSessionResponse = {
  url?: string;
  redirect_url?: string;
  connect_url?: string;
};

/**
 * Jeton Bearer émis pour l’utilisateur agrégé (valide ~2 h).
 * Compatible avec GET /aggregation/accounts, connect-sessions, etc.
 */
export async function getBridgeToken(): Promise<string> {
  const externalUserId = aggregationExternalUserId();
  await ensureBridgeAggregationUser(externalUserId);

  const root = bridgeAggregationRoot();
  const res = await fetch(`${root}/authorization/token`, {
    method: "POST",
    headers: bridgeAggregationJsonPostHeaders(undefined),
    body: JSON.stringify({ external_user_id: externalUserId }),
    cache: "no-store",
  });

  let data: BridgeAuthTokenResponse = {};
  try {
    data = (await res.json()) as BridgeAuthTokenResponse;
  } catch {
    //
  }

  if (!res.ok) {
    const bodyUnknown: unknown = data;
    throw new Error(
      formatBridgeApiError(
        "aggregation/authorization/token",
        res.status,
        bodyUnknown,
        res.statusText
      )
    );
  }

  const token = data.access_token?.trim();
  if (!token) {
    throw new Error("Bridge : access_token absent dans la réponse du jeton utilisateur.");
  }

  return token;
}

/**
 * Crée une session Bridge Connect ; retourne l’URL à ouvrir côté navigateur.
 *
 * `user_email` est exigée par Bridge (contact utilisateur) — idéalement l’email admin Supabase.
 */
export async function createConnectUrl(accessToken: string, userEmail: string): Promise<string> {
  const email = typeof userEmail === "string" ? userEmail.trim() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email invalide ou vide pour créer une session Bridge Connect.");
  }

  const root = bridgeAggregationRoot();
  const origin = appPublicUrl();
  const callbackUrl = `${origin}/dashboard/finance/callback`;
  const countryCode = process.env.BRIDGE_CONNECT_COUNTRY_CODE?.trim() || "FR";

  const res = await fetch(`${root}/connect-sessions`, {
    method: "POST",
    headers: bridgeAggregationJsonPostHeaders(accessToken),
    body: JSON.stringify({
      user_email: email,
      callback_url: callbackUrl,
      country_code: countryCode,
      capabilities: ["aggregation"],
      account_types: "payment",
    }),
    cache: "no-store",
  });

  let data: BridgeConnectSessionResponse = {};
  try {
    data = (await res.json()) as BridgeConnectSessionResponse;
  } catch {
    //
  }

  const statusOk = res.status === 200 || res.status === 201;
  if (!statusOk) {
    const bodyUnknown: unknown = data;
    throw new Error(
      formatBridgeApiError(
        "aggregation/connect-sessions",
        res.status,
        bodyUnknown,
        res.statusText
      )
    );
  }

  const url =
    typeof data.url === "string"
      ? data.url.trim()
      : typeof data.redirect_url === "string"
        ? data.redirect_url.trim()
        : typeof data.connect_url === "string"
          ? data.connect_url.trim()
          : null;

  if (!url) {
    throw new Error("Bridge Connect : aucune URL dans la réponse (champ attendu « url »).");
  }

  return url;
}
