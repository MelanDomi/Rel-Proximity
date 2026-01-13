export type AudioRow = {
  track_id: string;
  duration_ms: number | null;
  danceability: number | null;
  energy: number | null;
  valence: number | null;
  tempo: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  liveness: number | null;
  speechiness: number | null;
  loudness: number | null;
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function n01(x: number | null, fallback = 0): number {
  if (typeof x !== "number" || Number.isNaN(x)) return fallback;
  return clamp01(x);
}

function scaleTempo(tempo: number | null): number {
  if (typeof tempo !== "number" || Number.isNaN(tempo)) return 0.5;
  // Typical pop range ~ 60-180. Clamp a bit wider.
  const min = 50, max = 200;
  return clamp01((tempo - min) / (max - min));
}

function scaleLoudness(loudness: number | null): number {
  if (typeof loudness !== "number" || Number.isNaN(loudness)) return 0.5;
  // Spotify loudness usually ~ -60..0 dB
  const min = -60, max = 0;
  return clamp01((loudness - min) / (max - min));
}

export function toVector(a: AudioRow): number[] {
  return [
    n01(a.danceability),
    n01(a.energy),
    n01(a.valence),
    scaleTempo(a.tempo),
    n01(a.acousticness),
    n01(a.instrumentalness),
    n01(a.liveness),
    n01(a.speechiness),
    scaleLoudness(a.loudness)
  ];
}

export function cosineSim(v1: number[], v2: number[]): number {
  let dot = 0, n1 = 0, n2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    n1 += v1[i] * v1[i];
    n2 += v2[i] * v2[i];
  }
  if (n1 === 0 || n2 === 0) return 0;
  return dot / (Math.sqrt(n1) * Math.sqrt(n2));
}
