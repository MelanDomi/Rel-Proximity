import { spotifyFetch } from "./spotifyApi.js";

export async function transferPlayback(deviceId: string) {
  await spotifyFetch("/me/player", "PUT", {
    device_ids: [deviceId],
    play: true
  });
}
