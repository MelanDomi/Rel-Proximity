import { getTokens, upsertTokens } from "../auth/sessionStore.js";
import { refreshAccessToken } from "../auth/spotifyOAuth.js";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

async function ensureValidAccessToken(): Promise<string> {
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

export async function spotifyFetch<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown
): Promise<T> {
  const access = await ensureValidAccessToken();
  const url = `https://api.spotify.com/v1${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${text}`);
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return {} as T;

  return res.json() as Promise<T>;
}
