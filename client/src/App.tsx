import React from "react";
import { useEffect, useMemo, useState } from "react";
import { authStatus, login } from "./api/auth";
import { syncLiked, libraryCount } from "./api/library";
import { queueNext } from "./api/recommend";
import { createPlayer } from "./spotify/sdk";
import type { SpotifyPlayerState } from "./spotify/types";
import { NowPlayingCard } from "./components/NowPlayingCard";
import { Controls } from "./components/Controls";
import { newSessionId } from "./logging/session";
import { Tracker } from "./logging/tracker";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [state, setState] = useState<SpotifyPlayerState | null>(null);
  const [player, setPlayer] = useState<any>(null);

  const [likedCount, setLikedCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [autoQueue, setAutoQueue] = useState(true);
  const [lastQueuedFor, setLastQueuedFor] = useState<string | null>(null);

  const sessionId = useMemo(() => newSessionId(), []);
  const tracker = useMemo(() => new Tracker(sessionId), [sessionId]);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5174";

  // 1) Check auth
  useEffect(() => {
    authStatus()
      .then((s) => setAuthed(s.authed))
      .catch(() => setAuthed(false));
  }, []);

  // 2) When authed, create Spotify Web Playback SDK player
  useEffect(() => {
    if (!authed) return;

    let mounted = true;

    createPlayer({
      onReady: async (id) => {
        if (!mounted) return;
        setDeviceId(id);
        tracker.setDeviceId(id);

        // Transfer playback to this Web Playback SDK device (works when Spotify is available)
        try {
          await fetch(`${API_BASE}/spotify/transfer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ device_id: id })
          });
        } catch (e) {
          // In offline mode or if Spotify routes aren’t available yet, this can fail. That’s fine.
          console.warn("transfer playback failed:", e);
        }
      },
      onState: (st) => {
        if (!mounted) return;
        setState(st);
        tracker.onState(st);
      }
    })
      .then((h) => {
        if (!mounted) return;
        setPlayer(h.player);
      })
      .catch((err) => console.error(err));

    return () => {
      mounted = false;
    };
  }, [authed, tracker, API_BASE]);

  // 3) Load liked library count (works in offline mode too)
  useEffect(() => {
    if (!authed) return;
    libraryCount().then((c) => setLikedCount(c.liked_count)).catch(() => {});
  }, [authed]);

  // 4) Auto-queue next track
  useEffect(() => {
    const trackId = state?.track_window?.current_track?.id;
    if (!autoQueue || !trackId) return;
    if (!deviceId) return;
    if (trackId === lastQueuedFor) return;

    setLastQueuedFor(trackId);

    queueNext(trackId, deviceId)
      .then((r) => console.log("Queued:", r.queued))
      .catch((e) => console.error("Queue failed:", e));
  }, [state, autoQueue, deviceId, lastQueuedFor]);

  const paused = state?.paused ?? true;

  if (!authed) {
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
        <h2>Spotify Next-Track DJ</h2>
        <p>This app uses the Spotify Web Playback SDK. You’ll need Spotify Premium.</p>
        <button onClick={login}>Log in with Spotify</button>

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          API base: {API_BASE}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>Spotify Next-Track DJ</h2>

      <div style={{ opacity: 0.7, marginBottom: 12 }}>
        Device: {deviceId ?? "Connecting…"}
      </div>

      <NowPlayingCard state={state} />

      <Controls
        paused={paused}
        onPrev={() => {
          tracker.noteAction("prev");
          void player?.previousTrack();
        }}
        onNext={() => {
          tracker.noteAction("next");
          void player?.nextTrack();
        }}
        onPlayPause={() => {
          tracker.noteAction(paused ? "play" : "pause");
          void player?.togglePlay();
        }}
      />

      <div style={{ padding: 12, fontSize: 12, opacity: 0.7 }}>
        Tip: Start playback by choosing this device in Spotify’s “Connect to a device” menu, or hit play here if it’s active.
      </div>

      <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          disabled={syncing}
          onClick={() => {
            setSyncing(true);
            syncLiked()
              .then(() => libraryCount())
              .then((c) => setLikedCount(c.liked_count))
              .finally(() => setSyncing(false));
          }}
        >
          {syncing ? "Syncing…" : "Sync Liked Songs"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Liked in library: {likedCount ?? "—"}
        </div>

        <label style={{ fontSize: 12, opacity: 0.8, marginLeft: "auto" }}>
          <input
            type="checkbox"
            checked={autoQueue}
            onChange={(e) => setAutoQueue(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Auto-queue next
        </label>
      </div>
    </div>
  );
}
