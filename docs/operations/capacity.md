# Capacity assessment — 2026-09-08

**Status: 1,000 local WebSocket clients passed; 1,000 production players are not certified.**

`node scripts/qa-sitting-capacity.mjs` opened 1,000 real WebSocket clients against the local Worker emulator, spread across 100 isolated tables of 10. Ramp: 11.9 seconds. Heartbeat latency: p50 85ms, p95 91ms. All 10,000 expected jump-event deliveries arrived, and all clients stayed connected with zero socket errors. The script closes its own QA connections afterward. This is a short transport test, not an audio/database/browser rendering test or a production soak.

## Architecture and remaining limits

- One Durable Object per table, maximum 12 players. State and motion broadcasts stay within a table. Hibernating WebSockets and automatic ping/pong are already used. 1,000 players means at least 84 tables; the benchmark used 100. Cloudflare documents a soft 1,000 requests/sec limit per object, not 1,000 players across the app.
- All catalog queries use one shared D1 database. D1 processes queries one at a time; random selection performs count/tier queries and retries on unavailable audio. A new solo session currently requests five difficulty rounds, so 1,000 simultaneous solo starts could request 5,000 picks, with several SQL queries per pick. This is the main unproven burst-load path. Cache reusable filtered counts and consider lazy difficulty loading before making a high-concurrency claim; never cache random picks or remove playlist scope.
- Search already has bounded edge/in-memory caches. Actual mixed-prefix cache misses still need realistic load measurement.
- Audio uses R2/external previews. This test does not measure 1,000 listeners, range-request cache hit rates, external-source limits, or global network latency.
- Cloudflare Workers Free has a 100,000-request daily quota; D1 Free has daily row-read/write limits. Sustained 1,000-player operation must be evaluated against the account's actual plan and usage. The available credential returned HTTP 403 for subscription reads, so no billing tier was verified or changed.

## Production-readiness gate

Use a separate deployed staging Worker with representative D1/R2 data and quotas. Ramp 100 → 250 → 500 → 1,000 virtual players across 84–100 tables; include synchronized starts, song searches, valid guesses, passes, ready/host-confirm, reconnects, Noot motion and audio ranges. Soak at target for at least 30 minutes. Include a separate solo-start burst. Observe Cloudflare CPU/errors, D1 rows/queue latency, R2/cache behavior and client p50/p95/p99 latency. Proposed acceptance targets: no unexpected disconnects or lost authoritative actions, <0.1% server errors, p95 search <300ms and song-start <2s (measured from the relevant regions). These are targets, not measured production results. No production stress test was run in this task.

Sources: [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/), [D1 concurrency FAQ](https://developers.cloudflare.com/d1/reference/faq/), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
