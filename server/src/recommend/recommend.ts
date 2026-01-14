import { spotifyFetch } from "../spotify/spotifyApi.js";
import { finalScore } from "./score.js";
import { getLikedLibraryTrackIds, getGlobalGoodTracks, getTopTransitionCandidates } from "./candidates.js";

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
  // 1) Candidate sources
  const seenAfter = getTopTransitionCandidates(currentTrackId, 25);
  const globalGood = getGlobalGoodTracks(50);
  const libraryPool = getLikedLibraryTrackIds(5000).filter((id) => id !== currentTrackId);

  // 2) Union + de-dupe
  const candidates = Array.from(
    new Set<string>([...seenAfter, ...globalGood, ...libraryPool])
  ).filter((id) => id !== currentTrackId);

  if (candidates.length === 0) return null;

  // 3) Score
  const scored = candidates.map((cand) => {
    const s = finalScore({ currentTrackId, candidateTrackId: cand });
    return { candidateTrackId: cand, ...s };
  });

  scored.sort((a, b) => b.total - a.total);

  // 4) Pick best (later we’ll add exploration)
  const best = scored[0];
  if (!best) return null;

  // 5) Metadata (Spotify)
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
