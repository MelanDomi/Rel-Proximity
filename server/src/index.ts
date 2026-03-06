import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eventsRouter } from "./events/routes.js";

// Resolve paths relative to this file (server/src/index.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env reliably
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Data dir: server/data (absolute)
const DATA_DIR = path.resolve(__dirname, "../data");

import fs from "node:fs";
fs.mkdirSync(DATA_DIR, { recursive: true });

import express from "express";
import cors from "cors";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";

import { ENV } from "./config/env.js";
import { migrate } from "./db/migrate.js";

import { authRouter } from "./auth/routes.js";
import { libraryRouter } from "./library/routes.js";
import { recommendRouter } from "./recommend/routes.js";
import { spotifyRouter } from "./spotify/routes.js";

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: ENV.CLIENT_ORIGIN,
    credentials: true
  })
);

// Persistent sessions in SQLite (survive server restarts)
const SQLiteStore = connectSqlite3(session);

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: DATA_DIR
    }),
    secret: ENV.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    }
  })
);

migrate();

app.use("/auth", authRouter);
app.use("/library", libraryRouter);
app.use("/recommend", recommendRouter);
app.use("/spotify", spotifyRouter);

app.listen(ENV.PORT, () => {
  console.log(`Server listening on http://localhost:${ENV.PORT}`);
});
