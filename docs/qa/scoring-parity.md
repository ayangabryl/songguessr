# Solo / multiplayer scoring parity — 2026-09-08

Both modes now use `shared/score.ts`. With the default five clip stops (0.1, 0.5, 2, 8, 15 seconds), correct guesses earn 5, 4, 3, 2, 1 points respectively. Skips and incorrect guesses unlock the next stop; passing or timing out earns zero. Difficulty, streak and submission speed add no multiplier. Solo retains its existing configurable enabled stops; multiplayer uses the shared default stops for everyone.

The Worker initializes new matches at scoring version 3. On room initialization, before processing events, a concurrency-locked migration converts older match totals, current deltas, per-song histories and completed-round results together (version 2 / 1000, original version / 200). It preserves ranking and score carry-over and records version 3 to prevent repeated conversion. No rounds are reset and no hidden answers are exposed.

Validation:
- 39 focused tests passed, including every clip stop at all five difficulties, early/late submissions, duplicate requests, mixed misses/skips, timeouts, both legacy versions, migration idempotence, reconnect serialization, archive consistency, rematch reset/carry-over and ranking behavior.
- Actual local Worker table VASZ with two protocol clients: scoring version 3, five skips each, zero-point shared reveal, restored history after reconnect.
- Local browser preview: first stop shows 5 points, four skips reach 1 point, correct result shows +5, sitting history and standings use the same scale.
- Production build passed. Scoped lint reported existing React effect/ref warnings in the arena/preview, with no new scoring-rule warnings. Whitespace check passed.
