import { apiFetch } from "./http";

export async function syncLiked(maxTracks?: number) {
  return apiFetch<{ ok: true; fetched_tracks: number }>("/library/sync-liked", {
    method: "POST",
    body: JSON.stringify({ max_tracks: maxTracks })
  });
}

export async function libraryCount() {
  return apiFetch<{ liked_count: number }>("/library/count");
}
