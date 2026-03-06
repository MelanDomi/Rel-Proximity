import { Router } from "express";

export const eventsRouter = Router();

eventsRouter.post("/", (_req, res) => {
  // For now: accept and ignore (later we’ll store these)
  return res.json({ ok: true });
});
