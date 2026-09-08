# Shared sitting history — local QA, 2026-09-08

Multiplayer now reuses the same SittingHistory component as solo: newest completed songs first, points, title/artist and the compact Ruler signature. Server-owned attempt records include every skip/miss, including final Pass. Completed-song metadata is archived only at shared reveal and retained when starting the next round. The archive is bounded to the match's maximum 20 songs and starts fresh for a new match. Live totals and ranking behavior are unchanged.

Verification:
- 17 focused match/history tests passed: final Pass, duplicate/stale commands, mixed misses/skips, timeout without invented attempts, reconnect serialization, later-round preservation, spectator filtering, compatibility with older revealed matches and no answer leak during play.
- Production build passed with the existing bundle-size warnings. Scoped lint and whitespace checks passed.
- Actual local Worker table ZNZY with two protocol clients: both skipped all five stages, no archive/answer appeared during play, one revealed song contained both zero-point results with five skips, and reconnect restored the same history. These were local QA seats, not production players.
- Browser desktop and 390px mobile captures show the shared ledger, zero-point passed rows, five visible skip rings, and a scored win. Both light/dark themes inspected; page width stayed within viewport; no browser errors/warnings. Preview data is explicitly fictional and DEV-only.

Older songs that were never stored cannot be reconstructed. Compatibility preserves the current revealed song when upgrading an existing match, without inventing unavailable attempt details. The new change is local and has not been pushed or deployed in this pass.
