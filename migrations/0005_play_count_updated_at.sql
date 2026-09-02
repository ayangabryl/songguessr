-- When the public web-player stats for a track were last written.
-- Left NULL when enrichment failed, so a later sweep retries the track instead
-- of treating a missing play count as "already checked".
ALTER TABLE tracks ADD COLUMN play_count_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_tracks_play_count_updated_at
  ON tracks (play_count_updated_at);
