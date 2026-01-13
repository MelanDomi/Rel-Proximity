import { apiFetch } from "./http";

export type EventType = "start" | "end" | "action" | "pos";
export type EndReason = "finished" | "skip_next" | "skip_prev" | "pause_stop" | "unknown";
export type ActionType = "play" | "pause" | "next" | "prev" | "seek";

export type LoggedEvent = {
  ts_ms: number;
  session_id: string;
  event_type: EventType;
  track_id?: string;
  prev_track_id?: string;
  position_ms?: number;
  reason?: EndReason;
  device_id?: string;
  payload?: Record<string, unknown>;
};

export async function postEvent(ev: LoggedEvent): Promise<{ ok: true }> {
  return apiFetch("/events", { method: "POST", body: JSON.stringify(ev) });
}
