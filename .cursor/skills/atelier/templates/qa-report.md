# Design QA: <screen or build sha> - <date>

Owner: qa desk. Consumed by: direction (audit and decision).

## Capture matrix
Run: `node scripts/capture.mjs <url> <out-dir>`. Viewports 390x844 (mobile), 768x1024 (tablet), 1440x900 (desktop), 1280x660 (short laptop); themes light and dark; states <list every state captured>.

| Viewport | Theme | State | File |
|---|---|---|---|
| 390x844 | light | idle | <path> |

## Brief pass
Success metric from `brief.md`: <statement>. Baseline (current build): <numbers>. Measured on this build: <numbers, with the command>. Kill list: <each item, present or absent>.

Reskin check (rethink and new only): before and after at 25 percent, same viewport: <paths>. Structure differs: <yes or no, what>. One idea legible: <yes or no>. New mechanism present and reachable: <yes or no, where>. Stranger's line, before: <one line>. After: <one line>.

## Measurements
Run: `node scripts/measure.mjs <url>` and `python3 scripts/contrast.py`.

| Check | Result | Floor | Pass |
|---|---|---|---|
| Text contrast, lowest pair | <ratio> (<fg> on <bg>, <selector>) | 4.5:1 body, 3:1 large and UI | |
| Off-scale spacing values | <count> (<values>) | 0 unjustified | |
| Smallest touch target (mobile) | <w x h px> (<selector>) | 44x44 | |
| Smallest text | <px> (<selector>) | 12 px meta, 14 px UI, 16 px body | |
| Horizontal overflow | <px at viewport> | 0 | |
| Layout shift between states | <px moved, which element> | 0 above the fold | |
| Running animations vs spec | <n running, n unspecified> | 0 unspecified | |
| Long frames during spec'd sequences | <count over 16.7 ms> | 0 | |

## Findings (ranked by severity)
Severity: S1 user-facing failure or bar violation; S2 system inconsistency visible at 1x; S3 visible at 2x or over time; S4 hygiene.

| # | Severity | Finding | Evidence | Rule | Fix |
|---|---|---|---|---|---|
| 1 | S1 | <what and where> | <file or number with units> | <desk section> | <one line> |

## Passed measurements
<List the checks that passed with their numbers. Proof, not prose.>

## Character pass (if any)
<Blink interval samples, lid symmetry, gaze events, reaction variants observed, repeats observed.>

## Score
Start at 10; minus 2 per failed binary check, minus 1 per additional instance; floor 0. Weights from `departments/qa/PLAYBOOK.md` section 5.

| Category | Weight | Score /10 | Failed checks |
|---|---|---|---|
| J Brief conformance (must be 10) | 2.0 | | |
| K Reskin test (rethink and new; at or above 7) | 1.5 | | |
| A Contrast and colour | 1.5 | | |
| B Tokens and type | 1.0 | | |
| C Alignment | 1.0 | | |
| D Stability | 1.5 | | |
| E Motion | 1.0 | | |
| F Character (n/a if none) | 1.0 | | |
| G Copy | 0.5 | | |
| H Accessibility | 1.5 | | |
| I Performance | 1.0 | | |
| Weighted average | | | Ship at or above 8.0, no category under 7, zero S1, J 10, K at or above 7 where it applies |

Decision: <ship | loop>. If loop, the top five findings above become the next brief.
