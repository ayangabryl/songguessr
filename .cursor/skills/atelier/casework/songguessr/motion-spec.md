# Motion spec: SongGuessr console

Owner: motion desk. Model: one physical system; the ruler and the character are the only things that move. Tokens from `src/game-shell.css`: `--dur-1` 160, `--dur-2` 260, `--dur-3` 420, `--dur-4` 600 ms; `--ease-out` (0.22, 1, 0.36, 1), `--ease-land` (0.34, 1.3, 0.64, 1), `--ease-in-out` (0.65, 0, 0.35, 1). The character rig keeps its own timings (`noot.css`, WAAPI blink) and is exempt from the UI token rule.

| Event | What moves | Duration | Easing | Why this and not more |
|---|---|---|---|---|
| Stage unlocks (miss or skip) | `.ruler-fill` width to the next stop | `--dur-4` | `--ease-out` | A reveal of new territory; the longest UI duration, decelerating so the eye can follow the end point |
| Stage unlocks | `.figure` left to the next stop | `--dur-3` | `--ease-land` | The character steps to where the player has reached; a small overshoot reads as a landing, not a slide |
| Stage unlocks | Current stop tick grows 12 to 16 px, label to ink | `--dur-2` | `--ease-out` | Secondary cue, shorter than the primary |
| Miss or skip | `.ruler-mark` scale 0.4 to 1, opacity 0 to 1 | `--dur-2` | `--ease-land` | A mark is placed, so it lands; within Doherty's 200 ms budget for the first frame |
| Miss | `.ruler-notes li` rise 6 px and fade in | `--dur-2` | `--ease-out` | Reads after the mark |
| Clip plays | `.ruler-head` width, written per frame by the clip timer; opacity 0 to 1 | frame; `--dur-2` | none; `--ease-out` | The needle is real time; only its appearance is eased |
| New numeral | `.numeral` rise 6 px and fade in | `--dur-3` | `--ease-out` | One value replaces another; the same curve as the fill so they read as one event |
| Win or loss | `.answer-cover` rise 12 px and fade in at the stop | `--dur-3` | `--ease-land` | The answer is placed on the instrument, so it lands |
| Win or loss | `.figure` steps aside by one cover width | `--dur-3` | `--ease-land` | Same move as an unlock; the character gives the stop to the answer |
| Level switch | Hue custom property swap; the indicator pill slides | `--dur-3` | `--ease-out` / `--ease-land` | Inherited from the base layer; colour change is a crossfade, never a flash |
| Theme switch | Canvas and text colour | `--dur-3` | `--ease-in-out` | Symmetric because there is no direction to a theme change |
| New round, new sitting row | `riseIn` 8 px and fade | `--dur-3` | `--ease-out` | Content entering |

Reduced motion: `.figure`, `.ruler-fill` and the ticks have no transition; marks, cover, numeral, notes and rows appear without animation; the character keeps blink and gaze only (`noot.css`).

Not animated, on purpose: hover on the ruler (it is a readout), the readout text, the session row rulers, the bar.
