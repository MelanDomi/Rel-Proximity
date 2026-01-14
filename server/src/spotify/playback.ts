import { spotifyFetch } from "./spotifyApi.js";

/**
 * Add a track to the user's queue.
 * Spotify endpoint: POST /v1/me/player/queue?uri=...(&device_id=...)
 */
export async function addToQueue(args: { uri: string; deviceId?: string }) {
  const params = new URLSearchParams({ uri: args.uri });
  if (args.deviceId) params.set("device_id", args.deviceId);

  await spotifyFetch(`/me/player/queue?${params.toString()}`, "POST");
}

/**
 * Transfer playback to a given device (useful for Web Playback SDK).
 * Spotify endpoint: PUT /v1/me/player
 */
export async function transferPlayback(deviceId: string) {
  await spotifyFetch("/me/player", "PUT", {
    device_ids: [deviceId],
    play: true
  });
}
