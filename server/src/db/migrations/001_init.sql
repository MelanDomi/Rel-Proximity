PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Raw event log (append-only)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_ms INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,          -- start | end | action | pos
  track_id TEXT,
  prev_track_id TEXT,
  position_ms INTEGER,
  reason TEXT,                        -- finished | skip_next | skip_prev | pause_stop | unknown
  device_id TEXT,
  payload_json TEXT                   -- optional: stash extra info
);

-- Global per-track stats
CREATE TABLE IF NOT EXISTS track_stats (
  track_id TEXT PRIMARY KEY,
  starts INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  skips_fast INTEGER NOT NULL DEFAULT 0,
  total_listen_ms INTEGER NOT NULL DEFAULT 0,
  last_played_ts_ms INTEGER
);

-- Pairwise transition stats: A -> B
CREATE TABLE IF NOT EXISTS transition_stats (
  from_track_id TEXT NOT NULL,
  to_track_id TEXT NOT NULL,
  starts INTEGER NOT NULL DEFAULT 0,
  skips_fast INTEGER NOT NULL DEFAULT 0,
  total_listen_ms INTEGER NOT NULL DEFAULT 0,
  last_ts_ms INTEGER,
  PRIMARY KEY (from_track_id, to_track_id)
);

-- Cached Spotify audio features
CREATE TABLE IF NOT EXISTS audio_features (
  track_id TEXT PRIMARY KEY,
  duration_ms INTEGER,
  danceability REAL,
  energy REAL,
  valence REAL,
  tempo REAL,
  acousticness REAL,
  instrumentalness REAL,
  liveness REAL,
  speechiness REAL,
  loudness REAL,
  updated_ts_ms INTEGER
);

-- Optional: store user/session token refs (you can start simple)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts_ms INTEGER NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at_ts_ms INTEGER NOT NULL
);
