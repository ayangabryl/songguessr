# Song search polish — 8 September 2026

Narrow maintenance pass using design-judgment: preserve the existing player, typography,
colors and guessing rules; share the dropdown behavior between solo and multiplayer.

## Changes

- Removed solo (5), multiplayer (8), API-client (12), and catalog candidate/result
  cutoffs. The API returns 40 matches per page with total and nextOffset; scrolling,
  the last keyboard option, or Show more requests another page.
- Both modes use one dropdown and request hook. Debounced requests are cancelled
  when the query changes. Existing results survive a failed later page; retry,
  initial loading, no matches, Escape, focus dismissal and keyboard selection work.
- The rounded panel contains its inset scrollbar. It chooses above/below based on
  available viewport space, listens for visual-viewport changes, and spans the
  transport row on narrow screens. Artwork loads lazily.
- Search normalizes punctuation and Latin accents, retains meaningful international
  marks, matches title/artist terms, ranks exact titles first and preserves artist
  typo suggestions. Deduplication happens before pagination.
- Server metadata is normalized once per database per 60 seconds, with concurrent
  requests sharing the read. Catalog edits can take up to one minute to reach this
  search index. This avoids repeated SQL normalization on each typed character.

## Verification

- Real remote D1 catalog through the local Worker: `a` returned 929 unique results
  across 24 pages, exactly matching total; `love` returned 37; `oliva` returned 15;
  `cant` returned 3; `senorita` returned 1; an unrelated query returned zero.
- Browser: solo and multiplayer selection, arrows scrolling only the dropdown,
  Escape/reopen, 40 → 80 incremental results, offline error and successful retry
  retaining the query, light/dark surfaces and narrow viewport bounds.
- Multiplayer uses the development match fixture for game transitions but real
  catalog search. No live multiplayer match or other player's score was changed.
- 54 shared/search/guess regression tests pass. Synthetic pagination checks all
  603 matches without duplicates. Production build and TypeScript pass. Targeted
  lint for new search modules passes; existing Game/MatchArena lint warnings remain.
- Local synthetic 20,000-track benchmark: index construction ~256 ms, warm search
  median ~7 ms / p95 ~19 ms (including typo fallback). This is a local CPU sample,
  not a production Worker latency or mobile performance guarantee. Cold index
  construction and large-catalog Worker CPU limits need consideration as it grows.

The existing 3010 preview now proxies API requests to a local Worker on 3000 using
its normal remote catalog binding. Temporary no-tunnel review configuration and
build/test logs live under `/tmp/song-search-review`. No deployment was performed.
