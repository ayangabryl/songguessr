# Motion spec: <screen or product>

Owner: motion desk. Consumed by: build, illustration, qa. Written before any transition is implemented; `scripts/motion-audit.mjs` compares the running page against this table.

Dialect: <editorial fade | tool snap | soft blur | spring | scroll-driven | morph> (from `departments/motion/PLAYBOOK.md` section 3). Tokens: `--dur-*`, `--ease-*` from `tokens.css`.

| # | Element | Trigger | Property | From | To | Duration | Easing | Delay | Reduced motion |
|---|---|---|---|---|---|---|---|---|---|
| 1 | <.selector> | <hover / press / mount / state x to y / scroll 0 to 1> | <transform / opacity / clip-path> | <value> | <value> | `--dur-2` | `--ease-out` | 0 | <none / instant / opacity only> |
| 2 | | | | | | | | | |

## Choreography
- Enter order and stagger: <parent first, children 30 ms apart, max 5 staggered items>
- Exit: <faster than enter; --dur-1; no stagger>
- Concurrency: <one thing moves at a time unless listed together here>

## Interruptibility
<Which animations must be cancellable mid-flight and what happens (retarget to new value, never restart from 0).>

## Loops
<Any infinite animation, its purpose, and how it rests when the page is idle or hidden. Default: none.>

## Budget
- Animated properties: transform, opacity, clip-path only, unless listed with a reason.
- Simultaneous animations at peak: <n>.
- Frame budget check: `scripts/motion-audit.mjs` reports long frames over 16.7 ms during the spec'd sequences.
