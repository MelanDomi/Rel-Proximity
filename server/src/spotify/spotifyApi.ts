import { getTokens, upsertTokens } from "../auth/sessionStore.js";
import { refreshAccessToken } from "../auth/spotifyOAuth.js";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export async function getValidAccessToken(): Promise<string> {
  const t = getTokens();
  if (!t) throw new Error("Not authenticated");

  // Refresh a little early
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
  method: HttpMethod = "GET",
  body?: unknown
): Promise<T> {
  const accessToken = await getValidAccessToken();

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  // Spotify often returns 204 No Content for successful playback actions
  if (res.status === 204) return undefined as T;

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Spotify API ${res.status}: ${text}`);
  }

  if (!text) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return JSON.parse(text) as T;
  }

  return text as T;
}
