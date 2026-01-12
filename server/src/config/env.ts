import dotenv from "dotenv";
dotenv.config();

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const ENV = {
  PORT: Number(process.env.SERVER_PORT ?? "5174"),
  SESSION_SECRET: req("SESSION_SECRET"),

  SPOTIFY_CLIENT_ID: req("SPOTIFY_CLIENT_ID"),
  SPOTIFY_CLIENT_SECRET: req("SPOTIFY_CLIENT_SECRET"),
  SPOTIFY_REDIRECT_URI: req("SPOTIFY_REDIRECT_URI"),

  // Where sqlite file lives
  SQLITE_PATH: process.env.SQLITE_PATH ?? "data/app.sqlite",

  // Client origin for CORS
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173"
};
