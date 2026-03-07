import { Router } from "express";
import { z } from "zod";
import { recommendNext } from "./recommend.js";
import { spotifyFetch } from "../spotify/spotifyApi.js";

export const recommendRouter = Router();

// GET /recommend/next?current=<trackId>&recent_track_ids=id1,id2,id3
recommendRouter.get("/next", async (req, res) => {
  const current = String(req.query.current ?? "").trim();
  if (!current) {
    return res.status(400).json({ error: "Missing query param: current" });
  }

  const recentTrackIds =
    typeof req.query.recent_track_ids === "string" && req.query.recent_track_ids.trim().length > 0
      ? req.query.recent_track_ids
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  try {
    const rec = await recommendNext(current, recentTrackIds);

    if (!rec) {
      return res.json({ ok: false, error: "No recommendation available yet" });
    }

    return res.json({ ok: true, ...rec });
  } catch (e: any) {
    return res.status(500).json({
      error: "Recommend failed",
      detail: String(e?.message ?? e)
    });
  }
});

// POST /recommend/queue-next
// body: {
//   current_track_id: string,
//   device_id: string,
//   recent_track_ids?: string[]
// }
recommendRouter.post("/queue-next", async (req, res) => {
  const Body = z.object({
    current_track_id: z.string().min(1),
    device_id: z.string().min(1),
    recent_track_ids: z.array(z.string()).optional().default([])
  });

  const parsed = Body.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { current_track_id, device_id, recent_track_ids } = parsed.data;

  try {
    const rec = await recommendNext(current_track_id, recent_track_ids);

    if (!rec) {
      return res.json({
        ok: false,
        queued: null,
        error: "No recommendation available yet"
      });
    }

    await spotifyFetch(
      `/me/player/queue?uri=${encodeURIComponent(rec.next.uri)}&device_id=${encodeURIComponent(device_id)}`,
      "POST"
    );

    return res.json({
      ok: true,
      queued: rec.next,
      from: current_track_id
    });
  } catch (e: any) {
    return res.status(500).json({
      error: "Queue failed",
      detail: String(e?.message ?? e)
    });
  }
});
