import fs from "node:fs";
import path from "node:path";
import { getDb } from "./sqlite.js";

function listMigrationFiles(): string[] {
  const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // 001_... then 002_...
  return files.map((f) => path.join(migrationsDir, f));
}

export function migrate(): void {
  const db = getDb();
  db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

  const files = listMigrationFiles();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_ts_ms INTEGER NOT NULL
    );
  `);

  const applied = new Set<string>(
    db.prepare("SELECT filename FROM _migrations").all().map((r: any) => r.filename)
  );

  const insertApplied = db.prepare(
    "INSERT INTO _migrations(filename, applied_ts_ms) VALUES (?, ?)"
  );

  const now = Date.now();

  for (const filepath of files) {
    const filename = path.basename(filepath);
    if (applied.has(filename)) continue;

    const sql = fs.readFileSync(filepath, "utf-8");
    const tx = db.transaction(() => {
      db.exec(sql);
      insertApplied.run(filename, now);
    });
    tx();
    // eslint-disable-next-line no-console
    console.log(`Applied migration: ${filename}`);
  }
}

