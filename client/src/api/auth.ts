import { apiFetch } from "./http";
import { ENV } from "../config/env";

export function login(): void {
  window.location.href = `${ENV.API_BASE}/auth/login`;
}

export async function authStatus(): Promise<{ authed: boolean; expires_at_ts_ms: number | null }> {
  return apiFetch("/auth/status");
}
