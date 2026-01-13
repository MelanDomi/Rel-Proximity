import { apiFetch } from "./http";

export function login(): void {
  // This will redirect to Spotify then back to the client
  window.location.href = "http://localhost:5174/auth/login";
}

export async function authStatus(): Promise<{ authed: boolean; expires_at_ts_ms: number | null }> {
  return apiFetch("/auth/status");
}
