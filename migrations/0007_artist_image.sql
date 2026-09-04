-- Public artist portraits (Spotify oEmbed / iTunes), cached so Mix never hits the quota API.
ALTER TABLE artists ADD COLUMN image_url TEXT;
