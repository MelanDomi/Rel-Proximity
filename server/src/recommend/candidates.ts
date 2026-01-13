import { getDb } from "../db/sqlite.js";
import type { AudioRow } from "./vectorize.js";

export function getAudioRow(trackId: string): AudioRow | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      track_id,
      duration_ms,
      danceability, energy, valence, tempo,
      acousticness, instrumentalness, liveness, speechiness, loudness
    FROM audio_features
    WHERE track_id = ?
  `).get(trackId) as any;
  return row ?? null;
}

export function getTopTransitionCandidates(fromTrackId: string, limit = 25): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT to_track_id
    FROM transition_stats
    WHERE from_track_id = ?
    ORDER BY starts DESC
    LIMIT ?
  `).all(fromTrackId, limit) as any[];
  return rows.map((r) => r.to_track_id);
}

export function getGlobalGoodTracks(limit = 50): string[] {
  const db = getDb();
  // Good = low fast skip rate, enough starts so it isn't noise
  const rows = db.prepare(`
    SELECT track_id
    FROM track_stats
    WHERE starts >= 3
    ORDER BY (CAST(skips_fast AS REAL) / starts) ASC, starts DESC
    LIMIT ?
  `).all(limit) as any[];
  return rows.map((r) => r.track_id);
}

export function getAllFeatureTrackIds(limit = 5000): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT track_id
    FROM audio_features
    WHERE duration_ms IS NOT NULL
    LIMIT ?
  `).all(limit) as any[];
  return rows.map((r) => r.track_id);
}

export function getLikedLibraryTrackIds(limit = 5000): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT track_id
    FROM library_tracks
    WHERE source='liked'
    ORDER BY added_at DESC
    LIMIT ?
  `).all(limit) as any[];
  return rows.map((r) => r.track_id);
}

