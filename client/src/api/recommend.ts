import { apiFetch } from "./http";

export async function queueNext(currentTrackId: string, deviceId?: string) {
  return apiFetch<{ ok: true; queued: any }>("/recommend/queue-next", {
    method: "POST",
    body: JSON.stringify({
      current_track_id: currentTrackId,
      device_id: deviceId
    })
  });
}

export async function getNext(currentTrackId: string) {
  return apiFetch<any>(`/recommend/next?current=${encodeURIComponent(currentTrackId)}`);
}
