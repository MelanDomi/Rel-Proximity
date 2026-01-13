import { Router } from "express";
import { authRouter } from "../auth/routes.js";
import { healthRouter } from "./health.js";
import { ingestEvent } from "../ingest/eventIngest.js";
import { spotifyRouter } from "../spotify/routes.js";
import { recommendRouter } from "../recommend/routes.js";



export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/", healthRouter);
apiRouter.use("/spotify", spotifyRouter);
apiRouter.use("/recommend", recommendRouter);



apiRouter.post("/events", (req, res) => {
  ingestEvent(req, res).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });
});
