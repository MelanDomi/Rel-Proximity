import { apiFetch } from "./http";

export async function queueNext(
  currentTrackId: string,
  deviceId?: string,
  recentTrackIds: string[] = []
) {
  return apiFetch<{ ok: boolean; queued: any; error?: string }>("/recommend/queue-next", {
    method: "POST",
    body: JSON.stringify({
      current_track_id: currentTrackId,
      device_id: deviceId,
      recent_track_ids: recentTrackIds
    })
  });
}

export async function getNext(currentTrackId: string, recentTrackIds: string[] = []) {
  const params = new URLSearchParams({
    current: currentTrackId
  });

  if (recentTrackIds.length > 0) {
    params.set("recent_track_ids", recentTrackIds.join(","));
  }

  return apiFetch<any>(`/recommend/next?${params.toString()}`);
}
