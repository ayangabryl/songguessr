---
name: motion
description: Decides duration and easing tokens, which motion dialect a product speaks, choreography, interruptibility, physical feedback, progress motion, loops and the reduced-motion policy, and which pattern from the catalogue to use. The front desk calls this desk at run-sheet step 5 (after the system exists, before any transition is written), for any motion or interaction pass, for "snappier", "smoother" or "more alive" requests, and to audit a running page against its motion spec.
---

# Motion desk

You are the motion designer. You own every number that describes how something moves: how long, along which curve, in which order, and what happens when the user prefers reduced motion. You do not own what moves on scroll in a creative scene (that is `../creative-web/PLAYBOOK.md`) or how a character is rigged (illustration). `[house]` marks a studio rule; everything else carries a source listed in section 9.

## 1. When the front desk calls this desk

- Run-sheet step 5: `tokens.css` exists and screens are built; nothing has been animated yet. Output is `motion-spec.md`.
- "Motion or interaction pass only": tune, remove or add transitions on an existing build.
- Any request phrased as feel: snappier, smoother, more premium, more alive, less busy. These are token and dialect problems first. `[house]`
- Fixing jank, fighting states, layout jumps, animations that block input.
- Illustration asks for shared timing tokens for a character.
- QA reports a mismatch between `getAnimations()` and the spec.

## 2. Inputs required

| Artefact | Why this desk needs it | Stop if missing |
|---|---|---|
| `brief.md` (primary task, product type, device, frequency of use) | Product type selects the default dialect; frequency sets the budget | Yes |
| `concept.md` (the one idea, three mechanisms, kill list) | Motion must explain the idea, not decorate it; kill list often names motion slop | Yes |
| `tokens.css` (`--dur-1..4`, `--ease-out`, `--ease-in-out`, `--ease-land`) | Every value in the spec is one of these | Yes |
| Rendered screens at 390, 768 and 1440 wide | Motion is designed on the real layout, not on a mock | Yes |
| Intake card line 8 (reduced-motion policy) | Chooses between the split policy and the all-zero policy in section 5 | No; default to the split |

## 3. Decisions this desk owns

### 3.1 Motion dialects

Pick the row that matches the product type and direction. One dialect per product; a second dialect is allowed only for the control layer of a consumer app (spring) or one named set piece (morph and goo). `[house]`

| Dialect | Use when (direction, product type) | Not when | Defaults | Cost | Reduced motion |
|---|---|---|---|---|---|
| Editorial fade | Editorial, portfolio, long-form reading, calm or archival directions; content enters as the reader arrives | Tools, dashboards, anything used 50 or more times a day; anything the user is waiting on | opacity 0 to 1 plus translateY 8 px to 0; `--dur-3` (320 ms) to `--dur-4` (520 ms); `--ease-out`; no blur; exit is opacity only at `--dur-2` | Lowest: transform and opacity | Drop the translate; keep opacity at `--dur-2` |
| Tool snap | Tools, dashboards, admin, editors, command surfaces; high frequency | Brand and campaign moments; hero copy | `--dur-1` (120 ms) to `--dur-2` (200 ms); `--ease-out`; scale 0.98 to 1 plus opacity; no translate; keyboard-initiated actions 0 ms | Lowest | Remove scale; opacity at `--dur-1` |
| Soft blur | Consumer product UI for in-place swaps: text and icon swaps, dropdowns, tooltips, modals, page side by side `[source: transitions.dev, 2026]` | Anything larger than a card; low-end targets; more than about 20 swaps per session; editorial | `filter: blur(2px)` (text, icon, panel) or 3 px (page slide) plus 8 px slide or scale 0.97; open `--dur-2` (transitions.dev ships 250 ms), close `--dur-1` (150 ms there); `--ease-out`, which is the same curve as transitions.dev `cubic-bezier(0.22, 1, 0.36, 1)` | Medium: blur repaints; fine on chips and text, drops frames on panels wider than about 600 px on integrated GPUs `[house]` | Remove blur and slide; opacity at `--dur-1` |
| Spring | Control layer of consumer apps (toggles, segmented indicators, sheets, drag release); playful, character-led and iOS-like directions | Opacity and colour (must never overshoot); editorial; sequences over 1 s | `--ease-land` (a `linear()` spring, 1.7 % overshoot) on transform only; `--dur-3` for moves, `--dur-2` for release; overshoot never above 8 % `[house]` | Low: `linear()` runs on the compositor `[source: Chrome, linear(), 2023]` | `--ease-land` becomes `--ease-out`; translate and scale removed |
| Scroll-driven | Cinematic brand launches, campaign pages, at most one hero scene on a portfolio; the object is the story | Product UI, documentation, e-commerce listing, any page whose primary task is reading or a form | CSS `animation-timeline: scroll()` or `view()` first; GSAP ScrollTrigger when pinning or timelines are needed; transform, opacity, clip-path only | High: images, layout, JS budget; owned by `../creative-web/PLAYBOOK.md` | Static sections with identical content; `animation: none` |
| Morph and goo | One set piece per site: a control that becomes its menu, a plus that fans into actions, a hero | Anything that repeats; navigation used every visit; text-bearing surfaces larger than a pill | SVG goo filter (blur 6, contrast 18 per libraries.dev), clip-path morph, or View Transitions; `--dur-3` to `--dur-4`; `--ease-in-out`; content fades in after 60 % of the morph | High: filters and snapshots; test at 4x CPU throttle | Cut to a crossfade at `--dur-2` |

### 3.2 Default dialect per product type

| Product type | Default | Escape hatch |
|---|---|---|
| Tools, dashboards, admin, editors | Tool snap | Spring on exactly one control (a segmented indicator) when the brief's tone words include playful |
| Consumer apps | Soft blur for swaps; spring for the control layer | Tool snap on high-frequency surfaces (search, compose, command palette) |
| Editorial, portfolio, studio sites | Editorial fade | One scroll-driven hero scene when creative-web says yes |
| Brand launch, campaign | Scroll-driven (creative-web plans the scenes) | Editorial fade when the budget in creative-web section 5 fails |
| Any product | Nothing gets goo by default | One set piece, named in `concept.md`, with its cost in the spec |

### 3.3 Which token for which job

| Job | Property | Duration | Easing | Notes |
|---|---|---|---|---|
| Feedback (press, tick, hover tint) | background, colour, transform scale | `--dur-1` | `--ease-out` in; `--ease-land` on release | Must start within one frame (16.7 ms) of input `[source: Apple WWDC18]` |
| Enter (menu, toast, row, panel) | opacity 0 to 1 plus translate 8 px or scale 0.96 to 1 | `--dur-2` small, `--dur-3` medium | `--ease-out` | Never scale from 0 `[house]` |
| Exit | opacity 1 to 0 plus translate 4 px away | `--dur-1` (about 0.6x the enter) | `--ease-out` | Exits are shorter and travel less `[house]` |
| Move (reorder, indicator glide, layout change) | transform translate, scaleX | `--dur-3` | `--ease-land` | Spatial equals spring; retargetable mid-flight |
| Morph (button to menu, pill to sheet) | clip-path, border-radius, View Transition group | `--dur-3` to `--dur-4` | `--ease-in-out` | Begins and ends on screen, so an in-out curve `[source: Material 3 motion]` |
| Crossfade (theme, image, text) | opacity | `--dur-2` | `linear` keyword | Two linear opacities crossing at 50 % `[house]` |
| Progress fill | transform scaleX | real elapsed time | `linear` keyword | Section 4, rule 22 |
| Theme switch | consumers of colour tokens | `--dur-3` | `--ease-in-out` | One transition at the consumer level, not per element `[house]` |
| Scene, hero, character beat | transform, opacity, clip-path | `--dur-4` | `--ease-out` | Once per page load |

The keyword `linear` is the only non-token easing allowed, and only for opacity crossfades and progress. Anything else that is not a `--dur-*` or `--ease-*` token is a defect. `[house]`

### 3.4 Research before choosing

Do this before section 3.1 is applied, and write the result into `concept.md` under mechanisms. `[house]`

1. Open three reference sites in the same category as the brief (same product type, same primary task). Not three sites you like.
2. For every element that moves on each site, write one line: trigger, property, estimated duration (count frames in a 60 fps recording; 6 frames is 100 ms), easing shape (starts fast or ends fast), and whether it repeats.
3. Circle the mechanisms that explain something (origin, destination, change of state). Cross out the ones that decorate.
4. Write the dialect that fits the brief and the three circled mechanisms in one line each. If two dialects fit, take the quieter one.
5. Blur is not a default because a library ships it. transitions.dev uses 2 to 3 px blur because its audience is consumer product UI; a dashboard or an editorial page borrows the timing, not the blur.

Model of a set piece: otherkind.design puts one crafted interaction in the hero (a live-editable vector wordmark, see `../creative-web/PLAYBOOK.md` section 5) and nothing else on the page moves except a single 8 px fade-in. One idea, silence elsewhere. `[source: otherkind.design, 2026]`

## 4. Rules

Tokens
1. Every duration and curve resolves to `--dur-1..4`, `--ease-out`, `--ease-in-out` or `--ease-land`. A raw `ms` or `cubic-bezier()` in component CSS is a defect. `[house]`
2. The ramp is 120, 200, 320, 520 ms; each step is about 1.6x the last. Missing value: add a token with a one-line reason, never a literal. `[house]`
3. Ease-out for anything the user triggers; it starts fast so the response reads as instant. Never ease-in on an enter. `[source: Kowalski, Great Animations]`
4. `--ease-in-out` is reserved for morphs and moves that begin and end on screen and for theme switches; never for enters, exits or hover. `[source: Material 3 motion; Kowalski]`
5. One spring, `--ease-land`, generated with the `linear()` generator by Jake Archibald and Adam Argyle from a damped spring; overshoot at most 8 %, ours is 1.7 %. Springs run on transform only. `[source: Chrome, linear(); Material 3 spring tokens]`
6. Feedback and most transitions finish under 300 ms; above that the user watches the interface instead of using it. Product UI never exceeds 600 ms for a single transition. `[source: Kowalski; house]`
7. Frequency sets the budget: keyboard-initiated actions, command palettes and actions repeated hundreds of times a day get 0 ms. `[source: Kowalski; Apple HIG Motion]`

Choreography
8. One thing moves at a time. A shared-element morph and its content crossfade count as one thing. `[house]`
9. Exits are faster than enters (0.6 to 0.7x) and travel less; the eye follows arrivals. `[house]`
10. Stagger siblings 20 to 40 ms; cap the staggered set at five items and animate the rest together. `[house]`
11. Parent before children: the container reaches 50 % of its enter before the first child starts; children never move while the container is resizing. `[source: Material 3 container transform; house]`
12. Response before motion: tint or state colour changes within one frame, then the spatial part animates. Enters come from where the trigger is; exits return there. `[source: Apple WWDC18 Fluid Interfaces]`
13. Purpose test: before adding motion, name what it explains (origin, destination, change of state). No answer, no motion. `[source: Kowalski]`

iOS 26 fluid behaviours as targets (copy the behaviour, not the glass) `[source: Apple WWDC25 Meet Liquid Glass]`

| Behaviour | What Apple does | Web implementation `[house]` |
|---|---|---|
| Controls morph into menus | A toolbar button pops open into its menu, keeping one floating control plane | Same DOM node grows via View Transition or transform plus border-radius on `--dur-3` `--ease-in-out`; items fade in after 60 % |
| Press lifts the control | Elements lift into glass on touch; rest state stays quiet | `:active` scale 0.97 plus tone shift at `--dur-1`; release on `--dur-2` `--ease-land`; no permanent hover elevation |
| Materialise, not fade | Glass materialises by modulating lensing rather than fading | Enter with scale 0.96 to 1 plus opacity on `--ease-out`; never opacity alone for chrome |
| Scroll-edge separation | Content dissolves under chrome as it scrolls | Toggle `data-scrolled` via `IntersectionObserver` on a sentinel; transition background, shadow, hairline at `--dur-3`; no per-frame scroll handlers |
| Segmented indicator glides | The selection indicator slides and reshapes | One indicator element, `translateX` plus `scaleX` on `--dur-3` `--ease-land`; text colour crossfades at `--dur-2` |
| Buttons turn into progress | The control becomes the progress surface in place | Same node: label fades out at `--dur-2`, fill grows via `scaleX` in real time; spinner only if total time is unknown |
| Concentric nesting | Controls nest into rounded corners with concentric radii | Inner radius equals outer radius minus padding, held during morphs |
| Thicker when larger | Bigger glass casts deeper shadow | Menu shadow larger than button shadow, same shadow system |

Shared elements and view transitions
14. Use the View Transitions API when the tapped thing becomes the shown thing (card to detail, chip to sheet, thumbnail to hero). Exactly one `view-transition-name` per moving element, unique in the DOM at snapshot time. `[source: MDN View Transition API]`
15. Provide the non-transition fallback (`if (!document.startViewTransition) update()`); skip the group movement under reduced motion and keep the root crossfade. Never use view transitions for frequent state (typing, hover). `[source: MDN; house]`

State machines and interruptibility
16. Every animated component owns an explicit state; no state is reached by an animation finishing. Entering a state cancels in-flight motion. `[house; source: Rive, Duolingo state machines]`
17. Use CSS `transition` for state (retargets from the current value), `@keyframes` only for loops. Interrupted keyframes restart and pop. `[source: Kowalski]`
18. Guard fast re-entry: if the same state re-arrives within one duration, do not restart from zero. Write `data-state` only when it changes. `[house]`
19. Result states hold at least 600 ms and at most 2000 ms before returning to idle; input stays enabled throughout. `[house]`
20. Every JS-driven animation returns a cancel handle; unmount and route change cancel it. Never block input during motion; if a click mid-exit is dangerous, disable the target logically. `[source: Apple WWDC18; house]`

Physical feedback, progress, loops
21. Press: `:active` scale 0.97 for controls at or above 44 px, 0.95 for icon buttons, none for text links; paired with a tone shift (L minus 0.04 light, plus 0.04 dark). Overshoot only via the spring and only on one peak control per screen. `[house; source: Apple WWDC25]`
22. Progress is honest: a time bar is `transform: scaleX(elapsed / total)` against real time with `linear`; never eased, never catching up; fake percentages are forbidden; hold the full state at least 200 ms before transforming. Indeterminate progress is one calm spinner or shimmer with a period of at least 1 s. `[house]`
23. Sound-reactive motion (music apps): drive one property from an `AnalyserNode` RMS sampled at 60 Hz, attack 40 ms, release 200 ms, mapped to `scale(1 + 0.04 * level)`; never move layout, never exceed 4 % scale, mute under reduced motion. `[house]`
24. No infinite loops by default. A loop needs a purpose (a character's idle, an indeterminate spinner), must rest when the page is idle for 10 s or hidden (`visibilitychange`), and there is at most one on screen. `[house]`

Reduced motion `[source: Apple HIG Accessibility; App Store Connect reduced-motion criteria; WCAG 2.2 SC 2.3.3]`
25. The split: remove translation and scale; keep opacity changes under 200 ms; keep determinate progress (it is information); keep focus rings and colour changes. Removing all transitions makes state changes snap without confirmation, which is worse. Default is the split; the all-zero block in `templates/tokens.css` is the escape hatch for a brief whose policy is "no motion".
26. Under reduced motion, spatial enters become crossfades at `--dur-2`, loops stop, overshoot is removed, view-transition groups do not move, parallax and scroll-linked movement are off, character reactions become a pose swap with a 120 ms crossfade. Offer an in-app toggle that sets the same variables. `[house]`

Performance `[source: Kowalski; Chrome rendering docs; MDN will-change]`
27. Animate `transform`, `opacity` and `clip-path` only. Width, height, top, left, margin, padding and box-shadow on large boxes are never animated.
28. `filter: blur()` and `backdrop-filter` are the expensive compositor properties: allowed on chips, icons, text lines and cards under about 600 px wide; on anything larger, fade a pre-blurred layer instead. `[house]`
29. `will-change: transform` only on the one to three elements about to animate, added before and removed after. Blanket `will-change` and `translateZ(0)` hacks cost memory and blur text.
30. Budget 16.7 ms per frame at 60 Hz, 8.3 ms at 120 Hz; per-frame JS above 4 ms is a risk on 120 Hz devices. Frames over 50 ms are reported by the Long Animation Frames API. Avoid `scale` on text (rasterises blurry); scale the container and counter-scale the text. `[source: Chrome LoAF; house]`

## 5. Defaults

Tokens (already in `templates/tokens.css`; repeated here so the spec can quote them):

```css
:root {
  --dur-1: 120ms;  /* state change: hover, pressed, exit */
  --dur-2: 200ms;  /* small move, fade, swap, enter of small things */
  --dur-3: 320ms;  /* panel, sheet, layout change, indicator glide */
  --dur-4: 520ms;  /* scene, hero, character; once per page load */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);     /* enters, exits, feedback */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* morphs, theme switch */
  --ease-land: linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001);
  --stagger: 30ms;
  --press-scale: 0.97;
}
```

Spring parameters when a JS library (Framer Motion, react-spring, Rive, SwiftUI) is unavoidable; mass 1. `[source: Material 3 spring tokens; Apple WWDC23 Animate with springs]`

| Token | Stiffness | Damping ratio | Settles | Use |
|---|---|---|---|---|
| fast spatial | 1400 | 0.9 | about 225 ms | buttons, switches, chips, press release |
| default spatial | 700 | 0.9 | about 320 ms | sheets, menus, segmented indicator, cards |
| slow spatial | 300 | 0.9 | about 485 ms | full-screen container morphs |
| effects | 3800 / 1600 / 800 | 1.0 | 120 to 350 ms | colour, opacity; must not overshoot |
| bouncy (escape hatch) | 500 | 0.7 | about 465 ms | one peak moment per screen; gesture with velocity; 4.6 % overshoot |

Damping ratio relates to the raw coefficient by c = 2 * zeta * sqrt(k * m). Apple's `duration`/`bounce` API maps to the same physics: bounce 0 is zeta 1.0; bounce 0.15 to 0.25 is zeta 0.75 to 0.85. Convert any of these to CSS with the `linear()` generator and store the result as a token.

Press and release:

```css
.control { transition: transform var(--dur-2) var(--ease-land), background-color var(--dur-1) var(--ease-out); }
.control:active { transform: scale(var(--press-scale)); transition-duration: var(--dur-1); }
```

Reduced-motion split (default policy):

```css
@media (prefers-reduced-motion: reduce) {
  :root { --dur-3: 200ms; --dur-4: 200ms; --ease-land: var(--ease-out); --press-scale: 1; --stagger: 0ms; }
  .enter, .exit, [data-motion] { translate: 0; scale: 1; transition-property: opacity, background-color, color; }
  .loop { animation: none; }
  ::view-transition-group(*) { animation-duration: 0s; }
}
```

Shared element:

```css
.card { view-transition-name: hero; }
::view-transition-group(hero) { animation-duration: var(--dur-4); animation-timing-function: var(--ease-in-out); }
::view-transition-old(root), ::view-transition-new(root) { animation-duration: var(--dur-2); }
```

```js
const update = () => applyStateChange();
if (!document.startViewTransition) update(); else document.startViewTransition(update).finished.then(() => el.removeAttribute('style'));
```

State machine (every component with motion documents one):

```
idle --press--> pressed --release--> active --result--> success | failure --timeout--> idle
any state --cancel or new input--> idle   (entering a state cancels in-flight motion)
```

Long-frame observer for QA sessions:

```js
new PerformanceObserver(l => l.getEntries().forEach(e => console.warn('long frame', Math.round(e.duration) + 'ms', e.scripts?.map(s => s.sourceURL))))
  .observe({ type: 'long-animation-frame', buffered: true });
```

## 6. Anti-patterns

| Slop | Fix |
|---|---|
| Everything animates on load (hero, nav, cards, footer all stagger in) | One enter per page load on the element that carries the idea; everything else is present at first paint |
| Bounce on every button | Overshoot only via `--ease-land` on the one peak control; all other presses are scale 0.97 with `--ease-out` |
| Blur on everything | Blur only in the soft-blur dialect, only on chips, text, icons and cards under 600 px wide, only 2 to 3 px |
| Parallax on product UI | Remove it; scroll-linked movement belongs to creative-web scenes and never to tools |
| Hover effects on touch devices | Wrap hover in `@media (hover: hover)`; touch gets press feedback only |
| Animations that block input | Input stays enabled; disable logically if a mid-exit click is dangerous |
| Duration over 600 ms in product UI | Cap at `--dur-4`; anything longer is a scene and needs creative-web |
| Loops that never rest (pulsing dots, radar ripples, shimmer forever) | No loop by default; a permitted loop stops after 10 s idle or when the tab is hidden |
| Motion that hides layout shift (content slides in to mask a reflow) | Reserve the space; fix the shift; then decide whether an enter is even needed |
| "Active" dots and pulsing status indicators | A static dot with a colour token; state changes crossfade at `--dur-1` |
| `ease-in-out` or `ease` on UI state, `ease-in` on an enter, `linear` on a spatial move | `--ease-out` for enters and exits, `--ease-land` for moves, `--ease-in-out` only for morphs |
| Keyframes for state; two rules transitioning the same property | `transition` for state; one owner per property |
| Scale-from-zero enters; exits as long as enters | Scale from 0.96; exits at `--dur-1` with less travel |
| Reduced motion handled by deleting transitions | Apply the split in section 5 |
| Raw `ms` or `cubic-bezier()` in components; per-element theme transitions | Tokens only; one transition at the colour-token consumer |

## 7. Hand-off artefact

Fill `templates/motion-spec.md`. One row per animated property per trigger; values are tokens except `from` and `to`. Example rows:

| # | Element | Trigger | Property | From | To | Duration | Easing | Delay | Reduced motion |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `.segment-indicator` | segment click | transform translateX, scaleX | current | target | `--dur-3` | `--ease-land` | 0 | instant |
| 2 | `.menu` | button press | opacity, transform scale | 0, 0.97 | 1, 1 | `--dur-2` | `--ease-out` | 0 | opacity only |
| 3 | `.menu` | close | opacity, transform scale | 1, 1 | 0, 0.99 | `--dur-1` | `--ease-out` | 0 | opacity only |
| 4 | `.row` (n of 5) | list enter | opacity, translateY | 0, 8 px | 1, 0 | `--dur-2` | `--ease-out` | n x `--stagger`, max 5 | opacity only |

Below the table fill the dialect line, the choreography block (enter order, stagger, exits, concurrency), interruptibility, loops (default none) and budget.

Audit: `scripts/motion-audit.mjs <url>` drives the page through headless Chrome, calls `document.getAnimations({ subtree: true })` after each spec'd trigger, and prints every running animation with target selector, property, duration, easing and delay, then lists every animation whose target or property is not in the spec, every off-token duration, every `ease`, `ease-in` or `ease-in-out` keyword, every non-compositor property, every infinite loop and every frame over 16.7 ms during the spec'd sequences. The spec is done when the script prints no unmatched rows. When the script cannot run, paste this in DevTools mid-transition:

```js
const TOKENS = [120, 200, 320, 520], OK = /^(transform|opacity|translate|scale|rotate|clip-path)$/;
console.table(document.getAnimations({ subtree: true }).map(a => { const t = a.effect.getComputedTiming(), p = a.transitionProperty ?? a.animationName ?? '(WAAPI)', ms = Number(t.duration), loop = t.iterations === Infinity;
  return { el: a.effect.target.id || a.effect.target.className, p, ms, easing: a.effect.getTiming().easing, flags: [!loop && !TOKENS.includes(ms) && 'off-token', /^ease/.test(a.effect.getTiming().easing) && 'keyword easing', a.transitionProperty && !OK.test(p) && 'layout/paint', loop && 'loop'].filter(Boolean).join('; ') || 'ok' }; }));
```

## 8. Checklist

- [ ] Dialect chosen from 3.1 and written on the spec; product type matches 3.2.
- [ ] Three reference sites logged with mechanisms (3.4) before the dialect was chosen.
- [ ] Every duration and easing on the spec is a token; the only keyword is `linear` on opacity or progress.
- [ ] Every enter is `--ease-out`; every exit is at `--dur-1` or shorter and travels less than its enter.
- [ ] Feedback starts within one frame and finishes within 200 ms.
- [ ] Only transform, opacity and clip-path transition; blur only in the soft-blur dialect on small elements.
- [ ] Stagger 20 to 40 ms, at most five staggered items.
- [ ] In a 60 fps recording only one thing moves at a time.
- [ ] Double-trigger causes no restart or pop; input works mid-animation.
- [ ] Progress fills are linear against real time and hold 200 ms at completion.
- [ ] Shared elements use View Transitions or one node; content fades in after 60 %.
- [ ] No infinite loop, or exactly one with a purpose that rests.
- [ ] Reduced motion: translation and scale gone, opacity under 200 ms, progress kept.
- [ ] `scripts/motion-audit.mjs` reports no unmatched, off-token or long-frame rows at 4x CPU throttle.
- [ ] Every pattern used is in `references/patterns.md` or has a written reason.

## 9. Sources

- Emil Kowalski, Great Animations (ease-out, under 300 ms, purpose, keyboard actions at 0 ms, transform and opacity, interruptible transitions, reduced motion, review next day) https://emilkowal.ski/ui/great-animations ; Animations on the Web https://animations.dev/
- Jakub Antalik, transitions.dev (32 transitions; dropdown 250 ms open / 150 ms close, scale 0.97 / 0.99; `cubic-bezier(0.22, 1, 0.36, 1)`; blur 2 to 3 px; slide 8 px) https://transitions.dev ; https://github.com/jakubantalik/transitions.dev
- Material 3 motion: easing (standard `0.2, 0, 0, 1`; decelerate `0, 0, 0, 1`; emphasized decelerate `0.05, 0.7, 0.1, 1`; emphasized accelerate `0.3, 0, 0.8, 0.15`), durations 50 to 1000 ms, spring tokens (1400 / 700 / 300 at damping 0.9; effects 3800 / 1600 / 800 at damping 1) https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md ; https://m3.material.io/styles/motion/overview
- Apple WWDC25 Meet Liquid Glass (lensing, materialise, lift on touch, morph between controls, menu pops open, scroll edge effects, concentricity, thicker when larger) https://developer.apple.com/videos/play/wwdc2025/219/ ; Build a SwiftUI app with the new design https://developer.apple.com/videos/play/wwdc2025/323/ ; Adopting Liquid Glass https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- Apple WWDC18 Designing Fluid Interfaces https://developer.apple.com/videos/play/wwdc2018/803/ ; WWDC23 Animate with springs https://developer.apple.com/videos/play/wwdc2023/10158/
- Apple HIG Motion https://developer.apple.com/design/human-interface-guidelines/motion ; HIG Accessibility https://developer.apple.com/design/human-interface-guidelines/accessibility ; App Store Connect reduced-motion criteria https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/
- W3C WCAG 2.2, SC 2.3.3 Animation from Interactions https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions
- MDN, Using the View Transition API https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using ; MDN `will-change` https://developer.mozilla.org/en-US/docs/Web/CSS/will-change ; MDN `Document.getAnimations()` https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations
- Chrome for Developers, `linear()` easing (spring and bounce approximations; generator by Jake Archibald and Adam Argyle) https://developer.chrome.com/docs/css-ui/css-linear-easing-function ; https://linear-easing-generator.netlify.app/
- Chrome for Developers, Long Animation Frames API https://developer.chrome.com/docs/web-platform/long-animation-frames
- libraries.dev, Gooey (liquid-gooey; blur 6, contrast 18 defaults) https://libraries.dev/gooey
- otherkind.design (one set piece, silence elsewhere) https://otherkind.design
- DIA / Mitch Paone on documented motion logic https://www.creativeboom.com/insight/how-to-do-motion-first-branding-better/ ; Rive, Duolingo state machines https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life
