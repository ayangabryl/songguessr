# Faster song and artist search — 2026-09-08

Both solo and multiplayer now use a 60ms debounce (previously 180ms), immediate exact-query cached pages, and immediately ranked suggestions from up to 400 recently returned songs while the authoritative request completes. Partial previews keep the loading state; they do not claim the catalog is exhausted. The API still supplies the full count and pagination. Requests cancel on query changes and have an eight-second timeout with the existing retry UI. The 80-page LRU cache expires after one minute and stores song metadata only.

Artist include/exclude searches also use 60ms instead of 140/160ms, with no delay for already-cached results. Public song-search responses use canonical query/page keys in Cloudflare's Cache API for 60 seconds; failures are not cached, and cache write failures do not fail a search. Implementation follows the [Cloudflare Cache API pattern](https://developers.cloudflare.com/workers/examples/cache-api/).

## Verification

Before: production request sample was 498ms for the first query, then 76–79ms for warm requests, excluding the old 180ms UI delay. These are samples, not a network latency guarantee.

Local cache benchmark, 400 songs / 100 iterations: repeat lookup median 0.001ms, p95 0.005ms; matching preview median 0.968ms, p95 1.297ms. Local Worker first metadata read was 1275ms through remote D1; a warm query was 13ms and an edge-cache hit 5ms. Caching improves repeat searches; a cold catalog/network request still has real latency.

Ten search/cache tests passed, covering complete pagination across 603 fixture songs, normalization, ranking, artist typo fallback, expiration, bounded LRU storage and partial preview separation. Production build passed. Browser QA verified multiplayer repeat/refined searches, solo keyboard pagination from 40 to 80 of 929 songs, and rapid Taylor-to-Ben replacement showing only current Ben results. The existing contained dropdown and scrollbar are retained.

Production smoke check after deploy: first Taylor request 191ms, warm Love request 86ms, repeat Taylor edge hit 84ms (network-inclusive samples). Both 40-result pages for “a” reported the same 929 total and correct next offsets. The published frontend matched the verified build. A zone browser-TTL default surfaced as a four-hour header on a cache hit, so stored search responses now carry an explicit expiry checked by the Worker and hits restore only their remaining one-minute lifetime.
