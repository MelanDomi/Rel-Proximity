import { apiFetch } from "./http";

export async function getAccessToken(): Promise<string> {
  const res = await apiFetch<{ access_token: string }>("/spotify/token");
  return res.access_token;
}
