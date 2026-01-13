import type { EndReason } from "../api/events";

export type LastAction =
  | { type: "next" | "prev" | "pause" | "play" | "seek"; ts_ms: number }
  | null;

export function deriveEndReason(args: {
  lastAction: LastAction;
  prevTrackDurationMs: number;
  prevPositionMs: number;
}): EndReason {
  const { lastAction, prevTrackDurationMs, prevPositionMs } = args;

  // If we were within 2s of the end, treat as finished
  if (prevTrackDurationMs > 0 && prevTrackDurationMs - prevPositionMs <= 2000) {
    return "finished";
  }

  // If user pressed next/prev very recently, use that
  if (lastAction && Date.now() - lastAction.ts_ms <= 2000) {
    if (lastAction.type === "next") return "skip_next";
    if (lastAction.type === "prev") return "skip_prev";
    if (lastAction.type === "pause") return "pause_stop";
  }

  return "unknown";
}
