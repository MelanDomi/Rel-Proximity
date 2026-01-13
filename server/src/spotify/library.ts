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

export async function syncLikedSongsToDb(opts?: { maxTracks?: number }) {
  const db = getDb();
  const now = Date.now();
  const maxTracks = opts?.maxTracks ?? Infinity;

  let fetched = 0;
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

  while (fetched < maxTracks) {
    const page = await spotifyFetch<SavedTracksPage>(
      `/me/tracks?limit=${limit}&offset=${offset}`,
      "GET"
    );

    if (!page.items?.length) break;

    for (const item of page.items) {
      if (fetched >= maxTracks) break;

      const t = item.track;
      // Skip local files and non-track items
      if (!t?.id || t.is_local || t.type !== "track") continue;

      upsert.run(t.id, t.uri, item.added_at ?? null, now);
      seenTrackIds.push(t.id);
      fetched += 1;
    }

    offset += limit;
    if (!page.next) break;
  }

  // Batch fetch audio features (100 IDs per request)
  await backfillAudioFeatures(seenTrackIds);

  return {
    ok: true,
    fetched_tracks: fetched
  };
}

async function backfillAudioFeatures(trackIds: string[]) {
  const db = getDb();
  const now = Date.now();

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

  // Dedup and chunk
  const uniq = Array.from(new Set(trackIds));
  const chunkSize = 100;

  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);

    // Spotify endpoint: GET /audio-features?ids=...
    const resp = await spotifyFetch<AudioFeaturesResponse>(
      `/audio-features?ids=${encodeURIComponent(chunk.join(","))}`,
      "GET"
    ).catch(() => null);

    if (!resp?.audio_features) continue;

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
    }
  }
}
