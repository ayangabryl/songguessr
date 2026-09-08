# Multiplayer / solo consistency — local acceptance

2026-09-08. Local only; no deployment or git push in this pass.

## Delivered

The solo console is the reference: shared typography, difficulty colors, ruler, play icon, search field, explicit selection then Guess, and song identity. Multiplayer now has one full-width listening stage, a stable shared Noot scene, quieter results, and standings below the task. The lobby exposes difficulty and song count; additional mix/score settings are grouped under Match options. Twelve-player rosters scroll within a bounded area. Large Noot parties scroll horizontally when their available width is too narrow, preserving readable characters and labels.

The name field uses an inset focus contour, fixing clipped rounded edges inside the invitation sheet. Character labels are accessible actions, replacing repeated Wave buttons. Score reordering animates both axes and respects reduced motion. Pause resumes decoded audio from its current position; final Pass/miss records the final ruler mark; spectators have no personal attempt ruler; early timeouts use their actual unlocked stage in the accessible description. Solved attempt counts use authoritative stage data even after reconnecting.

## Rendered checks

- Compared three working layouts and selected the full-width solo stage. See `docs/design/multiplayer-consistency/plan.md` and its study files. Native browser captures are in the task history. These are agent judgments, not independent human acceptance.
- Desktop and mobile views: lobby, playing, reveal, shared victory/final scores, timeout, spectator, and disconnected state. Light and dark themes; 2, 3, 6 and 12 players.
- 320px and 390px mobile widths: no page-level horizontal overflow. At 390px, the 12-player stage had 335px available and 768px scrollable content; the final player could be brought into view and waved to. The narrow layout retains full names in standings.
- Twelve-player lobby roster: 280px viewport / 672px content; settings remain below this bounded roster instead of twelve unbounded rows.
- Focused the actual invitation-sheet name field: complete rounded border, 1px accent border plus 1px inset shadow, no clipped outer ring.
- One canvas remained mounted through lobby → playing → finished; the development first-render marker remained unchanged (1322ms in that observed load). This is continuity evidence, not a cross-device loading benchmark.
- Keyboard search: `love` returned 37 catalog results. Arrow/Enter selected “Love Is — The Ridleys” without submitting. Disconnect disabled Guess while retaining the selected text; reconnect enabled submission. The development fixture accepts any submitted answer and is not a correctness oracle.

## Built-client integration

Built client on 127.0.0.1:3012 with the local Worker on port 3000, table YSPR, one browser player and two local protocol peers:

- Real catalog audio decoded, unmuted, through all acknowledged clip stages. Three skips produced three ruler marks and the 8-second stage.
- Pause at 3.215693s, then resumed to 4.449995s; a Noot wave did not stop or mute playback.
- “Love Goes — SB19” was selected without submission, then explicitly guessed. The server rejected it, advanced to 15s, and the ruler showed one miss and three skips. Final Pass disabled the controls, added the fifth mark, and standings said “Song passed.”
- Server reveal showed “Rockabye (feat. Sean Paul & Anne-Marie)” and its catalog cover/artist. Ready up changed to the disabled waiting state with the other names. The browser subsequently advanced to song 2 after the QA peers disconnected. The separate peer readiness driver timed out, so this does not claim an all-connected ready-up integration test.
- No browser errors or warnings in the built-client session.

## Verification and limits

133 regression tests passed across match rules, scoring, search, audio lifecycle, and Noot suites. `npm run build` passed. Production assets contain none of the development preview melody labels/fixture identifiers. Scoped lint had no errors; existing hook/effect/fast-refresh warnings remain. Build retains the existing large-chunk warnings.

Browser media state and decoded time were checked; no microphone recording was made. Mobile testing used Chromium viewport emulation, not physical iOS/Safari devices. The preview melody is an original generated WAV, limited to the DEV-only fixture. Ongoing wardrobe and song-validation work in the shared checkout was preserved and is not claimed as authored here.
