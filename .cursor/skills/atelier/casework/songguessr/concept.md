# Concept: SongGuessr, the round

Owner: direction desk. Consumed by: layout, typography, colour, motion, interaction, illustration, words, qa.

## Divergence: four structures
1. Keep: bar, level switch, character bubble, headline, transport capsule, guess field, in one 460 px column. Serves: nothing new; it is the structure two clients' rounds of feedback rejected. Costs: 68 percent of a desktop viewport unused; the clip is a 6 px bar.
2. The console (content unit changes: the round is a timeline, not a form). One time ruler the width of the room with stops at each stage; the unlocked span fills, the playhead runs along it, every miss and skip is marked where it happened, the character stands at the stop you have reached, and the transport and guess field sit directly under the ruler in one row. Serves: the primary task and secondary task 2 in one glance; uses the width. Costs: the character shrinks from 252 to 120 px; the headline goes.
3. Two rooms (desktop use changes: the session is the content unit). Left, the listening room with the character and a large play control; right, the session ledger: every round this sitting with its cover, time and result, the streak as a column. Serves: the return ritual and secondary task 4. Costs: on a phone the ledger falls below the fold; the round itself stays a form.
4. Shazam mode (the listening state is the whole screen). A single 200 px play control fills the stage while the clip plays, the field appears only after; tries are dots. Serves: the primary task with the least on screen. Costs: hides where you are in the round; skip and misses need a second layer; the character has no role.

Carried into direction: 2 and 3. Chosen: 2, the console, because the brief's primary task and its second secondary task ("see where I am in the round") are answered by one object, the ruler, and the brief's metric (stage width at or above 60 percent of 1440) is met by the ruler's nature rather than by padding. The ledger from option 3 survives as a quiet row under the console, reusing the ruler at small size as each round's signature, so the session is visible without a second room.

## The one idea
The clip is the instrument: one time ruler the width of the room; every event of a round is a mark on it where it happened, and the character stands where you have reached.

## Direction (chosen after the structure)
Candidates from `departments/direction/references/directions.md`:
1. Warm analogue: studio-gear logic (a ruler with physical stops, tabular numerals, one accent as the lit indicator), warm neutrals, a serif for the said. Fits precise, warm, alive; the ruler is literally an instrument.
2. Character-led: the character carries the hierarchy and the motion. Fits alive and warm, but the client's history shows the character-first layout is what made the game read as a Songless copy with a mascot.

Recommended: Warm analogue with the character as the one figure (the direction's own escape hatch). If the client rejects it, present Character-led with the ruler kept as the stage; do not decorate the rejected one.

## References as mechanisms
| Reference | Borrowed mechanism (not the look) | Where it applies here |
|---|---|---|
| Ableton Live's arrangement ruler | Time along the whole width, markers with labels under the line, a playhead as a 1 px line, locators as small flags | The ruler, stops, playhead and marks |
| Teenage Engineering OP-1 | One lit indicator colour on a neutral body; every readout is a number in one tabular face | The accent used only on the unlocked span, the mark of the win, the play control and the active level |
| otherkind.design | A single running-text size for everything that is not the set piece; the set piece is the one thing that moves | 14 px Open Runde for every label; the ruler and the character are the only motion |

## Kill list
1. The character bubble (the 560 x 320 stadium) and the character as the largest object on screen.
2. The headline and subline on every round ("Hear the clip. Name the track." on a returning visit).
3. The transport as a capsule containing a small progress bar; progress is the stage now.
4. Vertical stacking of level switch, hero, transport and field as four regions; the level switch moves into the bar, the transport and field share one row under the ruler.
5. Misses as a list of grey pills below the form; misses are marks on the ruler with their text under it.
6. The confetti and the success rings on a win; the win is the mark and the number.

## The one new mechanism
The annotated ruler (interaction desk section 3.5, closest row "I lose my place": the state is drawn where it happened). Trigger: every round event. States: stop (enabled stage), unlocked span (accent fill), playhead (while playing), miss mark (x at the stage where the guess was made, with the guessed title listed under the ruler at that x), skip mark (hollow dot), win mark (filled dot, the album cover rises above it), lost (all marks stay, the answer at the last stop). The character stands above the current stop and moves to the next one when it unlocks (`--dur-3`, `--ease-land`); reduced motion moves it without transition. Keyboard: the ruler is a readout (`role="img"` with a live text alternative: "Try 2 of 5, 0.5 seconds unlocked, one miss at 0.1 s"); all actions stay in the transport row. Persists: the round state already held in `RoundState` plus a `marks` list; the session ledger holds the last eight rounds in memory.

## Decisions nobody else made
1. The character has a position that means something: it stands at the stop you have reached, so its movement along the ruler is the game state, not an idle animation.
2. The win headline is a time, set in the serif at display size ("0.5 s"), and the track title is second; every other game leads with the title.
3. Each finished round leaves a signature: the same ruler at 96 px wide with its marks, in the session row, so a sitting reads as a set of small instruments rather than a list of titles.

## What must stay
The rig and its poses; the five level hues and the OKLCH palette formula; the streak flame; filters, reroll, theme, settings, Spotify; the stage seconds and rules.
