import { Router } from "express";
import { z } from "zod";
import { recommendNext } from "./recommend.js";
import { addToQueue } from "../spotify/playback.js";

export const recommendRouter = Router();

recommendRouter.get("/next", async (req, res) => {
  const current = String(req.query.current ?? "");
  if (!current) return res.status(400).json({ error: "Missing ?current=TRACK_ID" });

  const rec = await recommendNext(current);
  if (!rec) return res.status(404).json({ error: "No recommendation available yet" });

  res.json(rec);
});

recommendRouter.post("/queue-next", async (req, res) => {
  const Body = z.object({
    current_track_id: z.string().min(5),
    device_id: z.string().optional()
  });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { current_track_id, device_id } = parsed.data;

  const rec = await recommendNext(current_track_id);
  if (!rec) return res.status(404).json({ error: "No recommendation available yet" });

  await addToQueue({ uri: rec.next.uri, deviceId: device_id });

  res.json({ ok: true, queued: rec.next });
});
