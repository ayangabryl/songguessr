# Case: SongGuessr, the round as an instrument

Job: rethink of a live product's main screen, in the product's own codebase (`src/`). Client: the repository owner, after rejecting two "improved" versions as reskins. Model: the same agent that maintains the skill, with a second agent for the blind reskin test. Build: `src/components/Ruler.tsx`, `src/console.css`, the shell markup in `src/components/Game.tsx`.

## Intake in one line
A Heardle-shaped game (clip grows with every miss, name the track) whose users say it looks like every other one; the client wants the structure to change, the character to keep its rig, and nothing to glow.

## What each desk decided
- Strategy: primary task "play the clip and name the track"; return ritual is the streak and a faster time; competitor map showed every rival is game-forward with the clip as a small bar, and the empty quadrant is the one where the clip itself is the object. Metric written as numbers: stage width at or above 60 percent of 1440 (baseline 32), play control and field in one region above the fold, numeral at or above 40 px at 1440 and 32 px at 390.
- Direction: four structures (keep; the console; two rooms; Shazam mode), two carried, one chosen: the console, because the primary task and "where am I in the round" are answered by one object. One idea: the clip is the instrument. One new mechanism: the annotated ruler. Kill list of six, including the character bubble, the headline and the confetti. Direction chosen after the structure: warm analogue with one figure.
- Layout: the ruler spans the room (1344 of 1440 px); the bar holds wordmark, level switch and actions in one row; transport and field share the row under the ruler; the session row reuses the ruler at 96 px as each round's signature. Mobile: the switch drops to a second bar row at 44 px, the skip becomes an icon, notes flow as a list.
- Typography: Instrument Serif for the numeral (72 / 36 px) and the track title; Open Runde 13 to 16 px for everything operated; tabular numerals on the stops.
- Colour: the existing OKLCH formula, untouched; the accent appears only on the unlocked span, the win mark, the play control and the active level; the playhead is ink so it reads over the accent.
- Motion: the ruler and the character are the only things that move; every UI transition on a token; the character steps to the next stop with `--ease-land`.
- Illustration: the rig unchanged at 144 px; its position now carries state.
- Words: "Try 2 of 5" as the readout, "Named at 0.1 s" leads the win, "Not this time" the loss, one first-run sentence beside the play control and none after.
- Engineering: two new files, one new spacing token, one new display size; 360 lines of dead vitrine CSS removed; game logic untouched except a `marks` list and a session ledger.

## What QA found
Nine findings, two S1: the playhead was invisible (accent on accent, found only when the demo was recorded) and the character stood below the line whenever miss notes were present (positioned against the notes' box). Both fixed. The blind stranger called the structures different and the first console "a good idea left half-empty"; loop 2 centred the instrument, reserved the session slot so nothing shifts, and enlarged the figure and numeral. All measured checks pass at both viewports; weighted score 9.0.

## Before and after
Before: `/opt/cursor/artifacts/vitrine_light_easy_desktop.png`. After: `/opt/cursor/artifacts/console/qa_idle_light_1440.png`, `/opt/cursor/artifacts/console/flow_won_light_1440.png`, `/opt/cursor/artifacts/console/flowm2_won_light_390.png`. Recording: `/opt/cursor/artifacts/songguessr_console_round_flow.mp4`.

## What the skill learned
1. A maker cannot see a playhead that is the same colour as the span it crosses; the motion audit counts animations but does not look at them. Record the demo before the QA report, not after.
2. Anything that stands on a ruler must be a child of the ruler; positioning against a wrapper that grows breaks the moment content appears.
3. The blind stranger's fifth answer (which one looks studio-made) is worth more than the first four; ask it every time, and act on it before shipping.
