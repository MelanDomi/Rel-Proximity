import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "../config/env.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.resolve(process.cwd(), ENV.SQLITE_PATH);
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  return db;
}

