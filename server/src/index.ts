import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---- Load .env safely relative to this file ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ---- Core imports ----
import express from "express";
import cors from "cors";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";

import { ENV } from "./config/env.js";
import { migrate } from "./db/migrate.js";

// ---- Route imports (adjust if paths differ) ----
import { authRouter } from "./auth/routes.js";
import { libraryRouter } from "./library/routes.js";
import { recommendRouter } from "./recommend/routes.js";
import { spotifyRouter } from "./spotify/routes.js";

// ---- Create app FIRST ----
const app = express();

// ---- Middleware ----
app.use(express.json());

app.use(
  cors({
    origin: ENV.CLIENT_ORIGIN,
    credentials: true
  })
);

// ---- Persistent session store (prevents logout on restart) ----
const SQLiteStore = connectSqlite3(session);

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: "./server/data"
    }),
    secret: ENV.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false // local development
    }
  })
);

// ---- Run DB migrations ----
migrate();

// ---- Mount routes ----
app.use("/auth", authRouter);
app.use("/library", libraryRouter);
app.use("/recommend", recommendRouter);
app.use("/spotify", spotifyRouter);

// ---- Start server ----
app.listen(ENV.PORT, () => {
  console.log(`Server listening on http://localhost:${ENV.PORT}`);
});
