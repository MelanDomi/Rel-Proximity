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
});
