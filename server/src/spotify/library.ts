import { spotifyFetch } from "./spotifyApi.js";
import { getDb } from "../db/sqlite.js";

type SavedTrackItem = {
  added_at: string;
  track: {
    id: string;
    uri: string;
    is_local: boolean;
    type: string;
  };
};

type SavedTracksPage = {
  items: SavedTrackItem[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
};

type AudioFeatures = {
  id: string;
  duration_ms: number;
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  speechiness: number;
  loudness: number;
};

type AudioFeaturesResponse = {
  audio_features: (AudioFeatures | null)[];
};

export async function syncLikedSongsToDb(opts?: {
  maxTracks?: number;
  maxFeatureFetch?: number;     // cap audio-feature backfill for first run if desired
  refreshFeaturesOlderThanDays?: number; // optional refresh
}) {
  const db = getDb();
  const now = Date.now();
  const maxTracks = opts?.maxTracks ?? Infinity;

  let fetchedTracks = 0;
  let offset = 0;
  const limit = 50;

  const upsert = db.prepare(`
    INSERT INTO library_tracks(track_id, uri, added_at, source, last_seen_ts_ms)
    VALUES (?, ?, ?, 'liked', ?)
    ON CONFLICT(track_id) DO UPDATE SET
      uri=excluded.uri,
      added_at=excluded.added_at,
      source=excluded.source,
      last_seen_ts_ms=excluded.last_seen_ts_ms
  `);

  const seenTrackIds: string[] = [];

  while (fetchedTracks < maxTracks) {
    const page = await spotifyFetch<SavedTracksPage>(
      `/me/tracks?limit=${limit}&offset=${offset}`,
      "GET"
    );

    if (!page.items?.length) break;

    for (const item of page.items) {
      if (fetchedTracks >= maxTracks) break;

      const t = item.track;
      if (!t?.id || t.is_local || t.type !== "track") continue;

      upsert.run(t.id, t.uri, item.added_at ?? null, now);
      seenTrackIds.push(t.id);
      fetchedTracks += 1;
    }

    offset += limit;
    if (!page.next) break;
  }

  // Backfill audio features in batches (incremental)
  const featureStats = await backfillMissingAudioFeatures(seenTrackIds, {
    maxFetch: opts?.maxFeatureFetch,
    refreshOlderThanDays: opts?.refreshFeaturesOlderThanDays
  });

  return {
    ok: true,
    fetched_tracks: fetchedTracks,
    audio_features: featureStats
  };
}

/**
 * Fetch audio features in batches of 100 for tracks that are missing features
 * (or optionally stale).
 */
async function backfillMissingAudioFeatures(
  trackIds: string[],
  opts?: { maxFetch?: number; refreshOlderThanDays?: number }
) {
  const db = getDb();
  const now = Date.now();

  const uniq = Array.from(new Set(trackIds));
  if (uniq.length === 0) {
    return { considered: 0, missing_or_stale: 0, fetched: 0, inserted_or_updated: 0 };
  }

  // Figure out which ones are missing (duration_ms is null) OR stale (optional)
  const placeholders = uniq.map(() => "?").join(",");
  const refreshDays = opts?.refreshOlderThanDays;
  const staleCutoff = typeof refreshDays === "number"
    ? now - refreshDays * 24 * 60 * 60 * 1000
    : null;

  // Query existing features for this set
  const rows = db.prepare(`
    SELECT track_id, duration_ms, updated_ts_ms
    FROM audio_features
    WHERE track_id IN (${placeholders})
  `).all(...uniq) as any[];

  const existing = new Map<string, { duration_ms: number | null; updated_ts_ms: number | null }>();
  for (const r of rows) existing.set(r.track_id, { duration_ms: r.duration_ms ?? null, updated_ts_ms: r.updated_ts_ms ?? null });

  const missingOrStale: string[] = [];
  for (const id of uniq) {
    const ex = existing.get(id);
    const missing = !ex || ex.duration_ms == null;
    const stale = staleCutoff != null && (!!ex?.updated_ts_ms ? ex.updated_ts_ms < staleCutoff : true);

    if (missing || stale) missingOrStale.push(id);
  }

  // Optional cap so first run doesn't fetch thousands at once
  const capped = typeof opts?.maxFetch === "number"
    ? missingOrStale.slice(0, opts.maxFetch)
    : missingOrStale;

  const insert = db.prepare(`
    INSERT INTO audio_features(
      track_id, duration_ms, danceability, energy, valence, tempo,
      acousticness, instrumentalness, liveness, speechiness, loudness, updated_ts_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(track_id) DO UPDATE SET
      duration_ms=excluded.duration_ms,
      danceability=excluded.danceability,
      energy=excluded.energy,
      valence=excluded.valence,
      tempo=excluded.tempo,
      acousticness=excluded.acousticness,
      instrumentalness=excluded.instrumentalness,
      liveness=excluded.liveness,
      speechiness=excluded.speechiness,
      loudness=excluded.loudness,
      updated_ts_ms=excluded.updated_ts_ms
  `);

  const chunkSize = 100;
  let fetched = 0;
  let upserts = 0;

  for (let i = 0; i < capped.length; i += chunkSize) {
    const chunk = capped.slice(i, i + chunkSize);

    const resp = await spotifyFetch<AudioFeaturesResponse>(
      `/audio-features?ids=${encodeURIComponent(chunk.join(","))}`,
      "GET"
    ).catch(() => null);

    if (!resp?.audio_features) continue;

    fetched += chunk.length;

    for (const f of resp.audio_features) {
      if (!f?.id) continue;
      insert.run(
        f.id,
        f.duration_ms,
        f.danceability,
        f.energy,
        f.valence,
        f.tempo,
        f.acousticness,
        f.instrumentalness,
        f.liveness,
        f.speechiness,
        f.loudness,
        now
      );
      upserts += 1;
    }
  }

  return {
    considered: uniq.length,
    missing_or_stale: missingOrStale.length,
    fetched,
    inserted_or_updated: upserts,
    capped: typeof opts?.maxFetch === "number" ? opts.maxFetch : null
  };
}
