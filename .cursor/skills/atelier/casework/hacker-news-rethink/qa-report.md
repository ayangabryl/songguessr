# Design QA: Hacker News front page (rethink) - loop 3 (final, ships)

Owner: qa desk. Consumed by: direction (audit and decision). Loops 1 and 2 below are kept as the audit trail; loop 3 is the current, shipping state — see the "Loop 3" section for the direction desk's independent audit, the fixes it required, and the final score.

## Capture matrix (loop 2; superseded captures, kept for the audit trail)
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

## Brief pass (loop 2)
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

## Measurements (loop 2)
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

## Findings (ranked by severity, loop 1 and loop 2 history)
Loop 1 findings (below) were fixed and re-measured clean in loop 2. Loop 2 then read as ship-ready by this desk's own protocol, but an independent direction-desk audit of the loop 2 build found five further findings the QA checklist does not test for directly (missing IA, a copy/legibility/rhythm/prominence set of judgment calls); see "Loop 3" below.

| # | Severity | Finding | Evidence | Rule | Fix |
|---|---|---|---|---|---|
| 1 (loop 1, fixed) | S3 | Two off-scale margins on `p` elements | `measure.mjs`: `p marginTop 13px`, `p marginBottom 13px` at 1440x900 | `layout/PLAYBOOK.md`, tokens-only rule | Footer and error-state `<p>` had no explicit margin, inheriting the UA 1em default; set to `margin: 0` (footer) and `margin: 0 0 var(--space-3)` (error) |
| 2 (loop 1, fixed) | S2 | 62 off-scale padding values on `li.story-row` at 390px | `measure.mjs`: `paddingTop 2px`, `paddingBottom 2px` x 31 rows | `layout/PLAYBOOK.md`, tokens-only rule | Removed the mobile-only `padding-block: 2px` override in the `max-width: 30rem` media query; base rule already had no vertical padding, so this literal was redundant and off-scale |
| 3 (loop 1, fixed) | S1 | Skip link under the 44 px mobile touch floor | `measure.mjs`: `a.skip-link` 132x37 at 390x844m | `interaction/PLAYBOOK.md`, target size | Added `min-height: var(--target)` and switched to `inline-flex` with `align-items: center` so the token drives height instead of line-box height plus padding |

## Passed measurements (loop 2)
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

## Score (loop 2 — superseded; see Loop 3)
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

Decision at loop 2: **ship**, by this desk's own checklist. **Superseded**: the direction desk's independent audit of this exact build (below) found five findings this checklist does not directly test — a removed information architecture with no decision recorded for it, a wrapping-copy defect, a legibility-at-1x failure in the one thing the idea depends on, a control reading as the header's strongest element, and a rhythm/register pair of nits. None of these move a number in the table above, which is itself the finding: QA's own protocol is measurement-shaped and missed structure, hierarchy and voice questions that a build can pass every number on while still not being the rethink the brief asked for.

## Loop 3 (current, ships)
Trigger: a direction-desk audit of the loop 2 build (not run by this desk), independent re-measurement of `measure.mjs`/`motion-audit.mjs` confirming loop 2's own numbers, and five findings ordered S2 to S4. Fixed in the order given; re-measured after.

### Findings and fixes

| # | Severity | Finding | Fix |
|---|---|---|---|
| S2-1 | S2 | Information architecture removed with no decision recorded: HN's section nav (new, past, comments, ask, show, jobs, submit) and login were dropped; neither the kill list nor "what must stay" (`concept.md`, `brief.md`) named them, so their removal was scope creep, not a design decision | Restored as a real `<nav>` (`new`, `past`, `comments`, `ask`, `show`, `jobs`, `submit`, lower case, HN's own words) inline in the existing desktop header row, plus a `login` link beside the theme control; on mobile the nav moves to its own horizontally scrollable row under the wordmark row (`index.html`, `styles.css`) |
| S2-2 | S2 | Orphaned `new` label wrapping alone onto its own line on mobile (idle-light-390, row 6) | `domain` and `new-badge` now render inside one `.domain-group` (`display: inline-block; white-space: nowrap`) in `app.js`'s `rowMarkup`, so the pair wraps as one unit or not at all; checked on every row of both mobile idle and returning captures |
| S3-1 | S3 | The Rising/Steady weight step (500 vs 400) was illegible at 15px/1x — the idea the whole build depends on | Steady title links now also drop to `--text-2` (`.story-row[data-band="steady"] .title-link`), verified at or above 4.5:1 in both themes (7.15:1 light, 8.89:1 dark on `--bg`; 6.54:1 / 6.58:1 on `--surface-2` hover) with `contrast.py`; the two bands read as two bands at 25 percent zoom in the loop 3 captures |
| S3-2 | S3 | The mobile theme control was a bordered text pill, the header's visually strongest element ahead of the wordmark | Mobile-only: 44px square icon button, `--line` border (not `--outline`), sun/moon SVG icon swapped by `[data-theme]`, `aria-label` set dynamically in `app.js` (`Switch to dark/light theme`) since the text label is visually hidden at this width; desktop keeps the 32px text-label control unchanged |
| S3-3 | S3 | Meta line rhythm: the delta ran into the figure it modifies with a regular word space | `deltaMarkup()` in `app.js` now prepends a thin space (U+2009) instead of a regular space; `--text-3` (delta, domain, age) moved one step lighter (0.530 → 0.535 light, 0.680 → 0.660 dark), the most it can move before the `--surface-2` hover background would drop it under 4.5:1 (`tokens.css`, measured with `contrast.py`) |
| S4 | S4 | Footer copy ("data from a local snapshot, refreshed once per visit") was developer language | Shortened to "`30 stories`" — the count stays, the implementation detail is gone |

### Fix-driven regressions caught and re-fixed before re-measuring
- Restoring `<nav>` and `login` initially failed the target-size check: `login-link` sits in a `display: flex` `.header-actions`, which blockifies its used `display` and strips the WCAG 2.2 2.5.8 inline-text-link exemption (the same rule that governs `.title-link`, `layout/PLAYBOOK.md` 4.7). Fixed by giving it a real `min-height`/`min-width: var(--target)` hit area instead of relying on the exemption, the same treatment as the nav links beside it.
- The nav links then failed on width alone (`ask`, `jobs` at 43px, `login` at 39px against a 44px floor) — `min-height` without `min-width` only constrains one axis. Added `min-width: var(--target)` and `justify-content: center` to both `.site-nav a` and `.login-link`.

### Re-measured (loop 3, final)

| Check | 1440x900 light | 1440x900 dark | 390x844m light | 390x844m dark | Floor |
|---|---|---|---|---|---|
| Above the fold: `.story-row` | 24 | 24 | 13 | 13 | 24 @ 1440, 12 @ 390 |
| Contrast failures | 0 | 0 | 0 | 0 | 0 |
| Lowest contrast | 4.96:1 (`.domain`) | 6.13:1 (`.domain`) | 4.96:1 | 6.13:1 | 4.5:1 |
| Off-scale values | 0 | 0 | 0 | 0 | 0 |
| Targets under floor | 0 of 10 controls (60 inline links exempt) | 0 of 10 | 0 of 10 (44px floor) | 0 of 10 | 0 |
| Horizontal overflow | 0px | 0px | 0px | 0px | 0px |

Motion audit re-run clean: 0 off-token durations/easings, 0 idle animation, 0 long frames, 0 infinite loops, 0 animations under `prefers-reduced-motion: reduce`. **`ease-in on UI` now reads 0/pass** — the direction desk's fix to `scripts/motion-audit.mjs` (exempting tokenised `--ease-in-out` curves) resolved the false positive noted in loop 2; the theme-switch transition is unchanged code, only the script's judgment of it changed.

Mobile density note: 390x844m dropped from loop 2's 14 rows to 13 after adding the mobile nav row — still 1 row above the 12 floor, and the S2-1 finding explicitly priced this in ("you have 14 rows against a floor of 12, so one row of cost is affordable").

**Reskin check (K), re-confirmed on the loop 3 build**: structure still differs (nav restoration is IA, not a structural rollback to the flat list — the tide-line partition, the weight/tone step and the velocity deltas are all still present and are what a stranger's eye lands on first). Stranger's line, before: unchanged, "an orange-topped list of thirty plain text links, numbered, no visual grouping at all." Stranger's line, after (loop 3): "a numbered list under a small row of section links, split partway down by a thin orange rule and a caption saying what's new; everything above the rule is bold and clearly darker than everything below it." The added nav row does not change which lines a stranger uses to describe the two images — the tide line and the weight/tone step are still the first things named.

### Score (loop 3, final)

| Category | Weight | Score /10 | Notes |
|---|---|---|---|
| J Brief conformance (must be 10) | 2.0 | 10 | 24/13 density (both above floor), kill list clear, all designed states present |
| K Reskin test (rethink; at or above 7) | 1.5 | 10 | structure still differs after the IA restoration; idea and mechanism still legible and reachable |
| A Contrast and colour | 1.5 | 10 | 0 contrast failures either theme, including the new steady-tone title link and the retuned `--text-3` |
| B Tokens and type | 1.0 | 10 | 0 off-scale values; nav and login added within the existing token set, no new literals |
| C Alignment | 1.0 | 10 | 0 horizontal overflow at either viewport |
| D Stability | 1.5 | 10 | 0px rect delta on theme toggle; nav does not shift on interaction |
| E Motion | 1.0 | 10 | 0 off-token, 0 idle animation, 0 long frames; loop 2's "ease-in on UI" false positive is now fixed at the script and reads clean |
| F Character (n/a) | 1.0 | n/a | no character on this screen |
| G Copy | 0.5 | 10 | footer rewritten (S4); nav labels are HN's own words, lower case, per words desk |
| H Accessibility | 1.5 | 10 | 0 targets under floor after the nav/login fix; theme toggle has a correct dynamic `aria-label` on every viewport |
| I Performance | 1.0 | 9 | unchanged from loop 2: no lazy-loading or fetch priority hint on `items.json` |
| Weighted average | | **9.54** | (10×2.0 + 10×1.5 + 10×1.5 + 10×1.0 + 10×1.0 + 10×1.5 + 10×1.0 + 10×0.5 + 10×1.5 + 9×1.0) / 13.0 = 124/13 = 9.54 |

Decision: **ship**. J at 10, K at 10, weighted average 9.54, no category under 7, zero open S1.

**The number did not move, and that is itself a finding**: loop 2 scored 9.54 with five real defects still in the build (a removed IA, an illegible band step, an orphaned label, an over-prominent control, a rhythm nit) because every one of them sat in a category this checklist was already scoring 10 — J and K measure density and structural difference, not whether the header quietly deleted a whole layer of the site; A measures contrast pass/fail, not whether a passing pair is visually distinguishable enough to carry the idea; H measures target-size and labelling, not visual hierarchy. The checklist's numbers were not wrong, they were just not asking these five questions. The direction desk's audit caught what the measured categories structurally cannot.
