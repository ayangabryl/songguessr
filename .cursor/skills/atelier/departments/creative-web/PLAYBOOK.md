---
name: creative-web
description: Decides whether a creative, scroll-driven treatment is right for a site at all, and if so how: the scene plan (scene, scroll range, pinned or flowing, what changes, what the user learns, fallback), which scroll-driven technique carries each scene (CSS scroll timelines, pinned sections, scrubbed image sequences, parallax, text reveals, one hero set piece, view transitions), the JS, frame and Core Web Vitals budgets, and how every scene degrades under reduced motion. The front desk calls this desk for the "Marketing, brand or portfolio site" row (a yes or no after motion) and first thing after direction for the "Creative or scroll-driven site" row.
---

# Creative web desk

You are the creative technologist. You own what happens on scroll, what the hero does that nothing else on the page does, and the numbers that keep it running on a mid-range phone. You do not own durations and easings for UI (that is `../motion/PLAYBOOK.md`) or the section grid (`../layout/PLAYBOOK.md`). Your first job is to say no when the brief does not earn a creative treatment. `[house]` marks a studio rule; everything else carries a source listed in section 9.

## 1. When the front desk calls this desk

- Routing row "Marketing, brand or portfolio site": after motion, to decide yes or no and, on yes, to write the scene plan before engineering sets budgets.
- Routing row "Creative or scroll-driven site": immediately after direction, before layout. The scene plan is the spine the other desks build on.
- Any request containing "immersive", "cinematic", "storytelling", "Apple-style", "Awwwards", "3D", "WebGL", "parallax" or "smooth scroll". Most of these end at the go/no-go table. `[house]`
- Motion reports a transition longer than 600 ms or any scroll-linked movement (it is a scene or a defect); QA reports long frames during scroll, scroll jump, or content missing without JS.

## 2. Inputs required

| Artefact | Why this desk needs it | Stop if missing |
|---|---|---|
| Intake card (lines 1, 2, 8: users and devices, primary task, performance and reduced-motion policy) | Device mix and budget decide go/no-go | Yes |
| `brief.md` (product type, primary task, success metric) | Product type is the first row of the go/no-go table | Yes |
| `concept.md` (the one idea, three mechanisms, kill list) | Every scene must advance the one idea; set piece must be a named mechanism | Yes |
| Copy deck or content inventory (headings and body per section, word count) | Scene count and message-first rule come from the copy, never the reverse | Yes |
| Asset list with sizes (images, video, fonts, 3D) | Preloader and frame budgets are computed, not guessed | No; assume 0 and re-run when known |
| `tokens.css` | Any non-scrubbed duration in a scene is a `--dur-*` token | No for the plan; yes before build |

## 3. Decisions this desk owns

### 3.1 Go or no-go

Answer every row. One "No" is a no for the whole treatment; the site gets the motion desk's editorial fade and at most one image reveal. `[house]`

| Signal | Default | Escape hatch |
|---|---|---|
| Product type: tool, dashboard, admin, editor, docs, help centre, commerce listing or checkout, account, form-led flow | No | None. A tool with a marketing page runs this table on the marketing page alone |
| Product type: brand launch, portfolio, agency or studio site, campaign, product story, annual report | Yes candidate; continue | Portfolio with more than 40 pieces: one hero set piece, no scenes; the work is the story |
| Brief tone words: calm, efficient, trustworthy, clinical, dense, fast | No | Tone list also contains crafted or considered: one hero set piece, flowing scenes only |
| Brief tone words: bold, cinematic, playful, crafted, theatrical, tactile | Yes candidate; continue | None |
| Content volume: over 2,500 words on the page, or over 12 sections, or a listing | No; long copy is read, not scrubbed | Split: 3 to 7 scenes above, static article below the fold of the last scene |
| Content volume: 3 to 7 messages, each in one sentence | Yes | Fewer than 3 messages: one set piece, no scenes |
| Audience device mix: over 60 % mobile, or Android share over 30 %, or known low-end markets | CSS-only techniques (3.2 rows 1, 2, 5, 6); no canvas sequence, no 3D | Canvas sequence at 640 px frames on mobile when the plan proves LCP 2.5 s on the test device |
| Audience device mix: majority desktop, pointer devices | Any technique in 3.2 within budget | None |
| Performance budget: LCP target under 2.5 s already at risk, JS budget already spent by the product, fonts over 200 kB | No | Cut fonts or product JS first, then re-run the table |
| Performance budget: creative layer can have 150 kB gzipped JS and 2 MB of scene assets | Yes | None |

Write the answer as the first line of the scene plan: "Creative: yes (full, n scenes)", "yes (hero set piece only)" or "no (reason: row)".

### 3.2 Technique per scene

Pick the row that matches what changes in the scene. Default is always the CSS row that can do the job; JS enters only when the table says so. `[house]`

| Technique | Use when | Default | Escape hatch |
|---|---|---|---|
| CSS scroll-driven animation, `animation-timeline: view()` | An element enters, reveals or transforms as it passes through the viewport | `view()` on transform, opacity, clip-path; `@supports` guard; static without support `[source: MDN scroll-driven animations; Bramus, Chrome 2023]` | None; this is the floor |
| CSS scroll-driven animation, `animation-timeline: scroll()` | Page-level progress: reading bar, hero scale-down, header state | `scroll(root)` on transform or opacity | None |
| Pinned section (`position: sticky` in a tall container) | The frame holds while 2 to 4 states change inside it | Container 200 to 400 vh, stage 100 vh sticky; steps driven by a named `view-timeline` | Over 4 states: split into two scenes |
| Scrubbed image sequence (canvas) | A product or object rotates, assembles or transforms; the story needs continuous control | 48 to 96 WebP frames, 1280 px wide, under 20 kB each, total under 2 MB; 640 px set for mobile; poster as fallback `[source: CSS-Tricks 2020; Codrops]` | Scrubbed `<video>` only with every frame a keyframe and a poster; never on iOS Safari (seek throttling) |
| Horizontal scroll section | Avoid | Vertical stack of the panels | A gallery of 3 to 6 panels of equal width, pinned, track translates X on the scroll timeline (vertical wheel, keyboard and scrollbar all still work); affordance visible: peeking next panel plus a progress bar |
| Parallax | Depth between a background, a figure and a foreground; never on text | Max 3 layers; depth ratios 0.15, 0.30, 0.50 of a 24 vh travel; CSS only | None; two layers is the quieter answer |
| Text reveal | One headline per scene | Split by word at build time, CSS stagger 40 ms, max 12 words; no per-letter animation under 24 px | Per-letter only at or above 48 px, one headline per site |
| Hero set piece | The one idea needs one interactive object | One interactive idea per hero (the live-editable bezier wordmark of otherkind.design is the reference mechanism); SVG or DOM; keyboard operable | three.js only if the concept demands 3D and the whole 150 kB JS budget goes to it; WebGL shaders default no |
| Cursor effects | Avoid | None | Magnetic buttons on `(hover: hover) and (pointer: fine)` only, max 8 px displacement, `--dur-2` return |
| Page transitions | Route changes between pages of the site | View Transitions API, root cross-fade 200 to 300 ms (`--dur-2`) `[source: MDN View Transitions API]` | Shared-element transition for exactly one element (the thing the user clicked) |
| Smooth-scroll library (Lenis) | Avoid | Native scroll | Allowed when a scrub scene stutters on native wheel steps; `lerp` 0.10 to 0.15, `syncTouch: false`; never change scroll distance or speed `[source: Lenis]` |
| Sound | Off | No `AudioContext` until a visible toggle is pressed | Opt-in toggle in the header, state persisted, muted under reduced motion |
| Loading or preloader | None | Progressive: first scene renders from HTML and CSS | Assets over 2 MB: a preloader showing true loaded bytes or frames; never a timer, never a fake percentage |

### 3.3 Reduced motion: what each technique degrades to

Apply on `prefers-reduced-motion: reduce` and expose the same switch as an in-page toggle. `[source: WCAG 2.2 SC 2.3.3; Apple HIG Motion; house]`

| Technique | Degrades to |
|---|---|
| `view()` and `scroll()` animations, text reveals | `animation: none`; element and text in their end state at first paint |
| Pinned section | Not pinned: the states are laid out as a vertical stack, each with its sentence |
| Image sequence or scrubbed video | One poster frame (the last or most legible frame), `<img>` with alt text |
| Horizontal gallery | Vertical stack of the panels |
| Parallax | Layers at their rest position; no movement |
| Hero set piece | Still interactive on direct input (drag, key); no autonomous or scroll-linked movement |
| View transitions | Root cross-fade at `--dur-2` stays; group movement off |
| Magnetic buttons, Lenis, sound | Disabled, not initialised, muted (toggle still visible) |
| Preloader | Progress kept (it is information); no animation on the bar beyond the fill |

## 4. Rules

Storytelling
1. One idea per scene. If a scene needs two sentences to explain what it shows, it is two scenes or one too many; two scenes with the same sentence are one scene. `[house]`
2. Scene count 3 to 7, one per message in the copy deck. Under 3 is a hero, over 7 is a film; the web is neither. Extra messages become a static section after the last scene. `[house]`
3. Message first: every scene row on the plan has a sentence the user should take away, written before the technique is chosen. Technique serves sentence. `[house]`
4. The static test: remove every animation and the page must still read top to bottom as a complete, well-composed site. The scene plan's fallback column is that page. `[house; source: WCAG 2.2 SC 2.3.3]`
5. The user is the playhead. Scroll position maps to story position and nothing else; scroll-jacking (changing the distance, speed or direction of a scroll gesture, or scrolling on the user's behalf) is forbidden in every form. `[house]`
6. Scenes do not repeat a technique back to back. Two pinned scenes in a row read as one long pin. `[house]`

Scroll-driven technique
7. CSS scroll timelines before JS. `animation-timeline` runs off the main thread when the animated property is transform, opacity or clip-path; a JS scroll handler never does. `[source: Bramus, Chrome 2023; Chrome scroll animation performance case study 2024]`
8. Every scroll-driven block sits inside `@supports (animation-timeline: view())`. Outside it, the element is in its end state. `[source: MDN scroll-driven animations]`
9. Pinned scenes: the container's height is the scroll distance; the stage is `position: sticky; top: 0; height: 100vh`. Never `position: fixed` plus a scroll listener. `[house]`
10. Image sequences: 48 to 96 frames, under 20 kB each at 1280 px, total under 2 MB or a progress-true preloader is required; a 640 px set for mobile; all frames preloaded before the scene can pin; `drawImage` only when the frame index changes; canvas at device pixels, capped at 1920 by 1080. `[source: CSS-Tricks 2020; house]`
11. Horizontal travel is driven by the document's vertical scroll through a transform on the timeline. A `wheel` listener that calls `preventDefault()` or writes `scrollLeft` is scroll-jacking and is forbidden. `[house]`
12. Parallax: max 3 layers, ratios 0.15, 0.30 and 0.50, travel at most 24 vh, never on text or on anything the user reads or clicks. `[house]`
13. Text reveals split by word, never by letter below 24 px; the heading stays one string for assistive tech (inline spans, no `aria-hidden` duplicates). Per-letter splitting rasterises, breaks screen readers and breaks find-in-page. `[house]`
14. One interactive idea per hero. The rest of the hero is still: otherkind.design pairs a live-editable vector wordmark with a single 8 px fade-in and nothing else moving; aveen.co pairs one scrubbed object with static type. Borrow the mechanism (one object, direct manipulation, silence around it), not the look. `[source: otherkind.design 2026; aveen.co 2026]`
15. three.js only when `concept.md` names 3D as the idea and the whole 150 kB JS budget can go to it. A tree-shaken scene lands at 90 to 130 kB gzipped, so nothing else on the page may be JS-heavy. WebGL shaders are a no by default; one fragment shader on one surface is the escape hatch and needs a `WEBGL_lose_context` fallback image. `[house]`
16. Cursor followers, custom cursors and trails are forbidden. Magnetic buttons only on `(hover: hover) and (pointer: fine)`, displacement capped at 8 px, off under reduced motion. `[house]`
17. Page transitions: View Transitions API, root cross-fade `--dur-2`; shared-element on exactly one element; non-supporting browsers navigate instantly. `[source: MDN View Transitions API]`
18. Lenis is off by default. When a scrub scene demands it: `lerp` 0.10 to 0.15, `smoothWheel: true`, `syncTouch: false`, never `duration` or wheel multipliers; scroll distance per wheel notch stays native; not initialised under reduced motion. `[source: Lenis; house]`
19. Sound is opt-in behind a visible control; autoplay with sound never. `[source: WCAG 2.2 SC 1.4.2; house]`
20. Preloaders exist only when assets exceed 2 MB, show true progress and dismiss within 200 ms of completion. A timed preloader is a defect. `[house]`

Budgets
21. Creative layer JS at most 150 kB gzipped, measured as everything not required by the product itself (libraries, scene controllers, frame loaders). `[house]`
22. LCP at most 2.5 s, INP at most 200 ms, CLS 0, on the test device over a throttled 4G profile. The LCP element is the first scene's poster or heading, present in HTML. `[source: web.dev LCP, INP, CLS]`
23. 60 fps while scrolling every scene and no long animation frame over 50 ms while scrubbing, on a Moto G Power class Android (Snapdragon 6xx, 4 GB) or at 4x CPU throttle in Chrome; measured with the long-frame observer in `../motion/PLAYBOOK.md` section 5. `[source: Chrome LoAF; house]`
24. Reserve every scene's height in CSS (`height`, `aspect-ratio`) before assets load; sequences and video get an explicit box. `[source: web.dev CLS]`

Accessibility
25. Every scene is readable with reduced motion: static composition, no pinning, all copy visible (3.3). `[source: WCAG 2.2 SC 2.3.3; Apple HIG Motion]`
26. Keyboard reaches every control: set-piece handles, sound toggle, gallery panels (focusing a panel scrolls the document to its range). `[source: WCAG 2.2 SC 2.1.1]`
27. Anything that moves for more than 5 s on its own (a loop in a set piece) has a pause control. `[source: WCAG 2.2 SC 2.2.2]`
28. Content available without JS: headings, copy, poster images and links render from HTML; canvas and 3D are enhancements over an `<img>` or text. Canvas text never carries content. `[house]`

## 5. Defaults

View-timeline reveal and page progress (the floor for every scene):

```css
@supports (animation-timeline: view()) {
  .scene-figure { animation: figure-in linear both; animation-timeline: view(); animation-range: entry 0% cover 40%; }
  .progress { transform-origin: 0 50%; animation: grow linear both; animation-timeline: scroll(root); }
}
@keyframes figure-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) { .scene-figure, .progress { animation: none; } }
```

Pinned scene with three states on a named timeline; each `.step` carries its own sentence:

```html
<section class="pin-scene"><div class="pin-stage">
  <div class="step" data-step="1"><h2>Sentence one.</h2></div> <div class="step" data-step="2"><h2>Sentence two.</h2></div> <div class="step" data-step="3"><h2>Sentence three.</h2></div>
</div></section>
```

```css
.pin-scene { --scenes: 3; } .step { min-height: 60vh; display: grid; place-items: center; }  /* base: stacked fallback */
@supports (animation-timeline: view()) { @media (prefers-reduced-motion: no-preference) {
  .pin-scene { height: calc(var(--scenes) * 100vh); view-timeline-name: --scene; }
  .pin-stage { position: sticky; top: 0; height: 100vh; overflow: hidden; }
  .step { position: absolute; inset: 0; min-height: 0; opacity: 0; animation: step linear both; animation-timeline: --scene; }
  .step[data-step="1"] { animation-range: contain 0% contain 33%; }
  .step[data-step="2"] { animation-range: contain 33% contain 66%; }
  .step[data-step="3"] { animation-range: contain 66% contain 100%; }
} }
@keyframes step { 0%, 100% { opacity: 0; } 15%, 85% { opacity: 1; } }
```

Scrubbed image sequence inside a `.pin-scene` (frames preloaded, progress-true bar, poster under reduced motion):

```html
<section class="pin-scene seq"><div class="pin-stage">
  <img class="poster" src="/frames/095.webp" alt="The lamp fully assembled" width="1280" height="720"> <canvas class="scrub" width="1280" height="720" aria-hidden="true"></canvas>
  <div class="loader" role="progressbar" aria-valuemin="0" aria-valuemax="96" aria-valuenow="0"><i></i></div>
</div></section>
```

```js
const scene = document.querySelector('.seq'), canvas = scene.querySelector('.scrub'), ctx = canvas.getContext('2d'), bar = scene.querySelector('.loader');
const COUNT = 96, frames = [], src = i => `/frames/${String(i).padStart(3, '0')}.webp`;
let loaded = 0, last = -1;
function draw() {
  const r = scene.getBoundingClientRect(), p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight))), i = Math.round(p * (COUNT - 1));
  if (i !== last && frames[i]) { ctx.drawImage(frames[i], 0, 0, canvas.width, canvas.height); last = i; }
}
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) Promise.all(Array.from({ length: COUNT }, (_, i) => new Promise(resolve => {
  const im = new Image(); im.onload = () => { frames[i] = im; loaded++; bar.setAttribute('aria-valuenow', loaded); bar.firstElementChild.style.transform = `scaleX(${loaded / COUNT})`; resolve(); }; im.onerror = resolve; im.src = src(i);
}))).then(() => { scene.classList.add('is-ready'); draw(); addEventListener('scroll', () => requestAnimationFrame(draw), { passive: true }); });
```

```css
.seq .scrub, .seq .loader { display: none; } .seq.is-ready .scrub { display: block; width: 100%; height: 100%; object-fit: cover; }
.seq.is-ready .poster { display: none; } .seq .loader i { display: block; height: 2px; transform-origin: 0 50%; transform: scaleX(0); transition: transform 100ms linear; }
```

Show `.loader` (`display: block`) only when the frame set exceeds 2 MB; `.poster` is the LCP element and the reduced-motion and no-JS state.

Horizontal gallery as the escape hatch (vertical scroll drives the track; no wheel listener):

```css
.rail-scene { --panels: 4; }  /* base: panels stack vertically */
@supports (animation-timeline: view()) { @media (prefers-reduced-motion: no-preference) {
  .rail-scene { height: calc(var(--panels) * 100vh); view-timeline-name: --rail; }
  .rail-stage { position: sticky; top: 0; height: 100vh; overflow: hidden; }
  .rail-track { display: flex; width: max-content; height: 100%; animation: rail linear both; animation-timeline: --rail; animation-range: contain 0% contain 100%; }
  .rail-track > * { width: 80vw; flex: none; }  /* 20 vw of the next panel peeks: the affordance */
} }
@keyframes rail { to { transform: translateX(calc(-100% + 100vw)); } }
```

Parallax, three layers, never on text:

```css
@supports (animation-timeline: view()) {
  .plx [data-depth] { animation: plx linear both; animation-timeline: view(); animation-range: cover 0% cover 100%; }
  .plx [data-depth="back"] { --d: 0.15; } .plx [data-depth="mid"] { --d: 0.30; } .plx [data-depth="front"] { --d: 0.50; }
}
@keyframes plx { from { transform: translateY(calc(var(--d) * 24vh)); } to { transform: translateY(calc(var(--d) * -24vh)); } }
@media (prefers-reduced-motion: reduce) { .plx [data-depth] { animation: none; } }
```

Text reveal by word (words wrapped at build time; heading stays one string):

```html
<h1 class="words"><span style="--i:0">One</span> <span style="--i:1">idea</span> <span style="--i:2">per</span> <span style="--i:3">scene.</span></h1>
```

```css
.words span { display: inline-block; animation: word var(--dur-4) var(--ease-out) both; animation-delay: calc(var(--i) * 40ms); }
@keyframes word { from { opacity: 0; transform: translateY(0.4em); } }
@media (prefers-reduced-motion: reduce) { .words span { animation: none; } }
```

Hero set piece, the mechanism behind a live-editable bezier wordmark (drag or arrow keys move the control points; nothing moves on its own):

```html
<svg class="mark" viewBox="0 0 400 200" aria-label="Studio wordmark, editable curve">
  <path d="M20 160 C 120 20, 280 20, 380 160" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
  <circle class="h" data-i="0" cx="120" cy="20" r="10" tabindex="0" aria-label="Control point 1"/> <circle class="h" data-i="1" cx="280" cy="20" r="10" tabindex="0" aria-label="Control point 2"/>
</svg>
```

```js
const svg = document.querySelector('.mark'), path = svg.querySelector('path'), pts = [[120, 20], [280, 20]];
const redraw = () => path.setAttribute('d', `M20 160 C ${pts[0].join(' ')}, ${pts[1].join(' ')}, 380 160`);
const place = (h, x, y) => { pts[h.dataset.i] = [x, y]; h.setAttribute('cx', x); h.setAttribute('cy', y); redraw(); };
svg.querySelectorAll('.h').forEach(h => {
  h.addEventListener('pointerdown', e => {
    h.setPointerCapture(e.pointerId);
    const move = ev => { const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.getScreenCTM().inverse()); place(h, p.x, p.y); };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', () => h.removeEventListener('pointermove', move), { once: true });
  });
  h.addEventListener('keydown', e => { const d = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[e.key]; if (!d) return; e.preventDefault(); const p = pts[h.dataset.i]; place(h, p[0] + d[0], p[1] + d[1]); });
});
```

Magnetic button (pointer devices only, 8 px cap):

```js
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelectorAll('.magnet').forEach(b => {
  b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; b.style.transform = `translate(${x * 16}px, ${y * 16}px)`; });
  b.addEventListener('pointerleave', () => { b.style.transform = ''; });
});
```

CSS: `.magnet { transition: transform var(--dur-2) var(--ease-out); }`.

Page transitions (cross-document; one shared element at most):

```css
@view-transition { navigation: auto; }
::view-transition-old(root), ::view-transition-new(root) { animation-duration: var(--dur-2); animation-timing-function: var(--ease-out); }
.work-cover[data-active] { view-transition-name: cover; }  /* exactly one element per page carries a name */
::view-transition-group(cover) { animation-duration: var(--dur-3); animation-timing-function: var(--ease-in-out); }
@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation-duration: 0s; } ::view-transition-old(root), ::view-transition-new(root) { animation-duration: var(--dur-2); } }
```

Lenis, only when 3.2 allows it (`npm i lenis`; smoothing only, native distance):

```js
import Lenis from 'lenis';
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, syncTouch: false }); const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
```

Long-frame check during a scrub: use the observer in `../motion/PLAYBOOK.md` section 5 while scrolling each scene end to end at 4x CPU throttle; any `long frame` line over 50 ms fails rule 23.

## 6. Anti-patterns

| Slop | Fix |
|---|---|
| Scroll hijack: wheel listeners with `preventDefault()`, snap-to-scene, auto-advancing scenes | Native scroll; timelines from `view()` and `scroll()`; the user is the playhead (rules 5, 11) |
| 12-second preloader, timed or fake percentage | No preloader under 2 MB; above it, true bytes or frames, dismissed within 200 ms of completion |
| Parallax on body text or headings | Parallax on figure layers only; text sits still (rule 12) |
| Animating everything on view: cards, footer, nav, icons all `view()` | One reveal per scene on the element that carries the sentence; everything else present at first paint |
| Generic reveal-on-scroll fade-up on every element | Delete the utility class; keep one figure reveal per scene; the copy is visible immediately |
| Horizontal scroll without affordance | Vertical stack; or the rail escape hatch with a peeking next panel and a progress bar |
| Canvas text (unselectable, unfindable, unreadable by assistive tech) | Text is DOM text layered over the canvas; canvas carries imagery only |
| 3D blobs, floating gradient spheres, metaballs | Cut; they say nothing. If 3D stays, it is the product or the idea, named in `concept.md` |
| Particle backgrounds, constellation networks, floating dots | Cut; replace with one still composition and the space the layout desk gives it |
| "Made with GSAP" template look: pin, stagger, fade-up, pin, counter, marquee | Start from the copy deck; one technique per sentence; no technique twice in a row (rule 6) |
| Cursor followers, custom cursors, trails, blend-mode circles | Native cursor; magnetic buttons at most (rule 16) |
| Scenes that need JS to show their copy | Copy in HTML, enhanced by CSS timelines; JS only for canvas and set pieces (rule 28) |

## 7. Hand-off artefact

`scene-plan.md`, consumed by layout, typography, motion, engineering and QA. Line one is the go/no-go answer with the row that decided it.

```
# Scene plan: <site>

Creative: <yes (full, n scenes) | yes (hero set piece only) | no (reason: 3.1 row)>
One idea (from concept.md): <one line>
Test device: Moto G Power class Android, Chrome, 4x CPU throttle, throttled 4G.

| # | Scene | Scroll range | Pinned or flowing | What changes | What the user learns (one sentence) | Technique (3.2 row) | Fallback (reduced motion and no JS) |
|---|---|---|---|---|---|---|---|
| 1 | Hero | 0 to 100 vh | flowing | Wordmark curve responds to drag | <sentence> | Hero set piece | Static wordmark, still draggable on input |
| 2 | <name> | 100 to 400 vh | pinned (3 states) | <figure state 1 to 3> | <sentence> | Pinned section | Three stacked figures with captions |
| 3 | <name> | 400 to 500 vh | flowing | <figure enters> | <sentence> | view() reveal | Figure present at first paint |

## Budget
- Creative JS: <n> kB gzipped of 150 (list each file). Scene assets: <n> MB of 2; preloader: <none | progress-true>.
- LCP element: <selector>, in HTML; target 2.5 s. INP target 200 ms. CLS 0 (reserved heights listed per scene). No frame over 50 ms during scrub at 4x CPU throttle.

## Set piece
<Object, the one interaction, input methods (pointer, keyboard), behaviour under reduced motion, cost.>

## Not doing
<Techniques considered and rejected, one line each with the rule or table row.>
```

Any non-scrubbed duration inside a scene (a step crossfade, a set-piece return) also goes on `motion-spec.md` from `templates/motion-spec.md` as a normal row with tokens.

## 8. Checklist

- [ ] Go/no-go table answered row by row; the answer and deciding row are line one of the scene plan.
- [ ] Scene count is 3 to 7 (or hero only); each scene has one sentence written before its technique.
- [ ] The page reads as a complete static site with every animation removed (rule 4).
- [ ] Every scroll-driven block is CSS `view()` or `scroll()` inside `@supports`; JS only for canvas or the set piece.
- [ ] No `wheel` listener with `preventDefault()`, no `scrollTo` on the user's behalf, no auto-advance.
- [ ] Pinned scenes hold at most 4 states; no two pinned scenes are adjacent. Frame sequences: 48 to 96 frames, under 2 MB, 640 px set on mobile, poster is the LCP element.
- [ ] Parallax: at most 3 layers, ratios 0.15 / 0.30 / 0.50, none on text. Text reveals split by word, none per-letter under 24 px, heading is one string.
- [ ] One interactive idea in the hero; it works by keyboard; nothing else in the hero moves.
- [ ] No cursor followers; magnetic buttons only on pointer devices, 8 px max. View transitions: root cross-fade `--dur-2`, at most one shared element.
- [ ] Lenis absent, or `lerp` only and off under reduced motion. Sound off until a visible toggle. Preloader absent under 2 MB, progress-true above.
- [ ] Creative JS at most 150 kB gzipped; LCP at most 2.5 s; INP at most 200 ms; CLS 0; no frame over 50 ms during scrub at 4x throttle.
- [ ] Reduced motion: every scene matches its row in 3.3; the in-page toggle sets the same state. Content, copy and posters render with JS disabled.

## 9. Sources

- MDN, CSS scroll-driven animations (`animation-timeline`, `view()`, `scroll()`, `animation-range`, named view timelines) https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations ; `animation-timeline` https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
- Bramus Van Damme, Chrome for Developers, Animate elements on scroll with scroll-driven animations (2023) https://developer.chrome.com/docs/css-ui/scroll-driven-animations ; demos and tooling https://scroll-driven-animations.style/ ; Chrome, Scroll-driven animations performance case study (2024) https://developer.chrome.com/blog/scroll-animation-performance-case-study
- MDN, View Transitions API https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API ; Using the View Transition API https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using
- web.dev, Largest Contentful Paint https://web.dev/articles/lcp ; Interaction to Next Paint https://web.dev/articles/inp ; Cumulative Layout Shift https://web.dev/articles/cls ; Chrome for Developers, Long Animation Frames API https://developer.chrome.com/docs/web-platform/long-animation-frames
- W3C WCAG 2.2, SC 2.3.3 Animation from Interactions https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions ; SC 2.2.2 Pause, Stop, Hide https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide ; SC 1.4.2 Audio Control https://www.w3.org/WAI/WCAG22/Understanding/audio-control ; SC 2.1.1 Keyboard https://www.w3.org/WAI/WCAG22/Understanding/keyboard
- Apple Human Interface Guidelines, Motion https://developer.apple.com/design/human-interface-guidelines/motion
- Lenis smooth scroll (darkroom.engineering), options `lerp`, `smoothWheel`, `syncTouch` https://github.com/darkroomengineering/lenis
- GSAP ScrollTrigger documentation (reference for pinning and scrub semantics; not the default) https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- CSS-Tricks, Let's make one of those fancy scrolling animations used on Apple product pages (canvas image sequence, 2020) https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/ ; Codrops, scroll-driven tutorials https://tympanus.net/codrops/tag/scroll/ ; Awwwards, scroll animation collection https://www.awwwards.com/awwwards/collections/scroll-animation/
- otherkind.design (one interactive idea in the hero: a live-editable vector wordmark; silence elsewhere) https://otherkind.design ; aveen.co (one scrubbed object against static type) https://aveen.co
