import React from "react";
import type { SpotifyPlayerState } from "../spotify/types";

export function NowPlayingCard({ state }: { state: SpotifyPlayerState | null }) {
  const track = state?.track_window?.current_track;
  if (!track) return <div style={{ padding: 12 }}>No track playing</div>;

  const img = track.album.images?.[0]?.url;

  return (
    <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {img ? (
          <img src={img} alt="album" width={64} height={64} style={{ borderRadius: 8 }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 8, background: "#eee" }} />
        )}
        <div>
          <div style={{ fontWeight: 700 }}>{track.name}</div>
          <div style={{ opacity: 0.7 }}>{track.artists.map((a) => a.name).join(", ")}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {state?.paused ? "Paused" : "Playing"} • {Math.floor((state?.position ?? 0) / 1000)}s
          </div>
        </div>
      </div>
    </div>
  );
}
