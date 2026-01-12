import crypto from "node:crypto";
import { ENV } from "../config/env.js";

const SPOTIFY_ACCOUNTS = "https://accounts.spotify.com";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state"
].join(" ");

export function makeLoginUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ENV.SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: ENV.SPOTIFY_REDIRECT_URI,
    state
  });
  return `${SPOTIFY_ACCOUNTS}/authorize?${params.toString()}`;
}

export function randomState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: ENV.SPOTIFY_REDIRECT_URI
  });

  const basic = Buffer.from(
    `${ENV.SPOTIFY_CLIENT_ID}:${ENV.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const basic = Buffer.from(
    `${ENV.SPOTIFY_CLIENT_ID}:${ENV.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<TokenResponse>;
}
