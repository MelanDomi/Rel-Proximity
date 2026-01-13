import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/sqlite.js";
import { syncLikedSongsToDb } from "../spotify/library.js";

export const libraryRouter = Router();

// Sync liked songs into library_tracks + backfill audio features
libraryRouter.post("/sync-liked", async (req, res) => {
  const Body = z.object({
    max_tracks: z.number().int().positive().optional()
  });

  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const out = await syncLikedSongsToDb({ maxTracks: parsed.data.max_tracks });
  res.json(out);
});

// Count tracks in your liked library
libraryRouter.get("/count", (_req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) as n
    FROM library_tracks
    WHERE source='liked'
  `).get() as any;

  res.json({ liked_count: row?.n ?? 0 });
});
