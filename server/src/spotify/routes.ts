import { Router } from "express";
import { getValidAccessToken } from "./spotifyApi.js";

export const spotifyRouter = Router();

spotifyRouter.get("/token", async (_req, res) => {
  try {
    const token = await getValidAccessToken();
    res.json({ access_token: token });
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
  spotifyRouter.post("/transfer", async (req, res) => {
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ error: "Missing device_id" });

  await transferPlayback(device_id);
  res.json({ ok: true });
});

});
