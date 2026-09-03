# Motion spec: Hacker News front page

Owner: motion desk. Consumed by: build, engineering, qa. Written before any transition is implemented; `scripts/motion-audit.mjs` compares the running page against this table.

Dialect: **tool snap** (`departments/motion/PLAYBOOK.md` §3.1/3.2, "Tools, dashboards, admin" row — matches the primary task, scanning at high frequency, and the tone words quiet/dense/legible). Tokens: `--dur-1`, `--dur-2`, `--ease-out`, `--ease-in-out` from `tokens.css`. This build has no panels, sheets, scenes or loops, so `--dur-3` and `--dur-4` are declared but unused — nothing forces every token to appear on every page.

Research (motion §3.4): three tool-density-adjacent products were used as the reference set already cited by the direction desk for this job — Linear (row hover is a lightness shift only, no colour change, under 150 ms), Raycast (list rows have zero motion at rest, feedback only on press) and the current Hacker News build itself (no motion at all). All three circle the same mechanism: feedback is a state change, not a performance. That is what "tool snap" is for.

| # | Element | Trigger | Property | From | To | Duration | Easing | Delay | Reduced motion |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `.vote` | press (`:active`) | transform scale | 1 | `var(--press-scale)` | `--dur-1` | `--ease-out` | 0 | scale removed (`--press-scale: 1`) |
| 2 | `.vote`, `.story-row a`, `.nav a`, `.footer a`, `.theme-toggle` | hover (`(hover: hover)` only) | color, background-color | resting tone | hovered tone | `--dur-1` | `--ease-out` | 0 | unaffected (colour is not motion) |
| 3 | any focusable element | focus-visible | outline | none | 2px solid `--focus` | 0 | none | 0 | unaffected |
| 4 | `body` (colour-token consumers) | theme toggle click | color, background-color | old theme values | new theme values | `--dur-2` | `--ease-in-out` | 0 | unaffected (colour is not motion) |
| 5 | `.skip-link` | keyboard focus | transform translateY, opacity | -150%, 0 | 0, 1 | `--dur-2` | `--ease-out` | 0 | opacity only, translate removed |
| 6 | `.error-state .retry` | press (`:active`) | transform scale | 1 | `var(--press-scale)` | `--dur-1` | `--ease-out` | 0 | scale removed |

## Choreography
- Enter order and stagger: none. The list renders in one paint with no per-row entrance animation — per the anti-pattern table ("everything animates on load"), a 30-row stagger would be the slowest possible way to let a frequent reader start scanning.
- Exit: not applicable; nothing in this build is removed from the DOM after mount.
- Concurrency: one thing moves at a time. Pressing `.vote` never coincides with a hover transition on the same element (the browser's own state machine already serialises `:hover`→`:active`).

## Interruptibility
Every animated property here is a CSS `transition`, which retargets automatically from its current value; there are no `@keyframes` loops to interrupt. A second press before release simply restarts the same 120 ms scale from wherever it is.

## Loops
None. No infinite animation exists on this build (no character, no spinner shown in the common case — see brief's loading state, which resolves before any indicator would appear).

## Budget
- Animated properties: `transform`, `opacity`, `color`, `background-color` only. Colour and background-color are not compositor properties, but every element they run on is small (a row, a button, a link) and static in position, so the repaint cost is negligible — nothing above the "medium" cost band in `departments/engineering/PLAYBOOK.md` §3.7 applies here (no blur, no filter, no shadow animation, no gradient).
- Simultaneous animations at peak: 1 (a single hovered or pressed control).
- Frame budget check: `scripts/motion-audit.mjs` reports long frames over 16.7 ms during the spec'd sequences (press, hover, theme toggle). See `qa-report.md` for the measured result.
