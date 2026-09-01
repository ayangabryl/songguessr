-- Catalog source of truth. R2 keeps audio files only.
-- Official Spotify Web API has no play-count / "listens" field; we store popularity instead.
CREATE TABLE tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  preview_url TEXT,
  hook_preview_url TEXT,
  hook_start_seconds REAL,
  album_art TEXT,
  difficulty TEXT NOT NULL,
  popularity INTEGER,
  artist_popularity INTEGER,
  release_year INTEGER,
  duration_ms INTEGER,
  genre_groups TEXT,
  song_key TEXT,
  updated_at TEXT,
  spotify_synced_at TEXT
);

CREATE INDEX idx_tracks_difficulty ON tracks (difficulty);
CREATE INDEX idx_tracks_song_key ON tracks (song_key);
CREATE INDEX idx_tracks_title ON tracks (title);
CREATE INDEX idx_tracks_artist ON tracks (artist);
CREATE INDEX idx_tracks_spotify_synced_at ON tracks (spotify_synced_at);
