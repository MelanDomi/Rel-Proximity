import { getDb } from "../db/sqlite.js";
import { getOrFetchAudioFeatures } from "../spotify/features.js";
import { isCompletion, isFastSkip } from "./rules.js";

export type EndReason = "finished" | "skip_next" | "skip_prev" | "pause_stop" | "unknown";

export async function aggregateTrackEnd(args: {
  track_id: string;
  prev_track_id?: string;
  listened_ms: number;
  reason: EndReason;
  ts_ms: number;
}): Promise<void> {
  const db = getDb();
  const { track_id, prev_track_id, listened_ms, reason, ts_ms } = args;

  // Pull duration for completion logic (cached)
  const features = await getOrFetchAudioFeatures(track_id);
  const durationMs = features?.duration_ms ?? null;

  const fastSkip = (reason === "skip_next" || reason === "skip_prev") && isFastSkip(listened_ms);
  const completion = reason === "finished" || isCompletion(listened_ms, durationMs);

  // Track-level stats
  db.prepare(`
    INSERT INTO track_stats(track_id, starts, completions, skips_fast, total_listen_ms, last_played_ts_ms)
    VALUES (?, 0, 0, 0, 0, ?)
    ON CONFLICT(track_id) DO UPDATE SET
      last_played_ts_ms=excluded.last_played_ts_ms
  `).run(track_id, ts_ms);

  db.prepare(`
    UPDATE track_stats
    SET
      completions = completions + ?,
      skips_fast = skips_fast + ?,
      total_listen_ms = total_listen_ms + ?
    WHERE track_id = ?
  `).run(completion ? 1 : 0, fastSkip ? 1 : 0, Math.max(0, listened_ms), track_id);

  // Transition-level stats (A -> B) is updated at start; here we update skip/listen for B given A.
  if (prev_track_id) {
    db.prepare(`
      INSERT INTO transition_stats(from_track_id, to_track_id, starts, skips_fast, total_listen_ms, last_ts_ms)
      VALUES (?, ?, 0, 0, 0, ?)
      ON CONFLICT(from_track_id, to_track_id) DO UPDATE SET
        last_ts_ms=excluded.last_ts_ms
    `).run(prev_track_id, track_id, ts_ms);

    db.prepare(`
      UPDATE transition_stats
      SET
        skips_fast = skips_fast + ?,
        total_listen_ms = total_listen_ms + ?,
        last_ts_ms = ?
      WHERE from_track_id = ? AND to_track_id = ?
    `).run(fastSkip ? 1 : 0, Math.max(0, listened_ms), ts_ms, prev_track_id, track_id);
  }
}

export function aggregateTrackStart(args: {
  track_id: string;
  prev_track_id?: string;
  ts_ms: number;
}): void {
  const db = getDb();
  const { track_id, prev_track_id, ts_ms } = args;

  // Track starts
  db.prepare(`
    INSERT INTO track_stats(track_id, starts, completions, skips_fast, total_listen_ms, last_played_ts_ms)
    VALUES (?, 1, 0, 0, 0, ?)
    ON CONFLICT(track_id) DO UPDATE SET
      starts = starts + 1,
      last_played_ts_ms = excluded.last_played_ts_ms
  `).run(track_id, ts_ms);

  // Transition starts: A -> B means B started after A
  if (prev_track_id) {
    db.prepare(`
      INSERT INTO transition_stats(from_track_id, to_track_id, starts, skips_fast, total_listen_ms, last_ts_ms)
      VALUES (?, ?, 1, 0, 0, ?)
      ON CONFLICT(from_track_id, to_track_id) DO UPDATE SET
        starts = starts + 1,
        last_ts_ms = excluded.last_ts_ms
    `).run(prev_track_id, track_id, ts_ms);
  }
}
