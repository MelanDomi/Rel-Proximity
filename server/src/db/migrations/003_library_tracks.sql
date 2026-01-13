CREATE TABLE IF NOT EXISTS library_tracks (
  track_id TEXT PRIMARY KEY,
  uri TEXT NOT NULL,
  added_at TEXT,                 -- ISO timestamp from Spotify
  source TEXT NOT NULL,          -- e.g. 'liked'
  last_seen_ts_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_source ON library_tracks(source);
CREATE INDEX IF NOT EXISTS idx_library_last_seen ON library_tracks(last_seen_ts_ms);
