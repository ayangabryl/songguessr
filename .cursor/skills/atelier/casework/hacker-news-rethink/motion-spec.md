# Motion spec: Hacker News front page (rethink)

Owner: motion desk. Consumed by: build, qa. Written before any transition is implemented; `scripts/motion-audit.mjs` compares the running page against this table.

Dialect: tool snap (`departments/motion/PLAYBOOK.md` section 3.1 and 3.2, default for Tool density). Used 50+ times a day, dense, no scenes. Nothing animates on load; the tide-line divider and every velocity delta are present at first paint, not revealed. Tokens: `--dur-*`, `--ease-*` from `tokens.css`.

| # | Element | Trigger | Property | From | To | Duration | Easing | Delay | Reduced motion |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `.story-row` | hover (`hover: hover` only) | background-color | `--bg` | `--surface-2` | `--dur-1` | `--ease-out` | 0 | kept (colour only, no transform) |
| 2 | `.story-row` | press | transform scale | 1 | 0.99 | `--dur-1` | `--ease-out` | 0 | removed (`--press-scale: 1`) |
| 3 | `.theme-toggle` | hover | background-color | `--surface` | `--surface-2` | `--dur-1` | `--ease-out` | 0 | kept |
| 4 | `.theme-toggle` | press | transform scale | 1 | `var(--press-scale)` | `--dur-1` | `--ease-out` | 0 | removed |
| 5 | `:focus-visible` (any) | keyboard focus | outline | none | 2px solid `--focus` | 0 | - | 0 | kept (never animated) |
| 6 | `html`, `body`, `.story-row`, `.tide-mark` | theme toggle click | color, background-color | old token value | new token value | `--dur-3` | `--ease-in-out` | 0 | instant (`--dur-3: 0ms` under reduced motion) |

## Choreography
- Enter order and stagger: none. The list, the tide-line divider and every velocity delta render at first paint with no fade or stagger; a dense, several-times-a-day screen is read the instant it exists, not performed. (`departments/motion/PLAYBOOK.md` anti-pattern: "everything animates on load".)
- Exit: not applicable; nothing on this screen exits (no toasts, no dismissible panels in the shipped build).
- Concurrency: one thing moves at a time. Hover and press are mutually exclusive states of the same element; the theme switch is the only transition that touches more than one element, and it is one `--dur-3` colour transition applied at the token-consumer level (rule 6), not staggered per row.

## Interruptibility
A press interrupted by pointer-up before 120 ms simply reaches its target early; CSS `transition` retargets from the current value, so there is nothing to cancel. The theme switch is a colour-only transition with no spatial component, so a second toggle mid-transition retargets cleanly with no pop.

## Loops
None. No idle motion, no spinner, no pulsing indicator anywhere on this screen.

## Budget
- Animated properties: `transform` (press feedback only) and `background-color`/`color` (hover and theme switch, both small-area or token-consumer-level per engineering 3.7 and the colour desk's own `.button-primary:hover` default). No `filter`, `blur`, `box-shadow` animation, no layout property in a `transition`.
- Simultaneous animations at peak: 1 (the single element under the pointer, or the one theme-switch transition).
- Frame budget check: `scripts/motion-audit.mjs` reports long frames over 16.7 ms during the spec'd sequences; none expected, since nothing here is a spatial move above a 2-3 px hover tint.
