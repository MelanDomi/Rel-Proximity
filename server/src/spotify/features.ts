import { getDb } from "../db/sqlite.js";
import { spotifyFetch } from "./spotifyApi.js";

type SpotifyAudioFeatures = {
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

export async function getOrFetchAudioFeatures(trackId: string): Promise<SpotifyAudioFeatures | null> {
  const db = getDb();
  const row = db.prepare(`
    SELECT track_id as id, duration_ms, danceability, energy, valence, tempo,
           acousticness, instrumentalness, liveness, speechiness, loudness
    FROM audio_features
    WHERE track_id = ?
  `).get(trackId) as any;

  if (row && row.duration_ms != null) return row as SpotifyAudioFeatures;

  // Spotify endpoint: GET /audio-features/{id}
  const features = await spotifyFetch<SpotifyAudioFeatures>(`/audio-features/${trackId}`, "GET")
    .catch(() => null);

  if (!features) return null;

  db.prepare(`
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
  `).run(
    features.id,
    features.duration_ms,
    features.danceability,
    features.energy,
    features.valence,
    features.tempo,
    features.acousticness,
    features.instrumentalness,
    features.liveness,
    features.speechiness,
    features.loudness,
    Date.now()
  );

  return features;
}
