import { postEvent } from "../api/events";

type Track = { id: string; name: string; artists: string[]; duration_ms: number };

export class OfflinePlayer {
  private tracks: Track[];
  private idx = 0;
  private sessionId: string;
  private timer: any = null;
  private position = 0;
  private playing = false;

  constructor(args: { tracks: Track[]; sessionId: string }) {
    this.tracks = args.tracks;
    this.sessionId = args.sessionId;
  }

  get current() {
    return this.tracks[this.idx];
  }

  async play() {
    if (this.playing) return;
    this.playing = true;

    await postEvent({
      ts_ms: Date.now(),
      session_id: this.sessionId,
      event_type: "start",
      track_id: this.current.id,
      position_ms: this.position,
      payload: { track_name: this.current.name, artists: this.current.artists, duration_ms: this.current.duration_ms }
    });

    this.timer = setInterval(() => {
      this.position += 1000;
      if (this.position >= this.current.duration_ms) {
        void this.finish();
      }
    }, 1000);
  }

  async pause() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);

    await postEvent({
      ts_ms: Date.now(),
      session_id: this.sessionId,
      event_type: "end",
      track_id: this.current.id,
      position_ms: this.position,
      reason: "pause_stop",
      payload: { listened_ms: this.position, duration_ms: this.current.duration_ms }
    });
  }

  async next() {
    const prev = this.current;
    const listened = this.position;
    clearInterval(this.timer);

    await postEvent({
      ts_ms: Date.now(),
      session_id: this.sessionId,
      event_type: "end",
      track_id: prev.id,
      position_ms: listened,
      reason: "skip_next",
      payload: { listened_ms: listened, duration_ms: prev.duration_ms }
    });

    this.idx = (this.idx + 1) % this.tracks.length;
    this.position = 0;
    this.playing = false;
    await this.play();
  }

  private async finish() {
    const prev = this.current;
    clearInterval(this.timer);

    await postEvent({
      ts_ms: Date.now(),
      session_id: this.sessionId,
      event_type: "end",
      track_id: prev.id,
      position_ms: prev.duration_ms,
      reason: "finished",
      payload: { listened_ms: prev.duration_ms, duration_ms: prev.duration_ms }
    });

    this.idx = (this.idx + 1) % this.tracks.length;
    this.position = 0;
    this.playing = false;
    await this.play();
  }
}
