# SongGuessr: satisfying competition

## Evidence and design implications

Przybylski, Rigby and Ryan describe competence, autonomy and relatedness as foundations of video-game motivation. Give players understandable feedback about skill, control over difficulty, and meaningful interaction with friends.
Source: https://selfdeterminationtheory.org/SDT/documents/2010_PrzybylskiRigbyRyan_ROGP.pdf

Leaderboard results depend on design and context. A citizen-science game study questions treating rankings as a universal performance enhancer. Keep personal progress and nearby rivals visible rather than only showcasing leaders.
Source: https://arxiv.org/abs/1707.03704

These findings inform the design; they do not establish that these changes will increase SongGuessr retention. Evaluate round completion, voluntary rematches, perceived fairness and enjoyment with actual players. Avoid pressure mechanics such as expiring streaks, punishment for leaving or artificial scarcity.

## Implemented match rules

- A table offers 5, 10, 15 or 20 songs. Auto difficulty is the default and cycles through easy, medium, hard, expert and impossible; a fixed level remains available. The host configures the match; the server chooses a shared song and intro from the global mix.
- Everyone gets a three-second countdown and a 90-second round deadline. Each player unlocks clips independently: 0.1, 0.5, 2, 8 and 15 seconds.
- A correct answer earns 1,000, 800, 600, 400 or 200 points. Skips and incorrect guesses advance only that player's stage; passing the final stage earns zero. No speed bonus or streak multiplier.
- Scores start at zero. The host chooses whether subsequent matches reset scores or carry accumulated points. Equal totals share a rank. The live board shows who skipped, who solved, each player's clip stage and the nearest higher score.
- The answer remains hidden until everyone finishes or the deadline expires. Each connected participant marks ready; the next song begins only when all current participants agree. The selected final song ends with standings, and another unanimous ready check starts the next match.
- The server validates guesses, stages and round IDs. Duplicate or stale commands cannot award points twice. Client-supplied score deltas are ignored during matches.
- Reconnecting preserves the player's score and current stage. A private seat token prevents taking a seat by copying its public player ID. Disconnected players have until the round deadline; host duties pass to a connected player.
- Mid-match arrivals spectate until the next match. Departed participants retain their earned match points. A rematch requires two connected players.

## Presentation and motion

The table reuses the solo game’s theme tokens, wordmark, pill controls and typography. It uses sentence-case copy, compact scoring feedback and a live board. Dark mode uses the same hierarchy. Noot runs on skips; the shared album reveal adds a sleeve wobble and a small surprised body reaction. Reduced-motion preferences suppress decorative motion.

The solo game keeps its existing points scale. Table scores are a separate competitive session and never import solo points.

## Validation and limits

Pure rules tests cover independent stages, shared reveal, deadlines, ties, malformed messages and duplicate scoring. The local two-WebSocket integration script (`scripts/test-match.mjs`) covers room broadcasts, everyone-ready progression, reconnects, ten rounds and rematch resets. Run it against a local development server using `MATCH_TEST_ORIGIN=http://127.0.0.1:3017 node scripts/test-match.mjs`. Noot tests cover grounded running and finite rig transforms.

This is friendly competition, not a hardened anti-cheat system: audio must reach the browser, so a determined person can inspect or replay it outside the intended clip controls. No ranked security claims are made. Test completion, voluntary rematches, perceived fairness and enjoyment with real players before making retention claims.

Earlier verification: unit tests and the production build passed. Browser review covered the lobby, independent skips, deadline reveal, result playback and a 390px layout without horizontal overflow. The extended live run reached song nine but repeated development catalog timeouts prevented a clean full-match finish; final-round and rematch integration verification remains incomplete. Catalog lookups now time out before the room lock expires, preserving scores and allowing a retry.

## Player identity and Noot

First-time players can choose a name and outfit in the same settings sheet used by the game. The editor remains available through solo Settings and the table’s Your Noot button. Appearance saves in local storage; names and allowed outfit values synchronize to the table. These are device-local profiles, not cloud accounts.

Noot supports four headgear choices, a scarf or bow tie, round frames or sunglasses, and three fabric colors. Wearables follow the existing head anchor and use bounded fabric motion. Anatomy is unchanged. Select another player’s name to view their Noot and tap to exchange a wave. The server limits greetings to one per three seconds. This is a scripted social reaction with spring motion, not a general collision or cloth simulation.

Current checks: 53 unit tests pass, including appearance validation, wearable/anatomy stability, auto difficulty, readiness and score carry-over. Live WebSocket checks pass for appearance/name sharing, greeting cooldowns, independent skips and everyone-ready progression. Full long-session/load testing and catalog reliability remain release validation work.
