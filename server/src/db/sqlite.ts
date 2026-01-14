import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { ENV } from "../config/env.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Resolve DB path safely
  const dbPath = ENV.DATABASE_PATH || "./data/app.sqlite";
  const absPath = path.resolve(process.cwd(), dbPath);

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  db = new Database(absPath);
  return db;
}

