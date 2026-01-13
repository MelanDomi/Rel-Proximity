import { spotifyFetch } from "./spotifyApi.js";

export async function addToQueue(args: { uri: string; deviceId?: string }) {
  const params = new URLSearchParams({ uri: args.uri });
  if (args.deviceId) params.set("device_id", args.deviceId);

  // POST /me/player/queue?uri=...
  await spotifyFetch(`/me/player/queue?${params.toString()}`, "POST");
}
