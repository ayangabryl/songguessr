# Design QA: Hacker News front page (rethink) - loop 2 (final)

Owner: qa desk. Consumed by: direction (audit and decision).

## Capture matrix
Run: `node scripts/capture.mjs http://127.0.0.1:8788/ /opt/cursor/artifacts/casework states.json --name=hn-rethink --theme-key=hn-theme --viewports=1440x900,390x844m`. Viewports 1440x900 (desktop) and 390x844 (mobile, touch-emulated); themes light and dark; states idle (deterministic seeded snapshot, ~11 rising of 30), returning-with-new-items (dramatic return: a third of the list reads as new, the rest reads as gaining), keyboard-focus (first title link `:focus-visible`).

| Viewport | Theme | State | File | Overflow px |
|---|---|---|---|---|
| 1440x900 | light | idle | /opt/cursor/artifacts/casework/hn-rethink-idle-light-1440.png | 0 |
| 1440x900 | light | returning-with-new-items | /opt/cursor/artifacts/casework/hn-rethink-returning-with-new-items-light-1440.png | 0 |
| 1440x900 | light | keyboard-focus | /opt/cursor/artifacts/casework/hn-rethink-keyboard-focus-light-1440.png | 0 |
| 1440x900 | dark | idle | /opt/cursor/artifacts/casework/hn-rethink-idle-dark-1440.png | 0 |
| 1440x900 | dark | returning-with-new-items | /opt/cursor/artifacts/casework/hn-rethink-returning-with-new-items-dark-1440.png | 0 |
| 1440x900 | dark | keyboard-focus | /opt/cursor/artifacts/casework/hn-rethink-keyboard-focus-dark-1440.png | 0 |
| 390x844 (touch) | light | idle | /opt/cursor/artifacts/casework/hn-rethink-idle-light-390.png | 0 |
| 390x844 (touch) | light | returning-with-new-items | /opt/cursor/artifacts/casework/hn-rethink-returning-with-new-items-light-390.png | 0 |
| 390x844 (touch) | light | keyboard-focus | /opt/cursor/artifacts/casework/hn-rethink-keyboard-focus-light-390.png | 0 |
| 390x844 (touch) | dark | idle | /opt/cursor/artifacts/casework/hn-rethink-idle-dark-390.png | 0 |
| 390x844 (touch) | dark | returning-with-new-items | /opt/cursor/artifacts/casework/hn-rethink-returning-with-new-items-dark-390.png | 0 |
| 390x844 (touch) | dark | keyboard-focus | /opt/cursor/artifacts/casework/hn-rethink-keyboard-focus-dark-390.png | 0 |

## Brief pass
Success metric (`brief.md`): at least 24 stories fully above the fold at 1440x900 and 12 at 390x844 (baseline: current live HN build, 24 and 12 exactly), AND on a returning visit the since-last-visit divider and at least one non-zero velocity delta are present and reachable.

Measured on this build (`scripts/measure.mjs --count=.story-row`): **24** rows above the fold at 1440x900 (meets the 24 floor exactly), **14** rows above the fold at 390x844m (clears the 12 floor by 2). The tide-mark divider and velocity deltas are present in the idle capture (11 of 30 rising, deltas like `+103`, `+12` beside points and comments, four `new` labels) and in the dramatic-return capture (a third of the list reads `new`, the rest carries deltas) — see `hn-rethink-idle-light-1440.png` and `hn-rethink-returning-with-new-items-light-1440.png`.

Kill list (`concept.md`), each checked against the captures:
1. Flat undifferentiated list regardless of history — absent; every returning capture shows the two-band structure.
2. Rank driven only by cumulative points — absent; `isRising()` in `app.js` sorts into bands by velocity, not points, before either band's internal point order.
3. Meta line with points/comments/age all equal weight — absent; points and comments carry `.num` tabular styling and a delta, age does not, at the same `--fs-0` but different roles are visually distinguishable by the delta's presence.
4. No dark theme — absent; dark theme captured and toggled via header control, persisted to `localStorage['hn-theme']`.
5. Interactive controls under 44 px touch floor — absent; see Measurements below, 0 targets under 44 px at 390px, all controls including the skip link now clear the floor.

Every state in the brief is designed and captured or exercised: first run (`window.__hnDemo.simulateFirstRun()`, renders divergence option 1's flat list, verified manually via CDP — not in the capture matrix, which focuses on the returning-reader states the mechanism exists to show), returning (idle and returning-with-new-items states), loading (300 ms skeleton in `app.js`, code-reviewed), error/retry (fetch-failure branch in `boot()`, code-reviewed).

**Reskin check (K)**: before and after at 1440, same viewport, `hn-before-1440.png` beside `hn-rethink-idle-light-1440.png`.
- Stranger's line, before: "An orange-topped list of thirty plain text links, numbered 1 to 30, each with a vote count and comment count, no visual grouping at all."
- Stranger's line, after: "A numbered list split partway down by a thin orange rule and a caption saying what's new; everything above the rule is bold and marked 'new' or has a small '+' number next to its count, everything below is fainter."
The two lines describe different things: the "before" line has no structural feature to point at beyond "a list"; the "after" line names a partition, a caption, a weight change and a delta convention that do not exist in the before image. Structure differs (two bands plus a mark vs one undivided list), not only the skin. The one idea ("a tide line... above the mark at full weight; everything already seen settles below it") is legible at 25 percent zoom: the rule and the weight step between the two zones remain visible even scaled down, because the weight difference is a font-weight step, not a colour or size difference that disappears when downscaled. The one new mechanism (velocity signal) is in the render (deltas and "new" labels beside points/comments) and reachable (it is plain text inside the existing row link, no separate control). The built structure is divergence option 2 (Alive rail), the chosen option.

## Measurements
Run: `node scripts/measure.mjs http://127.0.0.1:8788/ --viewport=<vp> --count=.story-row --count-min=<24|12> --theme-key=hn-theme [--theme=dark]` and `python3 scripts/contrast.py`.

| Check | Result | Floor | Pass |
|---|---|---|---|
| Text contrast, lowest pair | 5.06:1 (span.domain "fraser.name" on --bg, light); 6.61:1 (same, dark) | 4.5:1 body, 3:1 large and UI | pass |
| Off-scale spacing values | 0 (fixed: footer `<p>` and error `<p>` had UA default 1em margins, not a token; both now `margin: 0` / `margin: 0 0 var(--space-3)`) | 0 unjustified | pass |
| Smallest touch target (mobile, 390px, pointer:coarse) | all controls >= 44x44 (fixed: skip-link was 132x37, now uses `min-height: var(--target)`); 60 inline title/comments links exempt under WCAG 2.2 2.5.8 (inline text links) | 44x44 | pass |
| Smallest touch target (desktop, 1440px, pointer:fine, no touch emulation) | all controls >= 32x32 (`--target` default) | 32x32 | pass |
| Smallest text | 13 px (`.age`, `.delta`, footer) | 12 px meta, 14 px UI, 16 px body | pass |
| Horizontal overflow | 0 px at both viewports, both themes | 0 | pass |
| Above the fold: `.story-row`, 1440x900 | 24 (light and dark) | 24 at least | pass |
| Above the fold: `.story-row`, 390x844m | 14 (light and dark) | 12 at least | pass |
| Layout shift between states | not applicable as a page transition — idle/returning/keyboard-focus are separate loads in this build (no live in-page re-render triggered by user action other than the theme toggle, which does not move row rects); theme toggle rect diff: 0 px on `.story-row`, `.tide-mark`, `.site-header` | 0 above the fold | pass |
| Running animations vs spec (idle, 4 s sample) | 0 running at idle; 5 observed on the theme-toggle trigger, all 5 match the motion-spec table (body/header colour-token transition at `--dur-3`/`--ease-in-out`, button feedback at `--dur-1`/`--ease-out`) | 0 unspecified | pass |
| Off-token durations / easings | 0 / 0 | 0 | pass |
| Long frames during spec'd sequences | 0 frames >= 50 ms | 0 | pass |
| Reduced motion re-run | 0 animations observed (durations collapse to 0 ms via `prefers-reduced-motion`) | 0 non-character transform | pass |

### Note on the motion-audit "ease-in on UI" line
`scripts/motion-audit.mjs` flags 4 rows (the theme-switch transition on `body` and `header.site-header`) as `ease-in on UI: 4 FAIL`. This is the script's regex heuristic (`cubic-bezier(0.[4-9]`) matching the first control point of `--ease-in-out` (`cubic-bezier(0.65, 0, 0.35, 1)`), not a raw or off-token curve — the same row's `easeToken` column correctly resolves to `--ease-in-out`. `departments/motion/PLAYBOOK.md` 4.4 row "Theme switch" and rule 4 both explicitly prescribe `--ease-in-out` for exactly this transition ("reserved for morphs and moves that begin and end on screen and for theme switches"), and 4.5's audit-passing criterion is "no unmatched rows," which this is not — every row resolves to a spec'd token. Treated as a script false positive, not a defect, and not scored against category E; flagged in the "anything unclear" section of the final report so the script's heuristic can be tightened to exempt tokenised `--ease-in-out` rows.

## Findings (ranked by severity)
No open findings. Loop 1 findings (below) were fixed and re-measured clean in loop 2.

| # | Severity | Finding | Evidence | Rule | Fix |
|---|---|---|---|---|---|
| 1 (loop 1, fixed) | S3 | Two off-scale margins on `p` elements | `measure.mjs`: `p marginTop 13px`, `p marginBottom 13px` at 1440x900 | `layout/PLAYBOOK.md`, tokens-only rule | Footer and error-state `<p>` had no explicit margin, inheriting the UA 1em default; set to `margin: 0` (footer) and `margin: 0 0 var(--space-3)` (error) |
| 2 (loop 1, fixed) | S2 | 62 off-scale padding values on `li.story-row` at 390px | `measure.mjs`: `paddingTop 2px`, `paddingBottom 2px` x 31 rows | `layout/PLAYBOOK.md`, tokens-only rule | Removed the mobile-only `padding-block: 2px` override in the `max-width: 30rem` media query; base rule already had no vertical padding, so this literal was redundant and off-scale |
| 3 (loop 1, fixed) | S1 | Skip link under the 44 px mobile touch floor | `measure.mjs`: `a.skip-link` 132x37 at 390x844m | `interaction/PLAYBOOK.md`, target size | Added `min-height: var(--target)` and switched to `inline-flex` with `align-items: center` so the token drives height instead of line-box height plus padding |

## Passed measurements
- 24 stories above the fold at 1440x900, both themes (floor 24, brief metric J).
- 14 stories above the fold at 390x844m, both themes (floor 12, brief metric J) — 2 more than the floor, and 1 more than loop 1's 13 after the padding fix.
- 0 contrast failures against AA at either theme; lowest pair 5.06:1 (light) / 6.61:1 (dark), both above the 4.5:1 body floor.
- 0 off-scale spacing values (was 2 + 62 in loop 1).
- 0 targets under the applicable floor (was 1 in loop 1).
- 0 horizontal overflow at either viewport, either theme.
- 0 off-token durations or easings; 0 infinite loops; 0 long frames; 0 idle animation.
- 0 animations under `prefers-reduced-motion: reduce`.
- Kill list: 0 of 5 present.
- Reskin check: structure differs, one idea legible at zoom, mechanism present and reachable — K conditions all met.

## Score
Start at 10; minus 2 per failed binary check, minus 1 per additional instance; floor 0. Weights from `departments/qa/PLAYBOOK.md` section 5.

| Category | Weight | Score /10 | Failed checks |
|---|---|---|---|
| J Brief conformance (must be 10) | 2.0 | 10 | none: 24/12 density met, kill list clear, all designed states present |
| K Reskin test (rethink; at or above 7) | 1.5 | 10 | none: structure differs, idea legible at zoom, mechanism reachable, built structure matches the chosen divergence option |
| A Contrast and colour | 1.5 | 10 | none: 0 contrast failures either theme |
| B Tokens and type | 1.0 | 10 | none: 0 off-scale values after loop 2 fix; type scale within the 6-size escape hatch |
| C Alignment | 1.0 | 10 | none: 0 horizontal overflow; row grid identical across bands (decisions nobody else made #2) |
| D Stability | 1.5 | 10 | none: 0 px rect delta on theme toggle; no in-page transition moves an anchor |
| E Motion | 1.0 | 10 | none binding: 0 off-token, 0 idle animation, 0 long frames, reduced motion honoured; the audit script's "ease-in on UI" line is a heuristic false positive on a correctly tokenised, playbook-prescribed `--ease-in-out` theme switch (see note above), not scored as a failure |
| F Character (n/a) | 1.0 | n/a | no character on this screen |
| G Copy | 0.5 | 10 | none: sentence case, no title case headers, one voice ("Since your last visit...") |
| H Accessibility | 1.5 | 10 | none: 0 targets under floor after fix; skip link present and functional; focus-visible ring on every interactive element; forced-colors and prefers-contrast rules present |
| I Performance | 1.0 | 9 | 1: no lazy-loading or explicit `fetch` priority hint on `items.json` (30-item local JSON, sub-frame parse cost in practice, but not spec'd) |
| Weighted average | | **9.54** | Ship at or above 8.0, no category under 7, zero S1, J 10, K at or above 7 where it applies |

F is n/a (no character on this screen) and excluded from both the weighted sum and the weight total: (10x2.0 + 10x1.5 + 10x1.5 + 10x1.0 + 10x1.0 + 10x1.5 + 10x1.0 + 10x0.5 + 10x1.5 + 9x1.0) / (2.0+1.5+1.5+1.0+1.0+1.5+1.0+0.5+1.5+1.0) = 124 / 13 = 9.54.

Decision: **ship**. J is 10, K is 10, weighted average 9.54, no category under 7, zero open S1 (the skip-link S1 from loop 1 is fixed and re-measured).
