import { useEffect, useMemo, useState } from "react";
import { authStatus, login } from "./api/auth";
import { createPlayer } from "./spotify/sdk";
import type { SpotifyPlayerState } from "./spotify/types";
import { NowPlayingCard } from "./components/NowPlayingCard";
import { Controls } from "./components/Controls";
import { newSessionId } from "./logging/session";
import { Tracker } from "./logging/tracker";
import { queueNext } from "./api/recommend";


export default function App() {
  const [authed, setAuthed] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [state, setState] = useState<SpotifyPlayerState | null>(null);
  const [player, setPlayer] = useState<any>(null);

  const sessionId = useMemo(() => newSessionId(), []);
  const tracker = useMemo(() => new Tracker(sessionId), [sessionId]);

  useEffect(() => {
    authStatus()
      .then((s) => setAuthed(s.authed))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed) return;

    let mounted = true;

    createPlayer({
      onReady: (id) => {
        if (!mounted) return;
        setDeviceId(id);
        tracker.setDeviceId(id);
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
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
      });
    
    useEffect(() => {
  const trackId = state?.track_window?.current_track?.id;
  if (!autoQueue || !trackId) return;
  if (trackId === lastQueuedFor) return; // only once per track
  if (!deviceId) return;

  setLastQueuedFor(trackId);

  queueNext(trackId, deviceId)
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log("Queued:", r.queued);
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error("Queue failed:", e);
    });
}, [state, autoQueue, deviceId, lastQueuedFor]);


    return () => {
      mounted = false;
    };
  }, [authed, tracker]);

  const paused = state?.paused ?? true;

  if (!authed) {
    return (
      <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
        <h2>Spotify Next-Track DJ</h2>
        <p>This app uses the Spotify Web Playback SDK. You’ll need Spotify Premium.</p>
        <button onClick={login}>Log in with Spotify</button>
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
          if (paused) tracker.noteAction("play");
          else tracker.noteAction("pause");
          void player?.togglePlay();
        }}
      />

      <div style={{ padding: 12, fontSize: 12, opacity: 0.7 }}>
        Tip: Start playback by choosing this device in Spotify’s “Connect to a device” menu, or hit play here if it’s active.
      </div>
    </div>
  );
}
