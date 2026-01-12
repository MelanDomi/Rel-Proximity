import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ENV } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { migrate } from "./db/migrate.js";

migrate();

const app = express();
app.use(cors({
  origin: ENV.CLIENT_ORIGIN,
  credentials: true
}));
app.use(cookieParser(ENV.SESSION_SECRET));
app.use(express.json({ limit: "1mb" }));

app.use(apiRouter);

app.listen(ENV.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${ENV.PORT}`);
});
