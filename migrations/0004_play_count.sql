-- Public Spotify track page play counts (not Web API popularity).
-- Only store values parsed from open.spotify.com / Pathfinder JSON. Never invent.
ALTER TABLE tracks ADD COLUMN play_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks (play_count);
