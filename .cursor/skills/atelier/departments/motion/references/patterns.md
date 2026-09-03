# Motion pattern catalogue

Loaded from `../PLAYBOOK.md` section 3 and 7. Every pattern gives: use when, avoid when, the default per dialect (property, from, to, duration token, easing token, delay), the HTML hooks or CSS shape, reduced-motion behaviour and a source. Tokens are `--dur-1` 120 ms, `--dur-2` 200 ms, `--dur-3` 320 ms, `--dur-4` 520 ms, `--ease-out`, `--ease-in-out`, `--ease-land` from `templates/tokens.css`.

transitions.dev numbers are quoted verbatim; the house token beside each is the nearest step of the ramp (250 ms becomes `--dur-2`, 150 ms becomes `--dur-1`, 350 to 400 ms become `--dur-3`, 500 ms becomes `--dur-4`). When a brief needs the exact library value, add a token with a one-line reason. transitions.dev's `cubic-bezier(0.22, 1, 0.36, 1)` is identical to `--ease-out`. `[house; source: transitions.dev, 2026]`

Dialect abbreviations in the default lines: TS tool snap, SB soft blur, EF editorial fade, SP spring. The first dialect listed is the default for the pattern; others are deltas.

## Contents

| # | Pattern | # | Pattern | # | Pattern |
|---|---|---|---|---|---|
| 1 | Button press | 10 | Drawer | 19 | Skeleton to content |
| 2 | Hover lift | 11 | Toast | 20 | List reorder, insert, remove |
| 3 | Tab indicator glide | 12 | Accordion and disclosure | 21 | Card expand |
| 4 | Segmented control | 13 | Tab and page transitions (side by side) | 22 | Theme switch |
| 5 | Toggle and switch | 14 | Text state swap | 23 | Image reveal |
| 6 | Dropdown or menu (origin-aware) | 15 | Number pop-in or counter | 24 | Hero text reveal |
| 7 | Tooltip | 16 | Icon swap | 25 | Progress ring and bar |
| 8 | Modal | 17 | Success check | 26 | Avatar group hover |
| 9 | Sheet and panel | 18 | Error shake | 27 | Badge pop-in |

## Feedback and controls

### 1. Button press
- Use when: any pressable control at or above 44 px. Avoid when: text links; keyboard-initiated actions (0 ms) `[source: Kowalski]`.
- TS (default): transform scale 1 to 0.97, `--dur-1`, `--ease-out`, 0 delay; release 0.97 to 1, `--dur-2`, `--ease-land`. SP: release on `--dur-3` `--ease-land`. EF: tone shift only, no scale. Icon buttons scale to 0.95.
```css
.btn { transition: transform var(--dur-2) var(--ease-land), background-color var(--dur-1) var(--ease-out); }
.btn:active { transform: scale(0.97); transition-duration: var(--dur-1); }
```
- Reduced motion: scale removed; the background tone shift stays. `[source: Apple WWDC25 (lift on touch); house]`

### 2. Hover lift
- Use when: a pointer device is present and the element is a link card in editorial or portfolio work. Avoid when: touch devices; product UI cards; anything that also has a press state (the two fight).
- EF (default): transform translateY 0 to -2 px plus shadow token swap, `--dur-2`, `--ease-out`, 0. TS: colour change only, `--dur-1`. SB and SP: not used.
```css
@media (hover: hover) { .card:hover { transform: translateY(-2px); transition: transform var(--dur-2) var(--ease-out); } }
```
- Reduced motion: colour change only. `[source: Kowalski (frequency budget); house]`

### 3. Tab indicator glide
- Use when: two to six tabs with a visible underline or pill. Avoid when: tabs change width per breakpoint without a measured indicator; more than six tabs (scroll instead).
- TS (default): one indicator element, transform translateX current to target plus scaleX, `--dur-3`, `--ease-land`, 0; label colour crossfades at `--dur-2`. transitions.dev: 250 ms, `cubic-bezier(0.22, 1, 0.36, 1)`. SB: same with `--ease-out` at `--dur-2`.
```css
.tabs { position: relative; } .tabs .pill { position: absolute; inset: 4px auto 4px 0; transition: transform var(--dur-3) var(--ease-land), width var(--dur-3) var(--ease-land); }
```
- First paint and resize: set transform and width with `transition: none`, reflow, restore. Reduced motion: indicator jumps; colour crossfade stays. `[source: transitions.dev, Tabs sliding; Apple WWDC25 (segmented indicator glides)]`

### 4. Segmented control
- Use when: two to five mutually exclusive options that switch a view. Avoid when: options submit a form (use radios); labels wrap.
- SP (default): indicator translateX plus scaleX, `--dur-3`, `--ease-land`, 0; selected label colour `--dur-2` `--ease-out`; optional accent hue shift on `:root` at `--dur-3` `--ease-in-out`. TS: `--dur-2` `--ease-out`.
```html
<div role="tablist" class="segmented" data-index="1"><span class="pill" aria-hidden="true"></span><button role="tab" aria-selected="false">Easy</button><button role="tab" aria-selected="true">Normal</button></div>
```
- Reduced motion: indicator jumps; colour stays. `[source: Apple WWDC25 Meet Liquid Glass; Material 3 spring default spatial]`

### 5. Toggle and switch
- Use when: a binary setting that applies immediately. Avoid when: the change needs a save action (checkbox).
- SP (default): thumb transform translateX 0 to track width minus thumb, `--dur-2`, `--ease-land`, 0; track colour `--dur-1` `--ease-out`. transitions.dev: 350 ms, travel 14.66 px, overshoot 1 px then 0 px, `cubic-bezier(0.34, 1.35, 0.64, 1)`. TS: `--ease-out` at `--dur-1`.
```css
.switch[aria-checked="true"] .thumb { transform: translateX(var(--travel)); } .thumb { transition: transform var(--dur-2) var(--ease-land); }
```
- Reduced motion: thumb jumps; track colour crossfades at `--dur-1`. `[source: transitions.dev, Toggle; Apple WWDC25 (knob becomes glass on interaction)]`

## Surfaces

### 6. Dropdown or menu (origin-aware)
- Use when: a surface anchored to its trigger (menu, popover, select). Avoid when: the surface is centred with no anchor (modal); on the command palette (0 ms).
- SB (default): opacity 0 to 1 plus transform scale 0.97 to 1 from the trigger's corner, open `--dur-2`, close `--dur-1` with scale to 0.99, `--ease-out`, 0. transitions.dev: 250 ms open, 150 ms close, pre-scale 0.97, closing scale 0.99, `data-origin` selects `transform-origin`. TS: no scale, opacity at `--dur-1`. SP: open with `--ease-land` at `--dur-3`.
```css
.menu { transform-origin: top left; transform: scale(0.97); opacity: 0; pointer-events: none; transition: transform var(--dur-2) var(--ease-out), opacity var(--dur-2) var(--ease-out); }
.menu[data-origin="top-right"] { transform-origin: top right; } .menu[data-origin="bottom-left"] { transform-origin: bottom left; }
.menu.is-open { transform: none; opacity: 1; pointer-events: auto; } .menu.is-closing { transform: scale(0.99); opacity: 0; transition-duration: var(--dur-1); }
```
- Remove `.is-closing` after `--dur-1` or the next open starts from 0.99. Reduced motion: opacity only, `--dur-1`. `[source: transitions.dev, Menu dropdown]`

### 7. Tooltip
- Use when: a hover or focus hint on an icon or truncated label. Avoid when: the content is required to complete the task; on touch (use a visible label).
- TS (default): opacity 0 to 1 plus scale 0.98 to 1, in `--dur-1` after an 80 ms delay, out 0 ms to 50 ms, `--ease-out`. transitions.dev: in 150 ms, out 50 ms, scale 0.98, delay 80 ms, `ease-out`.
```css
.tt { opacity: 0; transform: scale(0.98); transition: opacity 50ms var(--ease-out), transform 50ms var(--ease-out); }
:is(.has-tt:hover, .has-tt:focus-visible) .tt { opacity: 1; transform: none; transition-duration: var(--dur-1); transition-delay: 80ms; }
```
- The 50 ms exit and 80 ms delay are the two literals allowed outside the ramp; record them as `--tt-out` and `--tt-delay`. Reduced motion: no scale. `[source: transitions.dev, Tooltip open/close]`

### 8. Modal
- Use when: a blocking decision or a focused task that must not lose context. Avoid when: the content fits inline or in a sheet; frequent flows.
- SB (default): dialog opacity 0 to 1 plus scale 0.96 to 1, open `--dur-2`, close `--dur-1` back to 0.96, `--ease-out`, 0; backdrop opacity at the same durations. transitions.dev: 250 ms open, 150 ms close, scale 0.96. TS: opacity plus scale 0.98 at `--dur-1`. EF: opacity plus translateY 8 px at `--dur-3`.
```css
dialog { opacity: 0; transform: scale(0.96); transition: opacity var(--dur-2) var(--ease-out), transform var(--dur-2) var(--ease-out), display var(--dur-2) allow-discrete; }
dialog[open] { opacity: 1; transform: none; } dialog::backdrop { transition: opacity var(--dur-2) var(--ease-out); }
```
- Reduced motion: opacity only. `[source: transitions.dev, Modal open / close]`

### 9. Sheet and panel
- Use when: a surface that slides in from an edge and partially covers the page (bottom sheet, side panel, filters). Avoid when: the panel is the page's main content on desktop (make it a column).
- SP (default, consumer): transform translateY 100 % to 0 (bottom) or translateX, open `--dur-3`, close `--dur-2`, `--ease-land` open, `--ease-out` close, 0; scrim opacity at `--dur-2`. SB: transitions.dev Panel reveal, translateY 100 px plus blur 2 px, 400 ms open, 350 ms close, becomes `--dur-3` both. TS: `--dur-2` `--ease-out`, no blur.
```css
.sheet { transform: translateY(100%); transition: transform var(--dur-3) var(--ease-land); } .sheet[data-open] { transform: none; }
.sheet.is-closing { transition: transform var(--dur-2) var(--ease-out); }
```
- Reduced motion: crossfade at `--dur-2`, no translate. `[source: transitions.dev, Panel reveal; Material 3 spring default spatial (bottom sheet)]`

### 10. Drawer
- Use when: navigation or a secondary task on mobile, dismissable by drag. Avoid when: the page is a tool with persistent navigation (fixed sidebar).
- SP (default): transform translateX -100 % to 0, `--dur-3`, `--ease-land`, 0; drag follows the finger 1:1 and releases on `--ease-land` at `--dur-2`; scrim opacity tracks progress. TS: `--dur-2` `--ease-out`. Drag threshold 40 % of width or velocity over 0.5 px per ms to dismiss. `[house]`
```js
el.style.transition = 'none'; el.style.transform = `translateX(${dx}px)`;             // while dragging
el.style.transition = 'transform var(--dur-2) var(--ease-land)'; el.style.transform = ''; // on release
```
- Reduced motion: crossfade at `--dur-2`. `[source: Kowalski, Great Animations (Family drawer); Apple WWDC18 (redirectable)]`

### 11. Toast
- Use when: a confirmation that needs no action, or one optional action. Avoid when: the message is an error that blocks progress (inline); more than one toast at a time without stacking.
- SB (default): opacity 0 to 1 plus translateY 16 px to 0 plus scale 0.97 to 1 plus blur 2 px to 0, in `--dur-3`, out `--dur-2`, `--ease-out`, 0. transitions.dev: 350 ms open, 250 ms close, 16 px, blur 2 px, scale 0.97. TS: opacity plus translateY 8 px at `--dur-2`. Stacking: older toasts translate back 12 px and scale down 0.06 per level. `[source: transitions.dev, Banner stacking]`
```css
.toast { opacity: 0; transform: translateY(16px) scale(0.97); filter: blur(2px); transition: opacity var(--dur-3) var(--ease-out), transform var(--dur-3) var(--ease-out), filter var(--dur-3) var(--ease-out); }
.toast.is-shown { opacity: 1; transform: none; filter: none; } .toast.is-hiding { transition-duration: var(--dur-2); }
```
- Auto-dismiss at 5 s minimum; pause on hover and focus. Reduced motion: opacity only. `[source: transitions.dev, Toast open / close; WCAG 2.2 SC 2.2.1]`

### 12. Accordion and disclosure
- Use when: a header with a collapsible body (FAQ, settings group, show more). Avoid when: only one item can ever be open and the content is short (show it).
- TS (default): body `grid-template-rows` 0fr to 1fr, `--dur-2`, `--ease-out`, 0; chevron `scaleY(1)` to `scaleY(-1)` at `--dur-2`. transitions.dev: 250 ms expand, collapse and chevron. EF: `--dur-3`.
```css
.acc-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-2) var(--ease-out); } .acc-panel > .inner { overflow: hidden; min-height: 0; }
[aria-expanded="true"] + .acc-panel { grid-template-rows: 1fr; } [aria-expanded="true"] .chevron { transform: scaleY(-1); }
```
- Padding goes on `.inner`, never on the 0fr track. `grid-template-rows` is a layout property and the one exception to rule 27; keep panels under one viewport tall. Reduced motion: instant. `[source: transitions.dev, Accordion expand]`

## Navigation and swaps

### 13. Tab and page transitions (side by side)
- Use when: list to detail, step 1 to step 2, tab panels with a spatial relationship. Avoid when: unrelated destinations; keyboard-driven navigation in tools (0 ms).
- SB (default): outgoing opacity 1 to 0 plus translateX 0 to -8 px plus blur 0 to 3 px; incoming opacity 0 to 1 plus translateX 8 px to 0 plus blur 3 px to 0; `--dur-2`, `--ease-out`, 0. transitions.dev: 250 ms slide and fade, 8 px, blur 3 px. TS: opacity only at `--dur-1`. EF: `--dur-3`, no blur.
```css
.page[data-state="exit"] { opacity: 0; transform: translateX(-8px); filter: blur(3px); }
.page[data-state="enter-from"] { opacity: 0; transform: translateX(8px); filter: blur(3px); }
.page { transition: opacity var(--dur-2) var(--ease-out), transform var(--dur-2) var(--ease-out), filter var(--dur-2) var(--ease-out); }
```
- Direction flips on back navigation. Cross-document: `@view-transition { navigation: auto; }` with the same values on `::view-transition-old(root)` and `::view-transition-new(root)`. Reduced motion: opacity only. `[source: transitions.dev, Page side-by-side; MDN View Transition API]`

### 14. Text state swap
- Use when: a label changes in place (Save to Saved, status lines, counts). Avoid when: the text changes on every keystroke; body copy.
- SB (default): outgoing opacity 1 to 0 plus translateY 0 to -4 px plus blur 0 to 2 px; incoming from 4 px and blur 2 px; `--dur-1`, `--ease-out`, 0. transitions.dev: 150 ms, 4 px, blur 2 px, `ease-in-out`. TS: opacity only at `--dur-1`. EF: opacity at `--dur-2`.
```html
<span class="swap" aria-live="polite"><span class="swap-old">Save</span><span class="swap-new">Saved</span></span>
```
- Reserve the width of the longest state so the container does not resize. Reduced motion: opacity only. `[source: transitions.dev, Text states swap]`

### 15. Number pop-in or counter
- Use when: a value updates and the change matters (price, score, count). Avoid when: values tick faster than once per second; tables of numbers.
- SB (default): each changed digit opacity 0 to 1 plus translateY 8 px to 0 plus blur 2 px to 0, `--dur-2`, `--ease-out`, stagger 30 ms per digit, at most five digits staggered. transitions.dev: 500 ms, 8 px, stagger 70 ms, blur 2 px, `cubic-bezier(0.34, 1.45, 0.64, 1)`. SP: `--ease-land` at `--dur-3`. Counter variant: digits spin like a reel, transitions.dev 1400 ms, 30 px cell, blur 3 px; allowed only for one hero number.
```css
.digit { display: inline-block; font-variant-numeric: tabular-nums; animation: pop var(--dur-2) var(--ease-out) both; animation-delay: calc(var(--i) * var(--stagger)); }
@keyframes pop { from { opacity: 0; transform: translateY(8px); filter: blur(2px); } }
```
- Reduced motion: instant swap. `[source: transitions.dev, Number pop-in; Spinning counter]`

### 16. Icon swap
- Use when: two icons share a slot (play to pause, menu to close, copy to check). Avoid when: the icons differ in meaning so much that a crossfade misleads.
- SB (default): outgoing opacity 1 to 0 plus scale 1 to 0.25 plus blur 0 to 2 px; incoming the reverse; `--dur-2`, `--ease-out`, 0. transitions.dev: 250 ms, blur 2 px, start scale 0.25, `ease-in-out`. TS: opacity at `--dur-1`. SP: incoming on `--ease-land`.
```css
.icon-slot { display: grid; } .icon-slot > svg { grid-area: 1 / 1; transition: opacity var(--dur-2) var(--ease-out), transform var(--dur-2) var(--ease-out), filter var(--dur-2) var(--ease-out); }
.icon-slot[data-state="b"] .a, .icon-slot:not([data-state="b"]) .b { opacity: 0; transform: scale(0.25); filter: blur(2px); }
```
- Reduced motion: opacity only. `[source: transitions.dev, Icon swap]`

## Status and results

### 17. Success check
- Use when: a completed action worth a beat (payment, upload, form submitted). Avoid when: the action repeats often (every save); inside a list row.
- SP (default): check container opacity 0 to 1 plus scale 0.96 to 1, `--dur-2`, `--ease-out`; path `stroke-dashoffset` length to 0, `--dur-3`, `--ease-out`, delay 80 ms; one bob translateY -8 px on `--ease-land`. transitions.dev: 500 ms, rotate from 80 deg, bob 40 px, blur from 10 px, path delay 80 ms; treat the rotate and 10 px blur as brand-moment options. TS: path draw only at `--dur-2`.
```css
.check path { stroke-dasharray: var(--len); stroke-dashoffset: var(--len); transition: stroke-dashoffset var(--dur-3) var(--ease-out) 80ms; }
.check.is-done path { stroke-dashoffset: 0; }
```
- Set `--len` from `path.getTotalLength()` plus 1. Reduced motion: check appears at `--dur-1` opacity. `[source: transitions.dev, Success check; Checkbox check]`

### 18. Error shake
- Use when: invalid input, wrong code, a rejected drop. Avoid when: the error is asynchronous (the user is not looking); more than once per submit.
- TS (default): transform translateX 0, -6 px, 6 px, -4 px, 4 px, 0 over `--dur-3` total, `--ease-out` per segment, 0; border colour to error token at `--dur-1`; message enters at `--dur-2`. transitions.dev: 6 px distance, 4 px overshoot, 80 ms and 60 ms segments, auto-revert after 3000 ms over 280 ms.
```css
.field.is-shaking { animation: shake var(--dur-3) var(--ease-out); }
@keyframes shake { 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
```
- Replay with `void el.offsetWidth` between class removal and re-add. Keep `.is-error` and `.is-shaking` separate. Reduced motion: border colour and message only. `[source: transitions.dev, Error state shake]`

### 19. Skeleton to content
- Use when: content arrives after 300 ms and its shape is known. Avoid when: load is under 300 ms (show nothing); the shape is unknown (spinner).
- SB (default): skeleton opacity pulse 1 to 0.5 to 1 over 1000 ms once, then content opacity 0 to 1 plus blur 2 px to 0 at `--dur-3`, `--ease-out`, 0. transitions.dev: pulse 1000 ms, min 0.5, one pulse; reveal 400 ms, blur 2 px, `ease-in-out`. TS: opacity at `--dur-2`, no pulse.
```css
.skel { animation: pulse 1000ms linear 1; } @keyframes pulse { 50% { opacity: 0.5; } }
.content { opacity: 0; filter: blur(2px); transition: opacity var(--dur-3) var(--ease-out), filter var(--dur-3) var(--ease-out); } .is-revealed .content { opacity: 1; filter: none; }
```
- Skeleton and content occupy the same box so nothing shifts. Reduced motion: no pulse; opacity at `--dur-2`. `[source: transitions.dev, Skeleton loader and reveal]`

### 20. List reorder, insert, remove
- Use when: rows move, arrive or leave while the list stays on screen. Avoid when: the whole list is replaced (crossfade the container); lists over 50 rows (animate the viewport rows only).
- SP (default): move via FLIP (first, last, invert, play): transform from old to new position, `--dur-3`, `--ease-land`, 0; insert opacity 0 to 1 plus translateY 8 px, `--dur-2`, `--ease-out`, stagger 30 ms up to five; remove opacity 1 to 0 at `--dur-1`, then collapse. TS: `--ease-out` at `--dur-2`.
```js
const first = new Map([...list.children].map(el => [el, el.getBoundingClientRect().top])); reorder();
for (const el of list.children) { const dy = first.get(el) - el.getBoundingClientRect().top; if (dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 320, easing: getComputedStyle(el).getPropertyValue('--ease-land') }); }
```
- Reduced motion: opacity only; no move. `[source: Paul Lewis, FLIP; Material 3 spring default spatial]`

### 21. Card expand
- Use when: a card becomes its detail view (App Store cards, gallery to lightbox). Avoid when: the detail is a different page with no shared element; the card is in a dense grid used as a tool.
- SP (default): View Transition group on the card, `--dur-4`, `--ease-in-out`, 0; root crossfade `--dur-2`; content fades in after 60 %. Fallback: same node with `position: fixed` plus transform and border-radius on `--dur-3` `--ease-land`. TS: crossfade only at `--dur-2`.
```css
.card[data-expanded] { view-transition-name: card; } ::view-transition-group(card) { animation-duration: var(--dur-4); animation-timing-function: var(--ease-in-out); }
```
- Radius stays concentric during the morph. Interruptible: Escape mid-flight reverses from the current value. Reduced motion: crossfade. `[source: MDN View Transition API; Kowalski (interruptible App Store cards)]`

### 22. Theme switch
- Use when: light to dark or hue change. Avoid when: on first paint (apply the stored theme before render, no transition).
- TS (default): background and colour on token consumers, `--dur-3`, `--ease-in-out`, 0, applied once on `html.is-theming` and removed after. EF: `--dur-4`. Images and shadows do not transition.
```js
document.documentElement.classList.add('is-theming'); document.documentElement.dataset.theme = next;
setTimeout(() => document.documentElement.classList.remove('is-theming'), 320);
```
```css
html.is-theming, html.is-theming * { transition: background-color var(--dur-3) var(--ease-in-out), color var(--dur-3) var(--ease-in-out), border-color var(--dur-3) var(--ease-in-out); }
```
- Reduced motion: instant. `[source: Material 3 motion (standard easing for on-screen change); house]`

## Reveals and progress

### 23. Image reveal
- Use when: one hero or editorial image per screen enters as it comes into view. Avoid when: every image in a grid; product listings; anything above the fold (it is the LCP element; show it).
- EF (default): clip-path inset(0 100 % 0 0) to inset(0), `--dur-4`, `--ease-out`, 0, triggered once by `IntersectionObserver` at 30 % visible. Scroll-driven variant (creative-web only): `animation-timeline: view()` with `animation-range: entry 0% entry 100%`.
```css
.reveal img { clip-path: inset(0 100% 0 0); transition: clip-path var(--dur-4) var(--ease-out); } .reveal.is-in img { clip-path: inset(0); }
```
- Reduced motion: image is visible at first paint. `[source: MDN CSS scroll-driven animations; house]`

### 24. Hero text reveal
- Use when: a headline plus one supporting line on a landing or empty state, once per page load. Avoid when: per-letter splitting (rasterises, breaks screen readers); body copy; product UI.
- EF (default): per line, opacity 0 to 1 plus translateY 12 px to 0, `--dur-4`, `--ease-out`, stagger 40 ms, at most five lines; lines are wrapped `display: block` spans with the text left as one accessible string. SB: add blur 3 px to 0. transitions.dev: 500 ms, 12 px, stagger 40 ms, blur 3 px. Clip-path variant per line (creative-web) in `../../creative-web/PLAYBOOK.md`.
```css
.lines > span { display: block; animation: rise var(--dur-4) var(--ease-out) both; animation-delay: calc(var(--i) * 40ms); }
@keyframes rise { from { opacity: 0; transform: translateY(12px); } }
```
- Reduced motion: text visible at first paint. `[source: transitions.dev, Texts reveal]`

### 25. Progress ring and bar
- Use when: determinate progress (upload, playback, steps). Avoid when: time is unknown (indeterminate spinner, period at least 1 s); as decoration.
- TS (default): bar transform scaleX(elapsed / total) driven by real time, `linear`, 100 ms transition to smooth 10 Hz updates; ring `stroke-dashoffset` from circumference to 0, same timing; hold 200 ms at completion before any transform. Segmented: current segment linear; completed segments snap at `--dur-2`; next segment never pre-fills.
```css
.bar > i { transform-origin: left; transform: scaleX(var(--p)); transition: transform 100ms linear; }
.ring circle { stroke-dasharray: var(--c); stroke-dashoffset: calc(var(--c) * (1 - var(--p))); transition: stroke-dashoffset 100ms linear; }
```
- Never eased, never catching up, no fake percentages. Reduced motion: unchanged; determinate progress is information. `[house; source: Apple HIG Motion (do not make people wait); Material 3 progress indicators]`

### 26. Avatar group hover
- Use when: a horizontal stack of avatars, chips or tag pills on a pointer device in a consumer or marketing surface. Avoid when: touch; tools; more than about eight items.
- SP (default): hovered item translateY 0 to -4 px plus scale 1 to 1.05 with distance falloff 0.45 per neighbour, `--dur-3`, `--ease-out` in, `--ease-land` return, 0. transitions.dev: lift -4 px, 320 ms, scale 1.05, falloff 0.45, return `cubic-bezier(0.34, 3.85, 0.64, 1)` (beyond the 8 % overshoot cap; use `--ease-land`).
```js
row.addEventListener('pointermove', e => { const i = [...row.children].indexOf(e.target.closest('.avatar')); row.querySelectorAll('.avatar').forEach((a, j) => a.style.setProperty('--shift', `${Math.max(0, 1 - Math.abs(i - j) * 0.45) * -4}px`)); });
```
- Set the return easing inline on `pointerleave` before clearing `--shift`. Reduced motion: no lift; a border colour change. `[source: transitions.dev, Avatar group hover]`

### 27. Badge pop-in
- Use when: a count or dot appears on a trigger (unread, cart). Avoid when: the count changes more than once per minute (swap the number with pattern 14 instead of popping).
- SP (default): badge opacity 0 to 1 plus transform translate(-8 px, 12 px) to 0 plus scale 0.5 to 1, `--dur-2` slide then `--dur-3` pop, `--ease-out` slide, `--ease-land` pop, 0; close scale to 0.5 at `--dur-1`. transitions.dev: slide 260 ms, pop 500 ms, close 180 ms, blur 2 px, offset -8.2 px / 12.4 px, pop ease `cubic-bezier(0.34, 1.36, 0.64, 1)`. TS: opacity at `--dur-1`.
```css
.badge { opacity: 0; transform: translate(-8px, 12px) scale(0.5); transition: opacity var(--dur-2) var(--ease-out), transform var(--dur-3) var(--ease-land); }
.badge.is-shown { opacity: 1; transform: none; }
```
- Animate the badge, not the trigger. Reduced motion: opacity only. `[source: transitions.dev, Notification badge]`

## Sources

- Jakub Antalik, transitions.dev (patterns 3, 5 to 9, 11 to 19, 24, 26, 27 and their default values) https://transitions.dev ; skill and reference files https://github.com/jakubantalik/transitions.dev
- Emil Kowalski, Great Animations (frequency budget, interruptible cards, Family drawer, keyboard actions at 0 ms) https://emilkowal.ski/ui/great-animations
- Apple WWDC25 Meet Liquid Glass (lift on touch, segmented indicator, knobs become glass) https://developer.apple.com/videos/play/wwdc2025/219/ ; WWDC18 Designing Fluid Interfaces (redirectable drags) https://developer.apple.com/videos/play/wwdc2018/803/
- Apple HIG Motion https://developer.apple.com/design/human-interface-guidelines/motion
- Material 3 motion: spring tokens (default spatial for sheets, menus, indicators) and easing https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md ; progress indicators https://m3.material.io/components/progress-indicators/guidelines
- MDN, Using the View Transition API https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using ; MDN CSS scroll-driven animations https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations
- Paul Lewis, FLIP your animations https://aerotwist.com/blog/flip-your-animations/
- W3C WCAG 2.2, SC 2.2.1 Timing Adjustable (toast dismissal) https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable
