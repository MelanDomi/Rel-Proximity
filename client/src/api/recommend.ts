import { apiFetch } from "./http";

export async function queueNext(
  currentTrackId: string,
  deviceId?: string,
  recentTrackIds: string[] = [],
  recentSkippedTrackIds: string[] = []
) {
  return apiFetch<{ ok: boolean; queued: any; error?: string }>("/recommend/queue-next", {
    method: "POST",
    body: JSON.stringify({
      current_track_id: currentTrackId,
      device_id: deviceId,
      recent_track_ids: recentTrackIds,
      recent_skipped_track_ids: recentSkippedTrackIds
    })
  });
}

export async function getNext(
  currentTrackId: string,
  recentTrackIds: string[] = [],
  recentSkippedTrackIds: string[] = []
) {
  const params = new URLSearchParams({
    current: currentTrackId
  });

  if (recentTrackIds.length > 0) {
    params.set("recent_track_ids", recentTrackIds.join(","));
  }

  if (recentSkippedTrackIds.length > 0) {
    params.set("recent_skipped_track_ids", recentSkippedTrackIds.join(","));
  }

  return apiFetch<any>(`/recommend/next?${params.toString()}`);
}
