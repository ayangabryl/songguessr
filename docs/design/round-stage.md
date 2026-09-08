# Design record — round stage, 7 September 2026

## Brief
- User, context and primary task: Play a SongGuessr round, hear the clip, name the song, then hear the answer. Same job solo or at a table.
- Problem: Table results asked for a second play press; some catalog URLs (often Filipino previews) 404/403 at play time; two Noots stretched across leftover width; UI pips were quiet.
- Desired outcome: Reveal autoplays after a result. Unplayable URLs are skipped before a round starts. Pets share a floor and wrap for 12 seats. Clicks are audible.
- Scope: Solo console, table stage, catalog pick, UI pips. Scoring and Noot anatomy stay.
- Constraints: Existing tokens, ruler, and room service.

## Alternatives and decision
| Approach | Benefit | Tradeoff |
|---|---|---|
| Stretch two pets to fill the monitor | Uses width | Reads as misalignment; breaks at 12 |
| Keep pets grouped, grow the stage with viewport height | Related seats stay a group; leftover height is for the round | Sides stay quieter on ultrawide |
| Server HEAD plus browser decode probe | Dead Deezer/empty/404 URLs never become the round | Adds a short pick delay |

Chosen: grouped seats on one floor, viewport-tall stage, probe-then-pick. Interface-craft §1: remaining space is for the primary work, not stretching sparse controls to opposite edges.

## Design contract
| Decision | Reason | Where |
|---|---|---|
| Reveal autoplays; album remains pause | Solo already did this | MatchArena reveal, Game playReveal |
| Probe audio before pick | Filipino previews often 403 | worker/playable-audio, fetchPlayableRound |
| Pets `flex: 0 0 auto`, wrap at 9–12 | Shared baseline, 12 above the fold at 1440 | round-experience.css |
| Table holds 12 | Requested 10–12 | MAX_SITTING_PLAYERS |
| Louder UI pips | WebKit tones were below the mix | ui-audio.ts |
| Song title is the round-end hero, not `15s` | First-time players missed that the round ended | MatchArena kicker + SongIdentity |
| Play/guess/skip and Ready sit in a sticky dock | Controls were below the fold at ~777px | `.match-dock` |
| Apostrophes fold in search | `cant` must find `Can't` | `foldSearchText`, catalog search |

## Evidence
Inspected after implementation. Visual craft and functional UX recorded in the handoff, not here.
