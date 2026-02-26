import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Loads server/.env no matter where you run from
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function opt(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

const OFFLINE_MODE = process.env.OFFLINE_MODE === "true";

export const ENV = {
  OFFLINE_MODE,
  NODE_ENV: opt("NODE_ENV", "development")!,
  PORT: Number(opt("PORT", "5174")),
  CLIENT_ORIGIN: opt("CLIENT_ORIGIN", "http://localhost:5173")!,
  SESSION_SECRET: req("SESSION_SECRET"),

  // Spotify config is only required when not offline
  SPOTIFY_CLIENT_ID: OFFLINE_MODE ? "" : req("SPOTIFY_CLIENT_ID"),
  SPOTIFY_CLIENT_SECRET: OFFLINE_MODE ? "" : req("SPOTIFY_CLIENT_SECRET"),
  SPOTIFY_REDIRECT_URI: OFFLINE_MODE ? "" : req("SPOTIFY_REDIRECT_URI")
};
