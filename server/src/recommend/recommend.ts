import { spotifyFetch } from "../spotify/spotifyApi.js";
import { finalScore } from "./score.js";
import {
  getLikedLibraryTrackIds,
  getGlobalGoodTracks,
  getTopTransitionCandidates
} from "./candidates.js";
import { getDb } from "../db/sqlite.js";

type SpotifyTrack = { id: string; uri: string; name: string };

type RecommendOptions = {
  recentTrackIds?: string[];
  recentSkippedTrackIds?: string[];
  queuedTrackIds?: string[];
};

type ScoredCandidate = {
  candidateTrackId: string;
  total: number;
  markov: number;
  sim: number;
  global: number;
};

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

function chooseFromScoreTiers(scored: ScoredCandidate[]): ScoredCandidate | null {
  if (scored.length === 0) return null;

  // Group nearly-equal scores together so we don't deterministically pick
  // the first item in library order when many candidates tie at 0.55.
  const byScore = new Map<string, ScoredCandidate[]>();

  for (const cand of scored) {
    const key = cand.total.toFixed(4);
    const bucket = byScore.get(key) ?? [];
    bucket.push(cand);
    byScore.set(key, bucket);
  }

  const scoreKeys = Array.from(byScore.keys()).sort((a, b) => Number(b) - Number(a));

  // Walk score tiers from best downward.
  // Randomize within the first non-empty tier.
  for (const key of scoreKeys) {
    const bucket = byScore.get(key) ?? [];
    if (bucket.length === 0) continue;

    const idx = Math.floor(Math.random() * bucket.length);
    return bucket[idx];
  }

  return null;
}

export async function recommendNext(
  currentTrackId: string,
  options: RecommendOptions = {}
) {
  const recentTrackIds = options.recentTrackIds ?? [];
  const recentSkippedTrackIds = options.recentSkippedTrackIds ?? [];
  const queuedTrackIds = options.queuedTrackIds ?? [];

  // Strong exclusion set:
  // - current track
  // - recently played tracks
  // - recently skipped tracks
  // - anything already in Spotify queue
  const hardExcluded = new Set<string>([
    currentTrackId,
    ...recentTrackIds,
    ...recentSkippedTrackIds,
    ...queuedTrackIds
  ]);

  // Candidate sources
  const seenAfter = getTopTransitionCandidates(currentTrackId, 50);
  const globalGood = getGlobalGoodTracks(100);
  const libraryPool = getLikedLibraryTrackIds(5000);

  // First pass: strict filtering
  let candidates = Array.from(
    new Set<string>([...seenAfter, ...globalGood, ...libraryPool])
  ).filter((id) => !hardExcluded.has(id));

  // Second pass fallback:
  // If strict filtering leaves nothing, allow recently played tracks back in,
  // but still exclude current, skipped, and already queued tracks.
  if (candidates.length === 0) {
    const softerExcluded = new Set<string>([
      currentTrackId,
      ...recentSkippedTrackIds,
      ...queuedTrackIds
    ]);

    candidates = Array.from(
      new Set<string>([...seenAfter, ...globalGood, ...libraryPool])
    ).filter((id) => !softerExcluded.has(id));
  }

  // Third pass fallback:
  // If still nothing, pick a random liked track excluding the most important blocks.
  if (candidates.length === 0) {
    const fallbackId = randomLikedTrackId([
      currentTrackId,
      ...recentSkippedTrackIds,
      ...queuedTrackIds
    ]);

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

  const best = chooseFromScoreTiers(scored);
  if (!best) return null;

  const meta = await getTrackMeta(best.candidateTrackId);

  if (!meta) {
    const fallbackId = randomLikedTrackId([
      currentTrackId,
      ...recentSkippedTrackIds,
      ...queuedTrackIds
    ]);

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
