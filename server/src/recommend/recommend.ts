import { spotifyFetch } from "../spotify/spotifyApi.js";
import { getAllFeatureTrackIds, getGlobalGoodTracks, getTopTransitionCandidates } from "./candidates.js";
import { finalScore } from "./score.js";

type SpotifyTrack = { id: string; uri: string; name: string };

async function getTrackMeta(trackId: string): Promise<SpotifyTrack | null> {
  try {
    const t = await spotifyFetch<any>(`/tracks/${trackId}`, "GET");
    return { id: t.id, uri: t.uri, name: t.name };
  } catch {
    return null;
  }
}

export async function recommendNext(currentTrackId: string) {
  // Build candidate set
  const seenAfter = getTopTransitionCandidates(currentTrackId, 25);
  const globalGood = getGlobalGoodTracks(50);

  // Similarity pool: all tracks we have features for (cap) minus current
  const featurePool = getAllFeatureTrackIds(4000).filter((id) => id !== currentTrackId);

  // Candidate union with de-dupe
  const candidates = Array.from(new Set([
    ...seenAfter,
    ...globalGood,
    ...featurePool.slice(0, 500) // keep compute cheap for now
  ])).filter((id) => id !== currentTrackId);

  // Score all
  const scored = candidates.map((cand) => {
    const s = finalScore({ currentTrackId, candidateTrackId: cand });
    return { candidateTrackId: cand, ...s };
  });

  scored.sort((a, b) => b.total - a.total);

  // Pick best; later you’ll sample from top N for exploration
  const best = scored[0];
  if (!best) return null;

  const meta = await getTrackMeta(best.candidateTrackId);
  if (!meta) return null;

  return {
    currentTrackId,
    next: {
      track_id: meta.id,
      uri: meta.uri,
      name: meta.name,
      score: best.total,
      components: { markov: best.markov, sim: best.sim, global: best.global }
    },
    top10: scored.slice(0, 10)
  };
}
