CREATE TABLE IF NOT EXISTS playlist_import_jobs (
  id TEXT PRIMARY KEY,
  spotify_id TEXT NOT NULL,
  source TEXT NOT NULL,
  progress TEXT NOT NULL,
  cursor INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS playlist_import_jobs_expires ON playlist_import_jobs(expires_at);
