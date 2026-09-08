# Multiplayer audio, standings and Noot loading — local QA

Date: 2026-09-08. Scope: local fixes; no production deployment in this pass.

## Changes

- Replace the document-wide muted play/pause unlock with one cancellable clip owner. Only the active request can report playback or end it. A stopped request cannot interrupt a newer replay.
- Wait for metadata and seeking before playing an offset. Measure the clip endpoint from decoded media time so buffering cannot consume the clip. Preserve server-acknowledged skip continuation and saved music volume.
- Render a real, hidden audio element for lifecycle ownership and browser inspection; expose preparation separately from playback. Autoplay refusal remains retryable through Play.
- Remove standings row rules, decorative score bars and the tie-note rule. Keep the main section boundary, ranks, statuses and numerical scores.
- Preload the existing shared GLB from HTML and begin decoding at app startup, before stage setup. Keep canvases measurable while loading and show them after the first render. Mount labels before that render, including paused/reduced-motion stages.
- Prevent first-visit customization and the invitation sheet from trapping focus simultaneously.

## Evidence

- Two browser clients, local Worker/Durable Object table SQGB, real catalog audio (Spotify preview URLs). Both decoded the same song; reveal advanced to about 14.99 seconds. Replay was unmuted, unpaused, and remained playing after a Noot wave.
- Local production build on port 3012, table SKJU: five local protocol test peers plus one browser player. Observed decoded endpoints: 0.092, 0.494, 1.993 and 7.993 seconds for the 0.1/0.5/2/8-second stages. An eight-second replay remained playing and unmuted at 1.485 seconds after a wave interaction.
- Mobile review at 390 × 844: six Noots visible, all six standings rows readable, no horizontal overflow. First-time invite flow had one active dialog; name entry and joining succeeded. No console errors/warnings in the built client.
- Warm two-Noot stage: first render reported 449 ms. Development sample: 105 draw calls, median frame interval 8.3 ms, p95 interval 9.3 ms, p95 CPU 1 ms. This is one local Mac sample, not a cross-device benchmark or a measured cold-network speedup.
- 127 regression tests passed, including seven new audio lifecycle tests (buffering, metadata/seek, cancellation, stale play promises, blocked autoplay/retry, absent source and disposal). Production build passed; existing bundle-size warnings remain.

## Limits

Playback verification used browser media state and advancing decoded time, not a microphone recording. At this earlier checkpoint, MatchPreview had no song source; audio QA used actual local multiplayer tables. The subsequent consistency pass adds a DEV-only generated melody; see multiplayer-consistency.md. Mobile viewport QA is Chromium emulation, not physical iOS/Safari hardware.

Other ongoing wardrobe, preferences and song-validation edits in the shared checkout were preserved. Those changes are not claimed as authored by this pass.
