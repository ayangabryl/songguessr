-- Country / catalog origin so D1 can tell PH from future KR, JP, global catalogs.
-- popularity, artist_popularity, release_year, and genre_groups already exist on tracks.
-- Spotify has no official listen count; we store popularity (0–100) only.

ALTER TABLE tracks ADD COLUMN country TEXT DEFAULT 'PH';
ALTER TABLE tracks ADD COLUMN catalog TEXT DEFAULT 'opm';
ALTER TABLE tracks ADD COLUMN release_date TEXT;
ALTER TABLE tracks ADD COLUMN spotify_genres TEXT;
ALTER TABLE tracks ADD COLUMN chart_boost INTEGER DEFAULT 0;
ALTER TABLE tracks ADD COLUMN force_tier TEXT;

CREATE TABLE IF NOT EXISTS artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'PH',
  whitelisted INTEGER NOT NULL DEFAULT 1,
  popularity INTEGER,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tracks_country ON tracks (country);
CREATE INDEX IF NOT EXISTS idx_tracks_catalog ON tracks (catalog);
CREATE INDEX IF NOT EXISTS idx_tracks_chart_boost ON tracks (chart_boost);
CREATE INDEX IF NOT EXISTS idx_artists_country ON artists (country);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists (name);

UPDATE tracks SET country = 'PH' WHERE country IS NULL OR country = '';
UPDATE tracks SET catalog = 'opm' WHERE catalog IS NULL OR catalog = '';
