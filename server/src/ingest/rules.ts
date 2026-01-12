import { RULES } from "../config/constants.js";

export function isFastSkip(listenedMs: number): boolean {
  return listenedMs > 0 && listenedMs < RULES.SKIP_THRESHOLD_MS;
}

export function isCompletion(listenedMs: number, durationMs: number | null | undefined): boolean {
  if (!durationMs || durationMs <= 0) return false;
  return listenedMs / durationMs >= RULES.COMPLETE_RATIO;
}
