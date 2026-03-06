import { getTokens, upsertTokens } from "../auth/sessionStore.js";
import { refreshAccessToken } from "../auth/spotifyOAuth.js";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export async function getValidAccessToken(): Promise<string> {
  const t = getTokens();
  if (!t) throw new Error("Not authenticated");

  // refresh 30s early
  if (Date.now() > t.expires_at_ts_ms - 30_000) {
    const tokenRes = await refreshAccessToken(t.refresh_token);
    const expiresAt = Date.now() + tokenRes.expires_in * 1000;
    upsertTokens({
      access_token: tokenRes.access_token,
      refresh_token: t.refresh_token,
      expires_at_ts_ms: expiresAt
    });
    return tokenRes.access_token;
  }
  return t.access_token;
}

export async function spotifyFetch<T = any>(
  path: string,
  method: string,
  body?: any
): Promise<T> {
  // ---- keep your existing token logic here ----
  // example:
  // const accessToken = await getValidAccessToken(req);
  // --------------------------------------------

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  // ✅ Spotify frequently returns 204 for success with no body (queue endpoint!)
  if (res.status === 204) return undefined as any;

  const text = await res.text();

  if (!res.ok) {
    // Spotify sometimes returns non-JSON text even on errors
    throw new Error(`Spotify API ${res.status}: ${text}`);
  }

  if (!text) return undefined as any;

  // Only parse JSON if it really is JSON
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return JSON.parse(text) as T;
  }

  // otherwise return raw text (rare but safe)
  return text as any;
}

