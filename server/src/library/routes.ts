import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/sqlite.js";
import { syncLikedSongsToDb } from "../spotify/library.js";
import { syncLikedFromLocalFile } from "./offlineSync.js";

export const libraryRouter = Router();

// Sync liked songs into library_tracks + backfill audio features (Spotify mode)
// OR sync from local JSON file (offline mode)
libraryRouter.post("/sync-liked", async (req, res) => {
  const offline = process.env.OFFLINE_MODE === "true";

  // OFFLINE: load from server/data/liked_songs.json
  if (offline) {
    try {
      const out = syncLikedFromLocalFile();
      return res.json({
        ok: true,
        fetched_tracks: out.fetched_tracks,
        audio_features: { offline: true }
      });
    } catch (e: any) {
      return res.status(500).json({
        error: "Offline sync failed. Make sure server/data/liked_songs.json exists and is valid JSON.",
        detail: String(e?.message ?? e)
      });
    }
  }

  // ONLINE: use Spotify Web API
  const Body = z.object({
    max_tracks: z.number().int().positive().optional(),
    max_feature_fetch: z.number().int().positive().optional(),
    refresh_features_older_than_days: z.number().int().positive().optional()
  });

  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const out = await syncLikedSongsToDb({
    maxTracks: parsed.data.max_tracks,
    maxFeatureFetch: parsed.data.max_feature_fetch,
    refreshFeaturesOlderThanDays: parsed.data.refresh_features_older_than_days
  });

  return res.json(out);
});

libraryRouter.get("/count", (_req, res) => {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT COUNT(*) as n
      FROM library_tracks
      WHERE source='liked'
    `
    )
    .get() as any;

  res.json({ liked_count: row?.n ?? 0 });
});
