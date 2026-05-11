"use server";

/**
 * Client Bridge côté serveur uniquement (secrets jamais exposés au navigateur).
 * Appeler depuis Server Actions, Route Handlers ou Server Components — pas depuis un composant client.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return String(v).trim();
}

function bridgeBaseUrl(): string {
  return requireEnv("BRIDGE_API_URL").replace(/\/+$/, "");
}

function appPublicUrl(): string {
  return requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
}

type BridgeAuthResponse = {
  access_token?: string;
};

type BridgeConnectItemResponse = {
  redirect_url?: string;
  url?: string;
  connect_url?: string;
};

/**
 * POST ${BRIDGE_API_URL}/authenticate
 * En-têtes exacts : Client-Id, Client-Secret, Content-Type.
 */
export async function getBridgeToken(): Promise<string> {
  const base = bridgeBaseUrl();
  const clientId = requireEnv("BRIDGE_CLIENT_ID");
  const clientSecret = requireEnv("BRIDGE_CLIENT_SECRET");

  const res = await fetch(`${base}/authenticate`, {
    method: "POST",
    headers: {
      "Client-Id": clientId,
      "Client-Secret": clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  let data: BridgeAuthResponse = {};
  try {
    data = (await res.json()) as BridgeAuthResponse;
  } catch {
    // corps non JSON
  }

  if (!res.ok) {
    throw new Error(
      `Bridge authenticate (${res.status}): ${JSON.stringify(data) || res.statusText}`
    );
  }

  const token = data.access_token;
  if (!token) {
    throw new Error(
      "Bridge authenticate : access_token absent dans la réponse."
    );
  }

  return token;
}

/**
 * Initie une connexion type Connect (nouvel item).
 * POST ${BRIDGE_API_URL}/items avec Bearer token.
 *
 * Selon votre version Bridge, l’endpoint réel peut différer (ex. `/connect/items/add`) :
 * préfixez l’URL de base dans `BRIDGE_API_URL` ou adaptez le chemin ci-dessous.
 */
export async function createConnectUrl(accessToken: string): Promise<string> {
  const base = bridgeBaseUrl();
  const origin = appPublicUrl();
  const redirectUrl = `${origin}/dashboard/finance/callback`;

  const connectPath = `${base}/items`;

  const res = await fetch(connectPath, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ redirect_url: redirectUrl }),
    cache: "no-store",
  });

  let data: BridgeConnectItemResponse = {};
  try {
    data = (await res.json()) as BridgeConnectItemResponse;
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new Error(
      `Bridge connect items (${res.status}): ${JSON.stringify(data) || res.statusText}`
    );
  }

  const url =
    data.redirect_url ?? data.url ?? data.connect_url ?? null;
  if (!url || typeof url !== "string") {
    throw new Error(
      "Bridge : URL de redirection absente (redirect_url / url / connect_url)."
    );
  }

  return url;
}
