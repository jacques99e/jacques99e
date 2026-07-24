import { createHmac } from "crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

export function metaAppCredentials() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return null;
  }
  return { appId, appSecret };
}

export function appPublicUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://app.wazo-digital.com"
  );
}

/**
 * Callback OAuth sur le domaine racine (Landing).
 * Meta refuse souvent le sous-domaine app.* s'il n'est pas bien déclaré ;
 * Landing proxifie vers l'app ensuite.
 */
export function metaOAuthRedirectUri() {
  const override = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (override) return override.replace(/\/$/, "");
  const landing =
    process.env.NEXT_PUBLIC_LANDING_URL?.trim().replace(/\/$/, "") ||
    "https://wazo-digital.com";
  return `${landing}/api/social/meta/callback`;
}

export function buildMetaOAuthUrl(state: string) {
  const creds = metaAppCredentials();
  if (!creds) return null;
  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_metadata",
    "pages_manage_posts",
    "business_management",
  ].join(",");
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", creds.appId);
  url.searchParams.set("redirect_uri", metaOAuthRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  return url.toString();
}

export async function exchangeCodeForUserToken(code: string) {
  const creds = metaAppCredentials();
  if (!creds) throw new Error("META_APP_ID / META_APP_SECRET manquants");
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", creds.appId);
  url.searchParams.set("client_secret", creds.appSecret);
  url.searchParams.set("redirect_uri", metaOAuthRedirectUri());
  url.searchParams.set("code", code);
  const res = await fetch(url);
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || "Échange code Meta impossible");
  }
  return data;
}

export async function exchangeLongLivedUserToken(shortToken: string) {
  const creds = metaAppCredentials();
  if (!creds) throw new Error("META_APP_ID / META_APP_SECRET manquants");
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", creds.appId);
  url.searchParams.set("client_secret", creds.appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url);
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message || "Jeton longue durée impossible");
  }
  return data;
}

export interface MetaPageAccount {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

export async function listManagedPages(userToken: string): Promise<MetaPageAccount[]> {
  const url = new URL(`${GRAPH}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account"
  );
  url.searchParams.set("access_token", userToken);
  const res = await fetch(url);
  const data = (await res.json()) as {
    data?: MetaPageAccount[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(data.error?.message || "Liste Pages impossible");
  return data.data || [];
}

export async function publishPageFeed(options: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  link?: string;
}) {
  const url = new URL(`${GRAPH}/${options.pageId}/feed`);
  const body = new URLSearchParams({
    message: options.message,
    access_token: options.pageAccessToken,
  });
  if (options.link) body.set("link", options.link);
  const res = await fetch(url, { method: "POST", body });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Publication Facebook impossible");
  }
  return { id: data.id };
}

export async function publishInstagramPhoto(options: {
  igUserId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
}) {
  const createUrl = new URL(`${GRAPH}/${options.igUserId}/media`);
  createUrl.searchParams.set("image_url", options.imageUrl);
  createUrl.searchParams.set("caption", options.caption);
  createUrl.searchParams.set("access_token", options.pageAccessToken);
  const created = await fetch(createUrl.toString(), { method: "POST" });
  const createdData = (await created.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!created.ok || !createdData.id) {
    throw new Error(createdData.error?.message || "Container Instagram impossible");
  }

  for (let i = 0; i < 12; i++) {
    const statusUrl = new URL(`${GRAPH}/${createdData.id}`);
    statusUrl.searchParams.set("fields", "status_code");
    statusUrl.searchParams.set("access_token", options.pageAccessToken);
    const st = await (await fetch(statusUrl)).json() as {
      status_code?: string;
      error?: { message?: string };
    };
    if (st.error) throw new Error(st.error.message || "Statut IG");
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR") throw new Error("Container Instagram ERROR");
    await new Promise((r) => setTimeout(r, 2500));
  }

  const pubUrl = new URL(`${GRAPH}/${options.igUserId}/media_publish`);
  pubUrl.searchParams.set("creation_id", createdData.id);
  pubUrl.searchParams.set("access_token", options.pageAccessToken);
  const published = await fetch(pubUrl.toString(), { method: "POST" });
  const pubData = (await published.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!published.ok || !pubData.id) {
    throw new Error(pubData.error?.message || "Publication Instagram impossible");
  }
  return { id: pubData.id };
}

/** Encode state OAuth (storeId|userId|nonce|sig) */
export function signOAuthState(storeId: string, userId: string) {
  const secret = process.env.META_APP_SECRET?.trim() || "wazo";
  const nonce = Math.random().toString(36).slice(2, 10);
  const payload = `${storeId}.${userId}.${nonce}.${Date.now()}`;
  const sig = simpleHmac(payload, secret);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyOAuthState(state: string): { storeId: string; userId: string } | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length < 5) return null;
    const [storeId, userId, nonce, ts, sig] = parts;
    const secret = process.env.META_APP_SECRET?.trim() || "wazo";
    const payload = `${storeId}.${userId}.${nonce}.${ts}`;
    if (simpleHmac(payload, secret) !== sig) return null;
    const age = Date.now() - Number(ts);
    if (!Number.isFinite(age) || age > 30 * 60 * 1000) return null;
    return { storeId, userId };
  } catch {
    return null;
  }
}

function simpleHmac(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}
