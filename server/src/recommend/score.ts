import { getDb } from "../db/sqlite.js";
import { BAYES } from "../config/constants.js";
import { cosineSim, toVector } from "./vectorize.js";
import { getAudioRow } from "./candidates.js";

export function markovScore(fromTrackId: string, toTrackId: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT starts, skips_fast
    FROM transition_stats
    WHERE from_track_id = ? AND to_track_id = ?
  `).get(fromTrackId, toTrackId) as any;

  const starts = row?.starts ?? 0;
  const skips = row?.skips_fast ?? 0;

  const skipRate = (skips + BAYES.ALPHA) / (starts + BAYES.ALPHA + BAYES.BETA);
  return 1 - skipRate; // 0..1
}

export function globalTrackGoodness(trackId: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT starts, skips_fast, completions
    FROM track_stats
    WHERE track_id = ?
  `).get(trackId) as any;

  const starts = row?.starts ?? 0;
  const skips = row?.skips_fast ?? 0;
  const completions = row?.completions ?? 0;

  if (starts <= 0) return 0.5;

  // Lower skip rate = better, higher completion rate = better
  const skipRate = (skips + 1) / (starts + 4);
  const completionRate = (completions + 1) / (starts + 4);

  // Blend into 0..1
  return Math.max(0, Math.min(1, 0.65 * (1 - skipRate) + 0.35 * completionRate));
}

export function similarityScore(currentTrackId: string, candidateTrackId: string): number {
  const a = getAudioRow(currentTrackId);
  const b = getAudioRow(candidateTrackId);
  if (!a || !b) return 0;

  const v1 = toVector(a);
  const v2 = toVector(b);
  const sim = cosineSim(v1, v2);

  // cosine is typically 0..1 here, but guard
  return Math.max(0, Math.min(1, sim));
}

export function finalScore(args: {
  currentTrackId: string;
  candidateTrackId: string;
  wMarkov?: number;
  wSim?: number;
  wGlobal?: number;
}): { total: number; markov: number; sim: number; global: number } {
  const wMarkov = args.wMarkov ?? 0.7;
  const wSim = args.wSim ?? 0.25;
  const wGlobal = args.wGlobal ?? 0.05;

  const m = markovScore(args.currentTrackId, args.candidateTrackId);
  const s = similarityScore(args.currentTrackId, args.candidateTrackId);
  const g = globalTrackGoodness(args.candidateTrackId);

  const total = wMarkov * m + wSim * s + wGlobal * g;
  return { total, markov: m, sim: s, global: g };
}
