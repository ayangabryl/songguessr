---
name: qa
description: The design QA desk. Verifies the rendered build, never the code: a scripted capture matrix across viewports, themes and states, then measured passes for contrast, token conformance, targets, type, alignment and concentric corners, layout stability, motion tokens, character behaviour, copy, accessibility and performance, scored on a weighted sheet with a ship bar and reported with a number or a screenshot for every finding. The front desk calls it at step 7 of every job, first on "make it premium" jobs, and for any review where someone says "looks good" without evidence.
---

# QA

A screenshot is evidence. A number is evidence. A sentence is not. This desk runs the protocol with the scripts in `../../scripts/` and writes the report the direction desk scores. Run it before any rubric score is written.

Conventions: `[source: ...]` is traceable to section 9. `[house]` is a studio rule. Scripts assume Chrome on 127.0.0.1:9222 (`scripts/chrome.sh`), Node 22 or newer, Python 3, and artefacts written under a directory you name (in a cloud agent, `/opt/cursor/artifacts`).

## 1. When the front desk calls this desk

- Step 7 of every run sheet: capture, measure, report.
- First on "make it premium", "looks generic", review and audit jobs: the measured state of the current build becomes the brief.
- After any fix that touched layout, colour, motion or a character: re-run the affected pass, not the whole protocol.

Time box: a full protocol on one screen is 45 minutes; a targeted re-run is 10. `[house]`

## 2. Inputs required

- A running build with a URL. If it cannot run, the report says "not verified" and every score is provisional.
- `tokens.css` (for the scales the scripts read) and `motion-spec.md` (to compare against `getAnimations()`).
- The list of states to capture, with a one-line JavaScript expression that drives the page into each.
- The brief's primary task, to weight findings.

## 3. Decisions this desk owns

| Situation | Default | Escape hatch |
|---|---|---|
| Which viewports | 1440x900, 1280x660, 768x1024 touch, 390x844 touch | Add the client's analytics top device if it is not covered |
| Which themes | light and dark via `prefers-color-scheme`, plus the app's manual toggle when one exists (`--theme-key`) | Single theme only when the brief says the product ships one |
| Which states | idle, first run, every interactive state (open, typing, selected), success, error, empty, loading, reduced motion | Skip a state only if it cannot exist in the product |
| DPR | 2 | 1 only for full-page performance shots |
| Severity | S1 user-facing failure or bar violation; S2 system inconsistency visible at 1x; S3 visible at 2x or over time; S4 hygiene | None |
| Ship decision | Weighted average at or above 8.0, no category under 7, zero S1 | None; never round up |

## 4. Rules: the passes

Run in this order. Capture first so every finding is reproducible.

### 4.0 Brief pass

Before anything else, read the success metric and baseline from `brief.md` and measure them on the build. For scanning tasks: `node scripts/measure.mjs <url> --viewport=1440x900 --count=<row> --count-min=<baseline>` and again at `390x844m`. For action tasks: count taps or keystrokes from load to the primary action with `Input.dispatch*` and compare with the brief. For the kill list: confirm each killed pattern is absent in the captures. A miss here is S1 and the build cannot ship whatever the other passes say; passing every measurement while showing a quarter of the rows the old page showed is a failed redesign with clean numbers. If the brief has no numeric metric, stop and send it back to strategy. `[house]`

Reskin check (intake scope rethink or new): capture the build it replaces and the new build at the same viewport, place them side by side, and view at 25 percent zoom (`scripts/capture.mjs` for both; any image viewer at 25 percent, or downscale both to 360 px wide). Record three things: whether the structure differs (regions, order, weights) or only the skin; whether the one idea from `concept.md` can be pointed at in the small image; whether the one new mechanism is present in the render and reachable. Write one line describing each image as a stranger would; if the two lines are the same, the build is a reskin. This feeds category K; the metric floor above must still be met, so K never excuses a density regression and J never excuses a reskin. `[house]`

### 4.1 Capture matrix

```
bash scripts/chrome.sh
node scripts/capture.mjs <url> <outDir> states.json --name=<screen> --theme-key=<key> --wait=<.ready-selector>
```

`states.json` maps a state name to a page expression, for example `{"idle":"true","menu":"document.querySelector('.menu').click()"}`. Files are named `<screen>-<state>-<theme>-<width>.png`; the script prints the matrix table for the report and the horizontal overflow at each capture. Four viewports, two themes and ten states is 80 captures; script it, never hand-capture. Also record one video or a 100 ms screenshot burst of each reaction, the theme switch and any morphing control. `[house]`

### 4.2 Measurement pass

```
node scripts/measure.mjs <url> --viewport=390x844m --theme=light --theme-key=<key> --wait=<sel> --json=<outDir>/measure-390-light.json
node scripts/measure.mjs <url> --viewport=1440x900 --theme=dark --theme-key=<key> --wait=<sel>
```

Run at 390 and 1440, light and dark. It reads the scales from the page's own tokens (`--space-*`, `--r-*` or `--radius-*`, `--fs-*`, declared on `:root` or an app shell) and reports:

| Check | Floor | Source |
|---|---|---|
| Contrast of every visible text node against its composited background | 4.5:1 body; 3:1 at 24 px or 18.66 px bold; UI 3:1 | WCAG 2.2 1.4.3, 1.4.11 |
| Off-scale padding, margin, gap, radius, font-size | 0 unjustified | house |
| Interactive controls (inline text links exempt, counted separately) | 44x44 px on touch, 32 px on pointer; 24 px absolute floor | Apple HIG; WCAG 2.5.8 |
| Items above the fold (`--count=<row> --count-min=<baseline>`) | the brief's baseline | house |
| Smallest text | 12 px meta, 14 px UI, 16 px body | house |
| Unlabelled icon buttons | 0 | WCAG 4.1.2 |
| Uppercase labels | at most 1 per screen | Butterick; house |
| Horizontal overflow | 0 px | WCAG 1.4.10 |
| Non-concentric nested corners (inner = outer minus inset, within 1 px) | 0 | Apple iOS 26; house |
| Focus outline removed without a replacement | none | WCAG 2.4.7 |

Cross-check the lowest pairs with APCA: `python3 scripts/contrast.py "<fg>" "<bg>"` prints WCAG and Lc; body Lc 75, UI labels Lc 60, large text Lc 45. When WCAG and APCA disagree, the stricter one is the finding. `[source: APCA Bronze]` Test thin fills (chips, progress segments, hairlines) and the weakest stop of any gradient.

### 4.3 Alignment pass

Overlay a 4 px grid on the desktop captures (a fixed, pointer-events-none div drawn in the page) and measure. `[house]`
- Shared edges: `getBoundingClientRect().left` of every major block in a column agrees within 0.5 px.
- Optical centring: a play triangle sits about 6 percent of the button diameter right of geometric centre; a chevron 1 px toward its opening; a circle glyph about 10 percent larger than a square glyph. Compare `icon.getBBox()` centre with the button centre.
- Baselines: adjacent text of different sizes shares a baseline, not a vertical centre; a 1 px miss is visible at 2x.
- Vertical rhythm: section gaps are the largest gaps on the page.

### 4.4 Stability pass

Anchors do not move between states. Record the rect of each anchor (bar, stage, headline, primary control, input) in every state and diff; any delta above 0 px is a finding, S1 if the primary control or the figure moves. Observe `layout-shift` across every state transition; the bar for a single-screen app is 0.00 after load (Google's "good" is 0.1 for page loads). Overlays (menus, suggestions, toasts) never push flow content. Capture at 0 and 1500 ms after load and diff for font reflow. `[source: web.dev CLS; house]`

```js
window.__rects = (label, sels) => { const out = {}; for (const s of sels) { const r = document.querySelector(s)?.getBoundingClientRect(); if (r) out[s] = [r.x, r.y, r.width, r.height].map((v) => +v.toFixed(1)); } (window.__states ??= {})[label] = out; return out; };
window.__diff = (a, b) => Object.keys(__states[a]).map((k) => ({ k, d: __states[a][k].map((v, i) => +(__states[b][k]?.[i] - v).toFixed(1)) })).filter(({ d }) => d.some((v) => v !== 0));
new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) console.log('shift', e.value.toFixed(4)) }).observe({ type: 'layout-shift', buffered: true });
```

### 4.5 Motion pass

```
node scripts/motion-audit.mjs <url> --seconds=6 --trigger="<js that fires the main interaction>" --character=<.figure> --reduced --wait=<sel>
```

Reports every animation observed (target, name, duration, easing, iterations), whether each duration and easing resolves to a `--dur-*` or `--ease-*` token, `ease-in` on UI elements, infinite loops outside the character, UI animations running at idle, and long animation frames at or above 50 ms. `--reduced` re-runs under `prefers-reduced-motion: reduce` and lists transform animations outside the character. Compare the table against `motion-spec.md`: anything running that the spec does not list is a finding. Enter uses ease-out; exit is faster than enter; UI micro-interactions are at most 300 ms; input is never blocked (fire a click at 50 percent of a transition and confirm the state changes). Freeze transitions at 25, 50 and 75 percent with `a.pause(); a.currentTime = duration * f` and look for pops. `[source: Material 3; Kowalski; house]`

### 4.6 Character pass

```
node scripts/freeze.mjs <url> <.figure> <outDir>/poses --poses=idle,win,lose,tap --fractions=0,0.25,0.5,0.75,1 --blink=<.lid> --wait=<sel>
```

Freeze-frames every pose at each fraction as 2x crops, reports bounding-box drift between first and last frame (floor 0.5 px), and with `--blink` samples the lid transform for 60 s. Pass sheet: 6 to 20 blinks, coefficient of variation at least 0.25, close over total 0.20 to 0.45, each blink 100 to 400 ms, at least one double in 60 s, both lids identical. Check silhouettes for straight cuts through a limb and the ground line across poses. Trigger each reaction event ten times and read `data-variant`: at least two distinct per event and no immediate repeat. Full method in `../illustration/references/character.md`. `[source: blink literature there]`

### 4.7 Copy pass

Sentence case everywhere; at most one tracked uppercase label per screen; tabular numerals wherever numbers change (check `font-variant-numeric` and that width does not change between 0:07 and 0:11); labels are the user's words; one verb-first CTA per section; empty, loading and error copy is designed (a default "Something went wrong" is a finding). `measure.mjs` lists uppercase labels; grep the DOM for the rest. `[source: Butterick; house]`

### 4.8 Accessibility pass

Tab through the whole screen with `Input.dispatchKeyEvent`, screenshot each stop: a ring of at least 2 px at 3:1 against both the control and the canvas, never clipped. Log `document.activeElement` at each Tab; order matches the visual order; Escape closes; arrows move within composite widgets. Icon-only buttons carry names (`measure.mjs` lists offenders). Colour is never the only signal: re-shoot with `filter: grayscale(1)` on `html` and confirm every state still reads. Live regions announce results, not every tick. One capture each under reduced motion, forced colours and 200 percent zoom. `[source: WCAG 2.2 2.4.7, 2.4.11, 1.4.1, 4.1.2]`

### 4.9 Performance pass

Long animation frames: 0 at or above 50 ms during idle and during any reaction, at most 2 during load (`motion-audit.mjs` reports them). Layout churn: `Performance.getMetrics` before and after a reaction; a transform and opacity animation adds 0 layouts. INP proxy: time from `Input.dispatchMouseEvent` to the next paint, at most 200 ms, aim 100. Paint rectangles during idle touch only the figure. Bundle delta over 10 kB gzipped needs a written reason. Fonts: at most two families, subset, `swap` with size-adjust or `optional`, preloaded. `[source: web.dev LoAF, INP; CDP Performance]`

## 5. Defaults: scoring sheet

Start each category at 10; subtract 2 per failed binary check and 1 per additional instance; floor 0. Weighted average with a floor. `[house]`

| Category | Weight | Binary checks (2 points each) |
|---|---|---|
| J Brief conformance | 2.0 | primary-task metric met; baseline not regressed (e.g. items above the fold at 1440 and 390); every kill-list item absent; every state in the brief designed. Any miss is S1 |
| K Reskin test (rethink and new only; n/a on refresh) | 1.5 | structure differs, not only skin, at 25 percent side by side; the one idea is legible at that zoom; the one new mechanism is in the render and serves the primary task; the built structure is the chosen divergence option. Under 7 is S1 on a rethink |
| A Contrast and colour | 1.5 | body 4.5:1; UI 3:1; no colour-only signal; dark re-verified |
| B Tokens and type | 1.0 | off-scale spacing; off-scale radius; off-scale size; line-height and measure |
| C Alignment | 1.0 | shared edges; icon centring; baselines; concentric corners |
| D Stability | 1.5 | any anchor move; any post-load shift; font reflow |
| E Motion | 1.0 | off-token; ease-in or exit slower than enter; concurrency; reduced motion |
| F Character (n/a if none) | 1.0 | silhouette; bbox drift; blink metronome; single variant |
| G Copy | 0.5 | uppercase; proportional counters; default error copy |
| H Accessibility | 1.5 | missing focus ring; order jump; unlabelled icon button; colour-only |
| I Performance | 1.0 | long frame at or above 50 ms; layout during motion; INP over 200 ms; unexplained bundle growth |

Ship bar: weighted average at or above 8.0, no category under 7, zero S1, J at 10, and K at or above 7 when it applies. Otherwise "not shippable, lowest = <category> <score>". Never round up; never average away a 6. Clean measurements on a build that does the primary task worse than the one it replaces are not a pass; J exists so the sheet cannot say otherwise.

## 6. Anti-patterns

- Scoring 9.8 on a build that shows 6 rows where the old page showed 25. Fix: run the brief pass first; J is weighted 2.0 and any miss is S1.
- Scoring 9.8 on a rethink that is the old page with better type. Fix: the reskin check in 4.0; K is 1.5 and under 7 is S1. Clean numbers on the old structure are a refresh, and the intake card said rethink.
- Padding inline text links to 44 px to satisfy the target check. Fix: inline links are exempt (`measure.mjs` counts them separately); the row is the target.
- Grading from source: reading the CSS and concluding "blink is randomised" without sampling the running page. Fix: run `freeze.mjs --blink`.
- Adjectives in place of measurements ("looks aligned", "feels smooth"). Fix: the number and the file.
- One viewport, one theme, one state, then a verdict. Fix: the matrix.
- Screenshots at DPR 1, or after a fixed sleep with animations mid-flight. Fix: DPR 2, pause animations or wait for `finished`.
- Contrast computed from token hex values instead of the rendered pair. Fix: `measure.mjs` composites the real background.
- Checking targets and concentricity by eye. Fix: `measure.mjs`.
- Measuring CLS only at load. Fix: diff anchors across every state pair.
- Auditing motion by reading keyframes. Fix: `motion-audit.mjs`, then again under reduced motion.
- Freezing animations by editing CSS. Fix: pause the live `Animation` objects.
- Averaging categories, rounding 7.9 to 8, scoring Character n/a when a character exists.
- Findings without a fix, or fixes without a rule reference; deleting the capture set after the report.

## 7. Hand-off artefact

Fill `templates/qa-report.md`. Every finding carries severity, evidence (a file path or a number with units), the rule violated with the desk and section, and the fix in one line. A finding without evidence is deleted before the report ships. Keep the capture directory; evidence must stay reproducible.

Example finding:

```
S1  Transport moves 12 px down when suggestions open
    Evidence: game-idle-light-1440.png vs game-typing-light-1440.png; __diff('idle','typing') -> .transport y +12.0
    Rule: qa 4.4 anchors 0 px; direction slop-catalogue 39
    Fix: render suggestions as an overlay (position: absolute; top: 100%) inside .guess-row; reserve no flow space.
```

## 8. Checklist (five minutes, DOM plus one capture set)

0. Brief pass: success metric and baseline measured on the build at 1440 and 390, both met; every kill-list item absent?
1. Capture matrix exists: 4 viewports x 2 themes x all states, named per convention, DPR 2?
2. `measure.mjs` at 390 and 1440, light and dark: zero contrast failures, zero off-scale values, zero small targets, zero unlabelled buttons, at most one uppercase label, zero overflow, zero non-concentric corners?
3. Shared edges within 0.5 px; primary glyph optically centred; baselines meet?
4. Anchors 0 px across every state pair; CLS 0.00 after load; no font reflow?
5. `motion-audit.mjs`: all on token, no ease-in, nothing idle-moving except the figure, 0 long frames; spec table matches; reduced motion clean?
6. `freeze.mjs`: poses clean at every fraction, drift 0, blink sheet passes, variants cycle?
7. Sentence case; designed empty, loading and error copy; tabular counters?
8. Focus ring on every stop; keyboard order logged; grayscale capture still readable?
9. Scoring sheet filled; weighted average at or above 8.0; no category under 7; zero S1?
10. Every finding has severity, evidence, rule, fix?

## 9. Sources

- WCAG 2.2: 1.4.3 https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum ; 1.4.11 https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast ; 2.5.8 https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum ; 2.4.7 https://www.w3.org/WAI/WCAG22/Understanding/focus-visible ; 1.4.1 https://www.w3.org/WAI/WCAG22/Understanding/use-of-color ; 1.4.10 https://www.w3.org/WAI/WCAG22/Understanding/reflow
- APCA Readability Criterion, Bronze simple mode: https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html
- Apple HIG Layout (44 pt targets): https://developer.apple.com/design/human-interface-guidelines/layout
- web.dev Core Web Vitals thresholds, CLS, INP, long animation frames: https://web.dev/articles/defining-core-web-vitals-thresholds ; https://web.dev/articles/cls ; https://web.dev/articles/inp ; https://web.dev/articles/long-animation-frames
- Chrome DevTools Protocol, Emulation, Page, Performance, Input: https://chromedevtools.github.io/devtools-protocol/
- MDN, Document.getAnimations and Animation: https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations
- Ottosson, OKLab conversion matrices: https://bottosson.github.io/posts/oklab/
- Material 3 motion tokens: https://m3.material.io/styles/motion/overview/how-it-works
- Emil Kowalski, animation review standards: https://github.com/emilkowalski/skills
- Butterick, Practical Typography: https://practicaltypography.com/letterspacing.html
- Bjango, optical adjustments: https://bjango.com/articles/opticaladjustments/
