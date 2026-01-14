import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/sqlite.js";

type LocalTrack = { id: string; uri: string; name?: string; artists?: string[] };

export function syncLikedFromLocalFile(): { ok: true; fetched_tracks: number } {
  const db = getDb();
  const now = Date.now();

  const filePath = path.resolve(process.cwd(), "data/liked_songs.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { tracks: LocalTrack[] };

  const upsert = db.prepare(`
    INSERT INTO library_tracks(track_id, uri, added_at, source, last_seen_ts_ms)
    VALUES (?, ?, ?, 'liked', ?)
    ON CONFLICT(track_id) DO UPDATE SET
      uri=excluded.uri,
      source=excluded.source,
      last_seen_ts_ms=excluded.last_seen_ts_ms
  `);

  let n = 0;
  for (const t of parsed.tracks ?? []) {
    if (!t?.id || !t?.uri) continue;
    upsert.run(t.id, t.uri, new Date().toISOString(), now);
    n++;
  }

  return { ok: true, fetched_tracks: n };
}
