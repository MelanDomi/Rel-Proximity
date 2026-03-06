import { Router } from "express";
import { getValidAccessToken } from "./spotifyApi.js";
import { transferPlayback, startPlayback } from "./playback.js";
import { getDb } from "../db/sqlite.js";

export const spotifyRouter = Router();

/**
 * Get a valid access token for the Spotify Web Playback SDK.
 */
spotifyRouter.get("/token", async (_req, res) => {
  try {
    const token = await getValidAccessToken();
    res.json({ access_token: token });
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
});

/**
 * Transfer playback to the browser device.
 * NOTE: play=false prevents Spotify DJ from auto-resuming.
 */
spotifyRouter.post("/transfer", async (req, res) => {
  const device_id = String(req.body?.device_id ?? "");
  if (!device_id) {
    return res.status(400).json({ error: "Missing device_id" });
  }

  try {
    await transferPlayback(device_id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({
      error: "Transfer playback failed",
      detail: String(e?.message ?? e)
    });
  }
});

/**
 * Start playback from a seed track chosen from the liked library.
 * This prevents Spotify's DJ or previous context from controlling playback.
 */
spotifyRouter.post("/start-seed", async (req, res) => {
  const device_id = String(req.body?.device_id ?? "");
  if (!device_id) {
    return res.status(400).json({ error: "Missing device_id" });
  }

  const db = getDb();

  const row = db
    .prepare(`
      SELECT track_id
      FROM library_tracks
      WHERE source='liked'
      ORDER BY RANDOM()
      LIMIT 1
    `)
    .get() as any;

  if (!row?.track_id) {
    return res.status(404).json({ error: "No liked tracks available" });
  }

  const uri = `spotify:track:${row.track_id}`;

  try {
    await startPlayback(device_id, uri);

    res.json({
      ok: true,
      started: {
        track_id: row.track_id,
        uri
      }
    });
  } catch (e: any) {
    res.status(500).json({
      error: "Start playback failed",
      detail: String(e?.message ?? e)
    });
  }
});
