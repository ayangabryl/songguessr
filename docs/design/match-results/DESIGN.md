# Explicit multiplayer results

Focused refinement of the existing solo-style reveal and final screen. Keep Instrument Serif headings, Noot portraits, green primary controls, song art/playback, scores and sitting history. No marketing surface or new navigation system.

Observed: each ready-up command currently starts the next round as soon as everyone is ready; disconnecting an unready player can also trigger continuation. In the development preview, Play again starts immediately. The result lacks a central player-by-player recap. A rapid final-pass click also puts a new action near the old control.

Use the existing main screen rather than a dismissible overlay. On reveal, focus the result heading, name the song and show each player's outcome, round points and total. Final screen shows rank and total. Keep it visible indefinitely. Each player can ready/unready; then the host separately confirms Start next song / Start new match. No timeout, disconnect, duplicate ready message or old round ID can continue the match. A brief input guard prevents click-through at reveal. Host transfer permits the new host to continue when remaining players explicitly agreed.

Preserve the floating scoreboard during play; use the central recap during results to avoid competing score panels. Twelve-player recap scrolls inside the result area; footer remains reachable on a phone. Respect reduced motion and avoid relocating keyboard focus on readiness updates.

QA: 69 shared/worker tests passed. A three-player real WebSocket test confirmed all-ready holds the result, disconnecting an unready guest does not continue, a non-host/stale confirmation is rejected, unready blocks the host, and explicit host confirmation loads a scoped next song. The full ten-round match verifies final standings and score reset on an explicit rematch. Browser review covered light desktop final standings, undo/ready/start, dark 390px twelve-player results, list scrolling and reachable controls. Fixed a cramped mobile avatar column. Restored the default viewport. New result code and changed test scripts pass focused lint.

Compatibility: new clients use match-ready, match-unready and match-continue. Old match-next messages receive a readable refresh notice, preserving stored scores. No old-client action silently advances a round.
