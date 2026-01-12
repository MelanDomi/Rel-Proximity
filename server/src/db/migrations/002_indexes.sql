CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts_ms);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_track ON events(track_id);
CREATE INDEX IF NOT EXISTS idx_transition_last ON transition_stats(last_ts_ms);
