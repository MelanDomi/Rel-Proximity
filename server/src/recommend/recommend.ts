import { spotifyFetch } from "../spotify/spotifyApi.js";
import { finalScore } from "./score.js";
import {
  getLikedLibraryTrackIds,
  getGlobalGoodTracks,
  getTopTransitionCandidates
} from "./candidates.js";
import { getDb } from "../db/sqlite.js";

type SpotifyTrack = { id: string; uri: string; name: string };

function randomLikedTrackId(excludedTrackIds: string[] = []): string | null {
  const db = getDb();

  const placeholders = excludedTrackIds.map(() => "?").join(", ");
  const whereNotIn =
    excludedTrackIds.length > 0
      ? `AND track_id NOT IN (${placeholders})`
      : "";

  const row = db
    .prepare(
      `
      SELECT track_id
      FROM library_tracks
      WHERE source='liked'
      ${whereNotIn}
      ORDER BY RANDOM()
      LIMIT 1
    `
    )
    .get(...excludedTrackIds) as any;

  return row?.track_id ?? null;
}

async function getTrackMeta(trackId: string): Promise<SpotifyTrack | null> {
  try {
    const t = await spotifyFetch<any>(`/tracks/${trackId}`, "GET");
    return { id: t.id, uri: t.uri, name: t.name };
  } catch {
    return null;
  }
}

export async function recommendNext(
  currentTrackId: string,
  recentTrackIds: string[] = [],
  queuedTrackIds: string[] = []
) {
  // Bigger exclusion set:
  // - current track
  // - recent tracks from client
  // - anything already in Spotify queue
  const excluded = new Set<string>([
    currentTrackId,
    ...recentTrackIds,
    ...queuedTrackIds
  ]);

  // Candidate sources
  const seenAfter = getTopTransitionCandidates(currentTrackId, 50);
  const globalGood = getGlobalGoodTracks(100);
  const libraryPool = getLikedLibraryTrackIds(5000);

  // Union + de-dupe + exclude
  const candidates = Array.from(
    new Set<string>([...seenAfter, ...globalGood, ...libraryPool])
  ).filter((id) => !excluded.has(id));

  // Cold start fallback
  if (candidates.length === 0) {
    const fallbackId = randomLikedTrackId(Array.from(excluded));
    if (!fallbackId) return null;

    return {
      currentTrackId,
      next: {
        track_id: fallbackId,
        uri: `spotify:track:${fallbackId}`,
        name: "fallback",
        score: 0,
        components: { markov: 0, sim: 0, global: 0 }
      },
      top10: []
    };
  }

  // Score candidates
  const scored = candidates.map((cand) => {
    const s = finalScore({ currentTrackId, candidateTrackId: cand });
    return { candidateTrackId: cand, ...s };
  });

  scored.sort((a, b) => b.total - a.total);

  const best = scored[0];
  if (!best) return null;

  const meta = await getTrackMeta(best.candidateTrackId);

  // Metadata fallback
  if (!meta) {
    const fallbackId = randomLikedTrackId(Array.from(excluded));
    if (!fallbackId) return null;

    return {
      currentTrackId,
      next: {
        track_id: fallbackId,
        uri: `spotify:track:${fallbackId}`,
        name: "fallback",
        score: 0,
        components: { markov: 0, sim: 0, global: 0 }
      },
      top10: scored.slice(0, 10)
    };
  }

  return {
    currentTrackId,
    next: {
      track_id: meta.id,
      uri: meta.uri,
      name: meta.name,
      score: best.total,
      components: {
        markov: best.markov,
        sim: best.sim,
        global: best.global
      }
    },
    top10: scored.slice(0, 10)
  };
}
