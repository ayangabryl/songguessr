CREATE TABLE IF NOT EXISTS playlist_mixes (
  id TEXT PRIMARY KEY,
  metadata TEXT NOT NULL,
  track_ids TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
