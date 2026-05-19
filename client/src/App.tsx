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

const RECENT_TRACK_WINDOW = 30;
const SKIPPED_TRACK_WINDOW = 50;

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [state, setState] = useState<SpotifyPlayerState | null>(null);
  const [player, setPlayer] = useState<any>(null);

  const [likedCount, setLikedCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [startingSeed, setStartingSeed] = useState(false);

  const [autoQueue, setAutoQueue] = useState(true);
  const [lastQueuedFor, setLastQueuedFor] = useState<string | null>(null);
  const [recentTrackIds, setRecentTrackIds] = useState<string[]>([]);
  const [recentSkippedTrackIds, setRecentSkippedTrackIds] = useState<string[]>([]);

  const sessionId = useMemo(() => newSessionId(), []);
  const tracker = useMemo(() => new Tracker(sessionId), [sessionId]);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5174";
  const OFFLINE = import.meta.env.VITE_OFFLINE_MODE === "true";

  useEffect(() => {
    if (OFFLINE) {
      setAuthed(false);
      return;
    }

    authStatus()
      .then((s) => setAuthed(s.authed))
      .catch(() => setAuthed(false));
  }, [OFFLINE]);

  useEffect(() => {
    if (OFFLINE) return;
    if (!authed) return;

    let mounted = true;

    createPlayer({
      onReady: async (id) => {
        if (!mounted) return;
        setDeviceId(id);
        tracker.setDeviceId(id);

        try {
          await fetch(`${API_BASE}/spotify/transfer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ device_id: id })
          });
        } catch (e) {
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
  }, [OFFLINE, authed, tracker, API_BASE]);

  useEffect(() => {
    if (!OFFLINE && !authed) return;

    libraryCount()
      .then((c) => setLikedCount(c.liked_count))
      .catch(() => {});
  }, [OFFLINE, authed]);

  useEffect(() => {
    if (OFFLINE) return;

    const trackId = state?.track_window?.current_track?.id;
    if (!trackId) return;

    setRecentTrackIds((prev) => {
      if (prev[prev.length - 1] === trackId) return prev;
      const next = [...prev.filter((id) => id !== trackId), trackId];
      return next.slice(-RECENT_TRACK_WINDOW);
    });
  }, [OFFLINE, state?.track_window?.current_track?.id]);

  useEffect(() => {
    if (OFFLINE) return;

    const trackId = state?.track_window?.current_track?.id;
    if (!autoQueue || !trackId) return;
    if (!deviceId) return;
    if (trackId === lastQueuedFor) return;

    setLastQueuedFor(trackId);

    queueNext(trackId, deviceId, recentTrackIds, recentSkippedTrackIds)
      .then((r) => console.log("Queue response:", r))
      .catch((e) => console.error("Queue failed:", e));
  }, [OFFLINE, state, autoQueue, deviceId, lastQueuedFor, recentTrackIds, recentSkippedTrackIds]);

  const paused = state?.paused ?? true;
  const currentTrackId = state?.track_window?.current_track?.id ?? null;

  function markCurrentTrackSkipped() {
    if (!currentTrackId) return;

    setRecentSkippedTrackIds((prev) => {
      const next = [...prev.filter((id) => id !== currentTrackId), currentTrackId];
      return next.slice(-SKIPPED_TRACK_WINDOW);
    });
  }

  async function startRelProximity() {
    if (!deviceId) return;

    setStartingSeed(true);
    try {
      const res = await fetch(`${API_BASE}/spotify/start-seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ device_id: deviceId })
      });

      const json = await res.json();
      console.log("Started seed:", json);
    } catch (e) {
      console.error("Start seed failed:", e);
    } finally {
      setStartingSeed(false);
    }
  }

  if (!OFFLINE && !authed) {
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

      <div style={{ opacity: 0.8, marginBottom: 12, fontSize: 12 }}>
        Mode: <b>{OFFLINE ? "OFFLINE" : "ONLINE"}</b> · API base: {API_BASE}
      </div>

      {!OFFLINE && (
        <>
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
              markCurrentTrackSkipped();
              void player?.nextTrack();
            }}
            onPlayPause={() => {
              tracker.noteAction(paused ? "play" : "pause");
              void player?.togglePlay();
            }}
          />

          <div style={{ padding: 12, fontSize: 12, opacity: 0.7 }}>
            Tip: Click <b>Start Rel-Proximity</b> to begin from your own library instead of resuming Spotify DJ.
          </div>

          <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <button disabled={!deviceId || startingSeed} onClick={startRelProximity}>
              {startingSeed ? "Starting…" : "Start Rel-Proximity"}
            </button>
          </div>

          <div style={{ padding: 12, fontSize: 12, opacity: 0.65 }}>
            Recent tracks: {recentTrackIds.length} · Recently skipped: {recentSkippedTrackIds.length}
          </div>
        </>
      )}

      {OFFLINE && (
        <div style={{ padding: 12, fontSize: 12, opacity: 0.75 }}>
          Spotify is unavailable right now. You can still sync a local liked-songs file and generate training
          logs/recommendations in offline mode.
        </div>
      )}

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

        {!OFFLINE && (
          <label style={{ fontSize: 12, opacity: 0.8, marginLeft: "auto" }}>
            <input
              type="checkbox"
              checked={autoQueue}
              onChange={(e) => setAutoQueue(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Auto-queue next
          </label>
        )}
      </div>
    </div>
  );
}
