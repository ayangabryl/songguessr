-- Custom catalogs (OPM, K-pop, Anime, K-drama, …) with a Noto Color Emoji icon.
CREATE TABLE IF NOT EXISTS catalogs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎵',
  country TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_catalogs_name ON catalogs (name);

INSERT OR IGNORE INTO catalogs (id, name, emoji, country, created_at) VALUES
  ('opm', 'OPM', '🇵🇭', 'PH', datetime('now')),
  ('kpop', 'K-pop', '🇰🇷', 'KR', datetime('now')),
  ('anime', 'Anime', '🎌', NULL, datetime('now')),
  ('kdrama', 'K-drama', '📺', 'KR', datetime('now')),
  ('other', 'Other', '🎵', NULL, datetime('now'));
