# QA report: SongGuessr console

Build: branch `cursor/songguessr-rethink-d9ed`, dev server on port 5173, scripts from `.cursor/skills/atelier/scripts/`. Scope: rethink.

## Capture matrix
| Viewport | Theme | State | File |
|---|---|---|---|
| 1440x900 | light | idle, first stop | `/opt/cursor/artifacts/console/qa_idle_light_1440.png` |
| 1440x900 | dark | idle | `/opt/cursor/artifacts/console/qa_idle_dark_1440.png` |
| 1440x900 | dark | Impossible level (hue 300) | `/opt/cursor/artifacts/console/qa_impossible_dark_1440.png` |
| 1440x900 | dark | playing at the 2 s stop, needle mid-span | `/opt/cursor/artifacts/console/final_playing_dark_1440.png` |
| 1440x900 | light | try 4 of 5, two misses and a skip marked | `/opt/cursor/artifacts/console/flow_miss3_light_1440.png` |
| 1440x900 | light | lost, cover at the last stop | `/opt/cursor/artifacts/console/flow2_lost_light_1440.png` |
| 1440x900 | light | won at 0.1 s, cover at the first stop, sitting row | `/opt/cursor/artifacts/console/flow_won_light_1440.png` |
| 390x844 | light | idle | `/opt/cursor/artifacts/console/qa_idle_light_390.png` |
| 390x844 | dark | Hard level (hue 50) | `/opt/cursor/artifacts/console/qa_hard_dark_390.png` |
| 390x844 | light | try 4 of 5 with notes | `/opt/cursor/artifacts/console/flowm2_miss3_light_390.png` |
| 390x844 | light | won, sitting row with two signatures | `/opt/cursor/artifacts/console/flowm2_won_light_390.png` |
| 390x844 | dark | lost | `/opt/cursor/artifacts/console/flowm_lost_dark_390.png` |

## Measured (`measure.mjs`)
| Check | 1440x900 | 390x844 | Floor |
|---|---|---|---|
| Lowest text contrast | 5.05:1 (stop label "0.5") | 5.05:1 | 4.5:1 |
| Contrast failures | 0 | 0 | 0 |
| Off-scale spacing, radius or type values | 0 | 0 | 0 |
| Targets under floor | 0 of 12 (32 px) | 0 of 11 (44 px) | 0 |
| Smallest text | 13 px | 13 px | 12 px |
| Unlabelled icon buttons | 0 | 0 | 0 |
| Uppercase labels | 0 | 0 | 1 at most |
| Horizontal overflow | 0 px | 0 px | 0 |
| Non-concentric nested corners | 0 | 0 | 0 |

## Motion (`motion-audit.mjs`, 1440x900)
10 animations observed: 2 UI (`numeralIn`, `riseIn`), both on tokens `--dur-3` and `--ease-out`; 8 character (breathe, look, blink, sway), exempt. Off-token durations 0, off-token easings 0, ease-in on UI 0, infinite loops outside the character 0, UI animation at idle 0, long frames 0.

## Brief pass (brief.md metric)
| Metric | Baseline (vitrine) | Console | Target |
|---|---|---|---|
| Stage region width at 1440 | 460 px (32 percent) | 1344 px (93 percent) | at least 60 percent |
| Play control and field above the fold, 1440x900 | yes | yes, both bottoms at 562 px | yes |
| Play control and field above the fold, 390x844 | yes | yes, both bottoms at 430 px | yes |
| Clip-length numeral at 1440 | 24 px | 72 px | at least 40 px |
| Clip-length numeral at 390 | 20 px | 36 px | at least 32 px |
| Play and field in one region | no (two capsules) | yes (one row) | yes |

## Reskin check (blind, scored by a second agent)
Before and after at the same 1440x900 viewport, unlabelled, no concept text: `/opt/cursor/artifacts/vitrine_light_easy_desktop.png` and `/opt/cursor/artifacts/console/final_light_1440.png`. Blind lines, verbatim:
- Before: "Centered card: pill tabs, big green blob with mascot, headline, player bar, search input below."
- After: "Full-width horizontal timeline: mascot sits on a progress track with tick marks, input row underneath."
- Same product: "Different structure. Image 1 stacks a hero blob and stats vertically in a narrow column; image 2 spreads a timeline horizontally across the whole viewport."
- Most important structural difference: "The playback/attempt visualisation moves from a small progress bar inside a card to a full-width annotated timeline that becomes the page's main axis."
- Studio judgement, blunt: "Image 1 looks studio-made ... image 2 is a good idea left half-empty, with the bottom two-thirds of the screen dead and the mascot floating awkwardly on a line."

Maker checks: structure differs (yes: one ruler row replaces four stacked regions); one idea legible at 25 percent (yes, the timeline is the page's axis); new mechanism present and serves the primary task (yes: marks, needle, figure position); built structure is divergence option 2 (yes); viewport use at 1440: 1344 / 1440 = 93 percent.

Acted on the blind judgement (loop 2): the console is centred in the room with a fixed-height session slot beneath so nothing shifts between rounds; the figure grew from 120 to 144 px and the numeral from 56 to 72 px so the instrument has presence at 25 percent; the playhead became an ink needle after the demo run showed it was invisible against the accent span.

## Findings, ranked
| # | Severity | Finding | Fixed |
|---|---|---|---|
| 1 | S1 | Playhead invisible while a clip played: an accent line on the accent span (found in the recorded demo) | yes, ink needle 20 px tall |
| 2 | S1 | Figure stood 24 px below the line when miss notes were present (positioned against the notes, not the ruler) | yes, figure and cover are children of the ruler |
| 3 | S2 | Answer cover at the 15 s stop overflowed the ruler end | yes, clamped with a lean into the margins |
| 4 | S2 | Level switch labels truncated in the bar ("Medi..."), and stacked to a third row on mobile | yes |
| 5 | S2 | Skip icon hidden and legacy 123 px min-width under 400 px (inherited songless.css rules) | yes |
| 6 | S2 | Composition shifted up when the session row appeared | yes, fixed-height slot |
| 7 | S3 | Level switch segments 36 px on mobile | yes, 44 px |
| 8 | S3 | Tick geometry off the 4 px scale (negative margins, 1 px radius) | yes, transforms |
| 9 | S3 | 9vh stage offset off scale | yes, `--space-16` |

Open: none blocking. Suggested for a later pass: a per-hue check of the ink needle over the Medium (yellow) span in light mode; the signature ruler at 96 px hides the 0.1 to 0.5 gap on a phone, consider 120 px there.

## Character pass
Poses observed: idle breathe, listen with notes on play, hop to the next stop on unlock, celebrate with sparkles on win, slump on loss, gaze follows the pointer on hover. Blink is WAAPI with variable duration (245 to 337 ms observed). No clipping at the shoulders or feet at 144 px; the contact shadow sits at the line.

## Scoring
| Category | Weight | Score /10 | Note |
|---|---|---|---|
| A Brief fit | 2 | 9 | primary task in one row under the instrument |
| B One idea | 2 | 9 | legible blind at 25 percent |
| C Type | 1 | 8 | two voices, tabular numerals, 13 px floor |
| D Layout stability | 1 | 8 | fixed slot; result row is taller than the transport row by 24 px on mobile |
| E Colour | 1 | 9 | formula unchanged, all measured |
| F Motion | 1 | 9 | two UI animations, both on token |
| G Interaction | 1 | 8 | ruler is a readout with a live sentence; no keyboard path to the sitting row (none needed) |
| H Words | 1 | 8 | "Named at 0.1 s"; loss line "Not this time" |
| I Slop | 1 | 10 | no glow, no gradient, no uppercase, no dots |
| J Brief conformance | 1.5 | 10 | all six metrics met |
| K Reskin test | 1.5 | 9 | blind: different structure; maker checks pass |
Weighted: 9.0. Decision: ship; two S3 suggestions carried to the next pass.
