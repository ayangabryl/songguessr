-- Songs can belong to many collections. The `catalogs` table keeps its name
-- (D1 rename of a live table is riskier than a join); admin/game copy says
-- "collection". `tracks.catalog` stays as a denormalized primary collection
-- for older queries and is kept in sync with this join table.
CREATE TABLE IF NOT EXISTS track_collections (
  track_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  PRIMARY KEY (track_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_track_collections_collection
  ON track_collections (collection_id);

CREATE INDEX IF NOT EXISTS idx_track_collections_track
  ON track_collections (track_id);

INSERT OR IGNORE INTO track_collections (track_id, collection_id)
SELECT id, catalog FROM tracks
WHERE catalog IS NOT NULL AND trim(catalog) != '';
