# Playlist mix

Add one public Spotify playlist to the existing Mix surface, shared by solo and the multiplayer host. Preserve typography, color, controls, draft/apply/cancel behavior, artist and genre exclusions, scoring, difficulty and search. This is a focused filter extension rather than a panel redesign.

Use a labeled URL field and Add button above the existing filters. Once resolved, show a compact selected playlist with its title, playable count, source link and Remove action. “Only these songs” must be explicit. Loading, invalid links, inaccessible playlists, no playable previews, partial Spotify previews and retry must be visible. Adding/replacing remains draft until Apply; Close cancels; Clear mix removes it. No new modal or nested tabs.

Membership is a server-created immutable snapshot of exact Spotify IDs whose previews have been checked; missing songs are added to the game catalog before the snapshot is applied. Other filters intersect this scope. Missing snapshots, empty pools and failed audio probes fail closed; no fallback may drop the playlist constraint. The host's snapshot persists across rounds/reconnects. Public preview fallback is labeled partial and never uses a historical archive. Private playlists need a public link for this first implementation. Spotify's current API items endpoint is owner/collaborator restricted; public embeds can expose only part of a playlist.

Verify actual public playlist resolution, strict solo picks, multiplayer round starts/next rounds/reconnects, cancellation/clear, invalid/empty states and narrow layout before release. User confirmed Spotify links.

Implementation: the host's Mix entry is visible directly in the lobby and names the selected playlist. Its sheet uses the same PlaylistMix component, draft controls, count validation, and retry state as solo. Existing rounded inputs, theme colors, scroll container and anchored footer are retained.

QA, 2026-09-08:
- Production TypeScript/client/worker/admin build passed. All 68 shared and worker tests passed; new playlist files pass focused lint. Repository lint completes with existing warnings, including React effect warnings in the surrounding filter code.
- `node scripts/qa-playlist-mix.mjs` imported a live public Spotify playlist, tested ten picks across all five difficulty levels, exhausted recent exclusions to exercise fallback, and confirmed missing snapshots / conflicting filters return no songs.
- An isolated three-player local table used the same playable audio and playlist snapshot; both revealed answers remained members, and reconnect plus next-song/history worked.
- Browser QA verified invalid song links, Clear mix with unfinished input, import, apply, refresh persistence, draft removal cancellation, and host selection. Reviewed dark desktop and light 390px phone layouts; input/Add, long helper copy, selected card, scrolling and fixed footer fit correctly. Restored browser viewport afterward.

Spotify sources: [Get Playlist Items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items) and [Get Playlist](https://developer.spotify.com/documentation/web-api/reference/get-playlist). Public preview fallback is deliberately partial. It references provider previews and does not download full recordings. A selected mix is a snapshot; Refresh playlist rechecks and updates it.

Missing-song preparation, 2026-09-08:
- Imports run in batches of four, with two concurrent checks and bounded provider requests. Existing working audio is retained; dead previews can be repaired without replacing curated metadata or deleting other recordings. New rows preserve exact Spotify IDs.
- The shared solo/host component displays progress, cancel, resumable retry, refresh, and a per-song unavailable report. Reports expire after seven days; the selected playable snapshot remains. Existing selection stays active until the new draft is applied.
- Only exact recording matches can supply fallback previews. Songs with no accessible preview remain unavailable; Spotify public embeds may expose only part of a playlist. No unrelated songs fill these gaps.
- Search caches and server indexes are scoped to the immutable playlist, so imported songs are immediately guessable without leaking global suggestions.
- Live local import checked all 50 tracks from Top 50 Philippines: 50 playable, 12 newly added, zero unavailable. Re-import plus ten solo picks, scoped search and a three-player/two-round shared-audio test passed. This demonstrates this playlist, not universal Spotify availability.
- Final validation: 77 shared/worker/search-cache tests and production build passed. Desktop and 390px browser QA confirmed import completion, immediate search for a newly imported song, apply, refresh/cancel retention and unclipped controls. Focused lint has only the existing search-hook effect warning.
