export const ENV = {
  API_BASE: import.meta.env.VITE_API_BASE as string,
  PLAYER_NAME: (import.meta.env.VITE_SPOTIFY_PLAYER_NAME as string) ?? "Next-Track DJ"
};

if (!ENV.API_BASE) {
  throw new Error("Missing VITE_API_BASE");
}
