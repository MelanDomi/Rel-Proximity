import { ENV } from "../config/env";
import { getAccessToken } from "../api/spotify";
import type { SpotifyPlayerState } from "./types";

export type PlayerHandle = {
  player: any;
  deviceId: string;
  disconnect: () => Promise<void>;
};

export async function loadSpotifySDK(): Promise<void> {
  if (document.getElementById("spotify-sdk")) return;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "spotify-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
    document.body.appendChild(script);
  });
}

export async function createPlayer(args: {
  onReady: (deviceId: string) => void;
  onNotReady?: (deviceId: string) => void;
  onState?: (state: SpotifyPlayerState | null) => void;
}): Promise<PlayerHandle> {
  await loadSpotifySDK();

  // Spotify SDK triggers this callback when ready; but script.onload already loaded,
  // so we can proceed once window.Spotify is available.
  const waitForSpotify = async () => {
    for (let i = 0; i < 50; i++) {
      if (window.Spotify?.Player) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Spotify.Player not available");
  };
  await waitForSpotify();

  const player = new window.Spotify.Player({
    name: ENV.PLAYER_NAME,
    getOAuthToken: async (cb: (token: string) => void) => {
      const token = await getAccessToken();
      cb(token);
    },
    volume: 0.8
  });

  let deviceId = "";

  player.addListener("ready", ({ device_id }: { device_id: string }) => {
    deviceId = device_id;
    args.onReady(device_id);
  });

  player.addListener("not_ready", ({ device_id }: { device_id: string }) => {
    args.onNotReady?.(device_id);
  });

  player.addListener("player_state_changed", (state: SpotifyPlayerState | null) => {
    args.onState?.(state);
  });

  const connected = await player.connect();
  if (!connected) throw new Error("Failed to connect Spotify player");

  return {
    player,
    deviceId,
    disconnect: async () => {
      try {
        await player.disconnect();
      } catch {
        // ignore
      }
    }
  };
}
