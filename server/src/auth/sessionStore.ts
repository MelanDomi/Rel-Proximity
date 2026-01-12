import { getDb } from "../db/sqlite.js";

export type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expires_at_ts_ms: number;
};

export function upsertTokens(tokens: StoredTokens): void {
  const db = getDb();

  // Keep only the latest row (single-user)
  db.prepare("DELETE FROM oauth_tokens").run();
  db.prepare(`
    INSERT INTO oauth_tokens(created_ts_ms, access_token, refresh_token, expires_at_ts_ms)
    VALUES (?, ?, ?, ?)
  `).run(Date.now(), tokens.access_token, tokens.refresh_token, tokens.expires_at_ts_ms);
}

export function getTokens(): StoredTokens | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT access_token, refresh_token, expires_at_ts_ms
    FROM oauth_tokens
    ORDER BY created_ts_ms DESC
    LIMIT 1
  `).get() as any;

  if (!row) return null;
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_at_ts_ms: row.expires_at_ts_ms
  };
}
