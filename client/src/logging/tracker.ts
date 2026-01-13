import { postEvent, type LoggedEvent, type EndReason } from "../api/events";
import type { SpotifyPlayerState } from "../spotify/types";
import { deriveEndReason, type LastAction } from "./derive";

export class Tracker {
  private sessionId: string;
  private deviceId?: string;

  private currentTrackId: string | null = null;
  private currentTrackStartTs: number | null = null;
  private currentTrackStartPos: number = 0;

  private prevTrackId: string | null = null;

  private lastState: SpotifyPlayerState | null = null;
  private lastAction: LastAction = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  setDeviceId(deviceId: string) {
    this.deviceId = deviceId;
  }

  noteAction(type: LastAction["type"]) {
    this.lastAction = { type, ts_ms: Date.now() };

    // also log the action itself
    const ev: LoggedEvent = {
      ts_ms: Date.now(),
      session_id: this.sessionId,
      event_type: "action",
      track_id: this.currentTrackId ?? undefined,
      prev_track_id: this.prevTrackId ?? undefined,
      position_ms: this.lastState?.position ?? undefined,
      device_id: this.deviceId,
      payload: { action: type }
    };
    void postEvent(ev).catch(() => {});
  }

  onState(state: SpotifyPlayerState | null) {
    if (!state || !state.track_window?.current_track?.id) {
      this.lastState = state;
      return;
    }

    const now = Date.now();
    const track = state.track_window.current_track;
    const trackId = track.id;

    // Track changed?
    if (this.currentTrackId && trackId !== this.currentTrackId) {
      // finalize previous track end
      const prevDuration = this.lastState?.duration ?? 0;
      const prevPosition = this.lastState?.position ?? 0;

      const listenedMs = this.estimateListenedMs(now, prevPosition);

      const reason: EndReason = deriveEndReason({
        lastAction: this.lastAction,
        prevTrackDurationMs: prevDuration,
        prevPositionMs: prevPosition
      });

      const endEv: LoggedEvent = {
        ts_ms: now,
        session_id: this.sessionId,
        event_type: "end",
        track_id: this.currentTrackId,
        prev_track_id: this.prevTrackId ?? undefined,
        position_ms: prevPosition,
        reason,
        device_id: this.deviceId,
        payload: {
          listened_ms: listenedMs,
          duration_ms: prevDuration
        }
      };

      void postEvent(endEv).catch(() => {});
    }

    // Track start?
    if (trackId !== this.currentTrackId) {
      this.prevTrackId = this.currentTrackId;
      this.currentTrackId = trackId;
      this.currentTrackStartTs = now;
      this.currentTrackStartPos = state.position;

      const startEv: LoggedEvent = {
        ts_ms: now,
        session_id: this.sessionId,
        event_type: "start",
        track_id: trackId,
        prev_track_id: this.prevTrackId ?? undefined,
        position_ms: state.position,
        device_id: this.deviceId,
        payload: {
          track_name: track.name,
          artists: track.artists.map((a) => a.name),
          duration_ms: track.duration_ms
        }
      };

      void postEvent(startEv).catch(() => {});
    }

    this.lastState = state;
  }

  private estimateListenedMs(nowTs: number, prevPositionMs: number): number {
    // Estimate: elapsed wall time since start, but clamp to reasonable bounds
    if (!this.currentTrackStartTs) return 0;

    const wall = nowTs - this.currentTrackStartTs;
    const deltaPos = Math.max(0, prevPositionMs - this.currentTrackStartPos);

    // Prefer position delta if it exists (more accurate), else wall
    const estimate = deltaPos > 0 ? deltaPos : wall;
    return Math.max(0, Math.min(estimate, wall + 2000));
  }
}
