import { getDb } from "../db/sqlite.js";
import { BAYES } from "../config/constants.js";

export function markovScore(fromTrackId: string, toTrackId: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT starts, skips_fast
    FROM transition_stats
    WHERE from_track_id = ? AND to_track_id = ?
  `).get(fromTrackId, toTrackId) as any;

  const starts = row?.starts ?? 0;
  const skips = row?.skips_fast ?? 0;

  // E[skip_rate] = (skips + alpha) / (starts + alpha + beta)
  const skipRate = (skips + BAYES.ALPHA) / (starts + BAYES.ALPHA + BAYES.BETA);
  return 1 - skipRate; // higher is better
}
