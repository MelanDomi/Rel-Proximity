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
  recentTrackIds: string[] = []
) {
  const excluded = new Set<string>([currentTrackId, ...recentTrackIds]);

  // 1) Candidate sources
  const seenAfter = getTopTransitionCandidates(currentTrackId, 25);
  const globalGood = getGlobalGoodTracks(50);
  const libraryPool = getLikedLibraryTrackIds(5000);

  // 2) Union + de-dupe + exclude recent/current tracks
  const candidates = Array.from(
    new Set<string>([...seenAfter, ...globalGood, ...libraryPool])
  ).filter((id) => !excluded.has(id));

  // 3) Cold start fallback: no candidates
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

  // 4) Score candidates
  const scored = candidates.map((cand) => {
    const s = finalScore({ currentTrackId, candidateTrackId: cand });
    return { candidateTrackId: cand, ...s };
  });

  scored.sort((a, b) => b.total - a.total);

  const best = scored[0];
  if (!best) return null;

  // 5) Try metadata for the best candidate
  const meta = await getTrackMeta(best.candidateTrackId);

  // 6) If metadata fails, fallback to a random liked track that isn't excluded
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

  // 7) Normal return
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
