---
name: engineering
description: Owns how the design is built so it renders fast, stable and accessible on the cheapest device in the brief - CSS architecture and cascade layers, token plumbing (tokens.css as the only source of values, theme switching, what the measuring scripts read), font loading (self-hosted subsets, metric-matched fallbacks, preload), performance budgets (LCP, INP, CLS, TBT, JS weight, images), rendering cost of design decisions, compositor-friendly motion, accessibility implementation, responsive units, SVG delivery and build hygiene. The front desk calls this desk at run-sheet step 3 (system) to wire tokens and fonts, at step 4 (build) to review rendering cost, and whenever any desk proposes a decision with a rendering cost (fonts, blur, filters, scroll-driven work, canvas). Hands an engineering sheet (budgets, font manifest, cost log) to QA.
---

# Engineering: CSS architecture, tokens, fonts, budgets, accessibility

This desk turns the other desks' decisions into CSS and markup that hold up on a 2019 mid-range Android over 4G. It owns no aesthetic decision: sizes come from layout, faces from typography, values from colour, timings from motion. It owns how those values are stored, loaded, cascaded, animated and measured. Measurement of the finished build belongs to `../qa/PLAYBOOK.md` section 4.9; this desk sets the budgets QA measures against. `[house]`

## 1. When the front desk calls this desk

- Run-sheet step 3 (system): `tokens.css` is drafted; this desk wires it (layer order, theme switch, script-readable names) and writes the font-loading block. Step 4 (build): review every component for literal values, layout-animating properties and rendering cost before QA captures. `[house]`
- Whenever any desk proposes a decision with a rendering cost: a new font family or weight, `backdrop-filter`, `filter`, a scroll-driven scene, canvas or WebGL, a large SVG filter, a video hero (front desk rule, `../../SKILL.md` section 2); and whenever QA's performance pass (`../qa/PLAYBOOK.md` 4.9) fails a floor. `[house]`
- Not called for: choosing a typeface (`../typography/PLAYBOOK.md`), a colour value (`../colour/PLAYBOOK.md`), a duration (`../motion/PLAYBOOK.md`), or whether a creative treatment is right at all (`../creative-web/PLAYBOOK.md`).

## 2. Inputs required

| Artefact | From | Must contain |
|---|---|---|
| `brief.md` | strategy | Device and network floor, framework, performance budget if the client named one, accessibility target (default WCAG 2.2 AA), locales (decides subsets) |
| `tokens.css` | layout, typography, colour, motion | `--space-*`, `--r-*`, `--fs-*`, `--lh-*`, `--font-*`, colour roles with ratios, `--dur-1` to `--dur-4`, `--ease-*`, `--z-*` |
| Type roles and families | typography | At most 2 families, the weights and styles actually used per role, `opsz` or `wght` axes if variable |
| `motion-spec.md` and the concept kill list | motion, creative-web, direction | Every animated property, so this desk can reject anything outside transform, opacity, clip-path; effects banned upstream are not re-argued here |

Stop condition: no `@font-face` is written until typography has named the weights per role, and no component CSS is reviewed until `tokens.css` carries the scales `../../scripts/measure.mjs` reads (section 3.2). `[house]`

## 3. Decisions this desk owns

### 3.1 CSS architecture

| Situation | Default | Escape hatch |
|---|---|---|
| Where tokens live | `:root` in `tokens.css`, inside `@layer tokens` | An app shell element (`.app`) when several apps share one document; scripts resolve both |
| Cascade order | One declaration, first line of the entry stylesheet: `@layer tokens, base, components, utilities;` `[source: CSSWG Cascade 5]` | Add `vendor` before `base` when a third-party sheet must be overridden without specificity games |
| How components are styled | One class per component, states via pseudo-classes and data attributes (`.btn`, `.btn:focus-visible`, `.btn[data-size="lg"]`) | Utilities for one-off layout glue only (`.stack`, `.cluster`), never for colour or type |
| Tailwind | Acceptable only when the project already runs it; every utility must resolve to a token through `@theme inline` (section 5); no arbitrary values (`p-[13px]`) | New project with no Tailwind: do not add it |
| Inline styles | None. Dynamic values go on a custom property set from JS (`style="--progress: 0.4"`) and are read by a class | - |
| Specificity and stacking | Flat: one class, at most one pseudo-class; no ids, no `!important`; `z-index` only from `--z-content`, `--z-control`, `--z-overlay`, `--z-toast`, with `isolation: isolate` on the parent | `!important` only inside `@layer utilities` for `.visually-hidden` |

### 3.2 Token plumbing

| Situation | Default | Escape hatch |
|---|---|---|
| Source of values | `../../templates/tokens.css` filled in; nothing outside it declares a size, colour, duration or easing | A one-line justified literal with a comment beside it, counted by QA |
| Theme switching | `[data-theme="light"]` and `[data-theme="dark"]` on `html`, plus `color-scheme: light dark` on `:root` so form controls and scrollbars follow `[source: MDN color-scheme]` | Class-based theming only when the framework forces it (`next-themes` writes `data-theme` when told to) |
| No stored preference | `@media (prefers-color-scheme: dark)` applies the dark block to `:root:not([data-theme])` | - |
| Names the scripts read | `--space-N`, `--r-N` (or `--radius-N`), `--fs-N` in px or rem; `--dur-N` in ms or s; `--ease-*` as `cubic-bezier()` or `linear()`; declared in a same-origin stylesheet, not set by JS alone | Aliases are fine (`--radius-card: var(--r-3)`) as long as the base scale keeps the names |
| Where a component needs a new value | Add a token to `tokens.css` with a one-line reason, then use it | - |

`measure.mjs` and `motion-audit.mjs` walk `document.styleSheets`, collect every `--*` declaration and resolve it on the first element the rule matches, falling back to `:root`. Cross-origin stylesheets are skipped, so tokens on a CDN are invisible to QA; serve `tokens.css` from the same origin. `[source: scripts/measure.mjs; scripts/motion-audit.mjs]`

### 3.3 Font loading

| Situation | Default | Escape hatch |
|---|---|---|
| Where fonts come from | Self-hosted via `@fontsource/<family>` (npm), imported from the project's `fonts.css`, latin subset only | Hand-cut woff2 subsets with `pyftsubset` when the family is not on Fontsource |
| How many | At most 2 families, at most 4 files total on the critical path `[source: web.dev font best practices]` | A third file for a display italic used above the fold |
| Weights | 3 or more weights of one family: one variable file (`@fontsource-variable/<family>`, `font-weight: 100 900`) | 1 to 2 weights: static files, one per weight |
| Subsets | `unicode-range` per script; ship only the scripts in the brief's locales | Add `latin-ext` for names with diacritics |
| `font-display` | `swap` for body and headings, paired with a metric-matched fallback (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`) so the swap moves nothing `[source: MDN size-adjust; web.dev font best practices]` | `optional` for a display face that only decorates; it then never swaps in late |
| Preload | Exactly one `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the body regular (or the variable file) | Add the display face only when it renders the LCP element |
| System fallback | `ui-sans-serif, system-ui, sans-serif` after the metric-matched fallback in the stack | - |

### 3.4 Performance budgets

Budgets apply at the p75 on a 4x CPU slowdown, 4G throttle, 390 px viewport. QA measures them (`../qa/PLAYBOOK.md` 4.9); this desk sets them and signs off exceptions. `[source: web.dev Core Web Vitals]`

| Metric | Marketing or brand page | Product UI (app) | Escape hatch |
|---|---|---|---|
| LCP | 2.5 s | 2.5 s | None; the LCP element is an image or heading, never a video poster fetched late |
| INP | 200 ms, aim 100 | 200 ms, aim 100 | - |
| CLS | 0.1 | 0 (skeletons hold size) | - |
| TBT (lab) | 200 ms | 200 ms | - |
| JS, gzipped, on first view | 150 kB | 250 kB, route-split | Over budget needs a written line in the engineering sheet |
| CSS, gzipped | 50 kB | 80 kB | - |
| Fonts, total transferred | 200 kB | 200 kB | - |
| Images | AVIF with WebP fallback via `<picture>`; `width` and `height` set; `loading="lazy"` below the fold; `fetchpriority="high"` and no lazy on the hero; `sizes` matches the layout | JPEG only for photographs with an unfixable AVIF encoder gap |
| Long animation frames | 0 at or above 50 ms at idle and on reaction; at most 2 during load | - |

### 3.5 Responsive units

| Situation | Default | Escape hatch |
|---|---|---|
| Type size | `rem` (tokens `--fs-*`) | - |
| Hairlines, borders, radii, shadows | `px` (tokens `--r-*`, `1px`) | - |
| Space | `px` tokens (`--space-*`); a 4 px rhythm does not need to scale with root font size | `em` inside a component that must scale with its own text (an icon beside a label) |
| Full-height sections | `min-height: 100dvh` for content that may scroll, `100svh` for a fixed hero, never `100vh` on mobile `[source: MDN viewport units]` | - |
| Component layout switches | Container queries: `container-type: inline-size` on the component root, `@container (min-width: 32rem)` `[source: MDN container queries]` | Media queries for page-level layout (grid columns, nav collapse) only |
| Fluid type or space | `clamp(var(--fs-5), 4vw + 1rem, var(--fs-7))`: both ends are tokens | - |
| Fixed pixel widths | Never on containers; `max-width: var(--measure)` for text, `min()` for stages | - |

### 3.6 SVG delivery

| Situation | Default | Escape hatch |
|---|---|---|
| Icons that take the text colour | Inline `<svg>` with `fill="currentColor"` or `stroke="currentColor"`, `aria-hidden="true"`, `width` and `height` set | - |
| An icon set (8 or more) | One sprite, `<svg><use href="/icons.svg#name">`, same origin | Inline the 3 icons above the fold |
| Illustrations, marks over 4 kB | `<img src="x.svg" width height alt>`; the browser caches it and it cannot leak styles | Inline only when it animates by CSS or must recolour |
| Stroke icons | `stroke-width` 1.5 at 24 px `viewBox`, `vector-effect="non-scaling-stroke"` off (strokes scale with the icon), `stroke-linecap="round"` matches the set | 2 at 16 px `viewBox` |
| `viewBox` and filters | `viewBox` always present with `width` and `height` matching the rendered size (no layout shift); filter region limited with `x y width height` on `<filter>`; no `feGaussianBlur` over more than 200 by 200 px | - |

Path hygiene, optical correction and the icon grid belong to `../illustration/PLAYBOOK.md`; this desk only decides the delivery method and the file budget.

### 3.7 Rendering cost review

Read across for any effect another desk proposes. Cost is per frame on a low-end device; "high" means it does not ship without a measured long-frame count from QA. `[source: web.dev rendering performance; Chrome compositor-only properties]`

| Decision | Cost | Why | Cheaper substitute |
|---|---|---|---|
| `backdrop-filter: blur()` over scrolling content | High | Re-blurs every frame the content behind moves | Semi-opaque `--surface` at 0.92 alpha; blur only on a static overlay, at most 1 per screen |
| `filter: blur()` or `drop-shadow()` on animated or large elements | High | Repaints the blurred bitmap every frame | Pre-blurred PNG or radial gradient; `box-shadow` on a static element |
| Animated `box-shadow` | High | Paint on every frame, large bleed area | Animate `opacity` of a `::after` that carries the final shadow |
| Gradient over 50 percent of the viewport | Medium (static), High (animated) | Paints once if static, every frame if `background-position` moves | Keep it static; to animate, move an oversized gradient layer with `transform` or fade between two layers |
| `mix-blend-mode` over a large area | Medium to high | Forces group rasterisation and isolates layers | `opacity` or a pre-blended colour token |
| `will-change` on many elements | Medium | Every layer costs memory; on low-end GPUs layers get evicted | Apply just before the animation in JS, remove after; never in a static rule |
| Scroll-driven animation | Low (CSS `animation-timeline`, transform or opacity), High (JS `scroll` listener) | Compositor-driven versus main thread per scroll event | CSS `animation-timeline: scroll()` or `IntersectionObserver`; layout properties on scroll are banned |
| Canvas 2D full-viewport | Medium to high | Main-thread draw each frame | Cap at 30 fps, draw only the dirty region, pause when off-screen |
| WebGL or 3D | High | GPU and battery; 1 to 3 MB of JS | Pre-rendered video with `poster`, or a static image on `(prefers-reduced-motion)` and low-end devices |
| SVG filter over more than 200 by 200 px | High | Software-rasterised per frame in most engines | Bake to PNG; limit the filter region |
| `100vh` hero on mobile | Medium (CLS) | Address bar changes cause a re-layout and a jump | `100svh` or `100dvh` |
| Video hero | Medium | Decoding and bandwidth | `preload="metadata"`, `poster`, `muted playsinline`, one 720p AV1 or H.264 file under 2 MB |

### 3.8 Consult engineering when

- Typography wants a third weight, a second family or an italic above the fold (file count and preload).
- Direction or colour wants glass, blur, grain, noise or blend modes (cost table); illustration wants an animated SVG filter, a mascot over 30 kB or an icon set inlined.
- Motion or creative-web wants a scroll-driven scene, a pinned section, canvas, WebGL or any animation on a property other than transform, opacity or clip-path.
- Layout wants full-height sections, a fixed header over content, or a component that changes shape by container width.
- Interaction wants a hover effect that reveals content or a skeleton whose size differs from the final layout.
- Any desk wants a literal value that is not in `tokens.css`. `[house]`

## 4. Rules

Architecture and tokens
1. Declare `@layer tokens, base, components, utilities;` once, before any import; every rule lives in exactly one layer. `[source: CSSWG Cascade 5; MDN @layer]`
2. Component CSS reads tokens only; a literal size, colour, duration or easing outside `tokens.css` needs a one-line comment with the reason, and QA counts them. `[house]`
3. `:root` carries `color-scheme: light dark`; `[data-theme]` overrides; `prefers-color-scheme` applies only when no `data-theme` is set. `[source: MDN color-scheme; house]`
4. No `!important` outside `@layer utilities`; no `z-index` outside the four `--z-*` tokens; no ids in selectors. `[house]`
5. Tailwind, where present, maps every colour, radius, spacing and font token through `@theme inline`; arbitrary values are a review failure. `[source: Tailwind v4 theme docs; house]`

Fonts
6. Self-host; no font CDN. A third-party host adds a connection and a cross-origin swap the metric override cannot cover. At most 2 families and 4 files on the critical path; 3 or more weights means one variable file. `[source: web.dev font best practices; house]`
7. Every `@font-face` with `font-display: swap` has a sibling fallback face with `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override` computed for the family (fontaine or Capsize); the swap moves no line. `[source: MDN size-adjust, ascent-override; web.dev font best practices]`
8. Preload exactly one file, the body regular or the variable file, with `crossorigin` even when same-origin; subset with `unicode-range` to the scripts the brief's locales need. `[source: web.dev font best practices; Fontsource docs]`

Performance and low-end devices
9. Budgets in 3.4 are floors; an exception is a written line in the engineering sheet, never a verbal agreement. `[house]`
10. Every `<img>` and `<video>` carries `width` and `height`; the hero carries `fetchpriority="high"`; everything below the fold carries `loading="lazy"`. `[source: web.dev CLS; web.dev fetch priority]`
11. Animate only `transform`, `opacity` and `clip-path`; `height`, `width`, `top`, `left`, `margin`, `padding`, `box-shadow`, `filter` and `background-position` are never in a `transition` or `@keyframes`; `transition: all` is banned. `[source: Chrome compositor-only properties; web.dev animations guide; house]`
12. Long lists (over 50 items) and below-fold sections get `content-visibility: auto` with `contain-intrinsic-size`; independent widgets get `contain: layout paint` so a state change does not relayout the page. `[source: web.dev content-visibility; web.dev avoid large, complex layouts]`
13. `will-change` is set from JS immediately before an animation and removed after; it is never in a static stylesheet rule. `[source: MDN will-change]`
14. `backdrop-filter` and `filter: blur()` appear at most once per screen, on a static element, never over scrolling or animated content. `[house]`
15. No `scroll` event listeners for visual effects; use `animation-timeline` or `IntersectionObserver`. `[source: Chrome scroll-driven animations]`

Accessibility implementation
16. Semantic element first (`button`, `a[href]`, `nav`, `main`, `dialog`, `details`, `table`); ARIA only to fill a gap the element cannot; never `role="button"` on a `div`. `[source: WCAG 4.1.2; ARIA in HTML]`
17. Every focusable element shows a 2 px `--focus` ring with 2 px offset via `:focus-visible`; `outline: none` without a replacement fails review. `[source: WCAG 2.4.7]`
18. A skip link is the first focusable element on any page with a header; `main` carries `id="main"` and `tabindex="-1"`. `[source: WCAG 2.4.1; WebAIM]`
19. Every animation and transition is wrapped so `prefers-reduced-motion: reduce` sets the duration tokens to 0 ms, and any transform animation over 8 px has an opacity-only twin. `[source: MDN prefers-reduced-motion; house]`
20. `forced-colors: active` rules keep every state visible with system colours (`CanvasText`, `Highlight`, `ButtonText`), borders replacing shadows and fills as boundaries; `prefers-contrast: more` raises `--line` and `--text-2` to their AAA values. `[source: MDN forced-colors; MDN prefers-contrast; house]`
21. Targets are 44 by 44 px via `min-height` and `min-width` (or padding), not via margin. `[source: WCAG 2.5.8; house]`
22. Text spacing overrides (line-height 1.5, paragraph 2 em, letter 0.12 em, word 0.16 em) break nothing: no fixed heights on text containers. `[source: WCAG 1.4.12]`
23. Changing numerals use `font-variant-numeric: tabular-nums`; `<html lang>` is set and matches the copy, with inline `lang` on any foreign phrase. `[source: MDN font-variant-numeric; WCAG 3.1.1; house]`
24. Every input has a `<label for>`; errors connect via `aria-describedby` and `aria-invalid`; live regions use `role="status"` (polite) except for a failed submit, which uses `role="alert"`. `[source: WCAG 3.3.1, 4.1.3]`

Build hygiene
25. One stylesheet per surface (app, marketing, admin); no unused CSS shipped (check with coverage in DevTools); source maps on in production for CSS and JS. `[house]`
26. `stylelint` with `stylelint-config-standard` runs in CI; the studio adds `declaration-no-important`, `selector-max-id: 0`, `selector-max-specificity: "0,2,0"`. `[source: stylelint]`

## 5. Defaults

```css
/* entry.css: the only place the layer order is declared. tokens.css is imported into its layer. */
@layer tokens, base, components, utilities;
@import url("./tokens.css") layer(tokens);

@layer tokens {
  :root { color-scheme: light dark; }
  /* Dark by system preference only when no explicit choice is stored. Values mirror [data-theme="dark"] in tokens.css. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) { --bg: oklch(0.17 0.008 var(--hue)); --surface: oklch(0.21 0.008 var(--hue)); --text: oklch(0.95 0.006 var(--hue)); }
  }
  @media (prefers-contrast: more) { :root { --line: var(--text-3); --text-2: var(--text); } }
}
@layer base {
  html { font-family: var(--font-sans); -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: var(--bg); color: var(--text); line-height: var(--lh-body); }
  img, video { max-width: 100%; height: auto; display: block; }
  :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .skip-link { position: absolute; inset: var(--space-2) auto auto var(--space-2); z-index: var(--z-toast); translate: 0 -200%; }
  .skip-link:focus-visible { translate: 0 0; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .num { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  }
  @media (forced-colors: active) {
    .btn, .card, .field input { border: 1px solid ButtonText; box-shadow: none; }
    .btn[aria-pressed="true"], .tab[aria-selected="true"] { forced-color-adjust: none; background: Highlight; color: HighlightText; }
    :focus-visible { outline-color: Highlight; }
  }
}
@layer components {
  .hero { min-height: 100svh; } .control { min-height: 44px; min-width: 44px; }
  .card { container-type: inline-size; contain: layout paint; border-radius: var(--r-3); padding: var(--space-5); }
  @container (min-width: 32rem) { .card { display: grid; grid-template-columns: 1fr 2fr; gap: var(--space-5); } }
  .feed { content-visibility: auto; contain-intrinsic-size: auto 480px; }
  .btn { transition: background-color var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out); }
  .display { font-size: clamp(var(--fs-5), 4vw + 1rem, var(--fs-7)); }
}
```

```css
/* fonts.css: self-hosted via @fontsource (this repo: src/fonts.css, package.json). Latin subset, swap, metric-matched fallback.
   Open Runde ships 3 static weights; a family used at 3 or more weights moves to @fontsource-variable/<family> (one file, font-weight: 100 900). */
@font-face {
  font-family: 'Open Runde'; font-style: normal; font-weight: 500; font-display: swap;
  src: url('@fontsource/open-runde/files/open-runde-latin-500-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* Fallback face: Arial adjusted to the web font's metrics so the swap moves no line. Regenerate the four numbers per family
   with `npx fontaine` or Capsize; the ones below are for Inter-metric faces. */
@font-face {
  font-family: 'Open Runde Fallback'; src: local('Arial'), local('Liberation Sans'), local('Roboto');
  size-adjust: 107.12%; ascent-override: 90.44%; descent-override: 22.52%; line-gap-override: 0%;
}
/* Display voice: optional, so a late arrival never swaps in and reflows the headline. */
@font-face {
  font-family: 'Instrument Serif'; font-style: normal; font-weight: 400; font-display: optional;
  src: url('@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
:root {
  --font-sans: 'Open Runde', 'Open Runde Fallback', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Instrument Serif', Georgia, serif;
}
```

```html
<!-- head: one preload (body regular), crossorigin even when same-origin. With Vite, copy the file to public/fonts/ so the URL is stable. -->
<link rel="preload" href="/fonts/open-runde-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<picture>
  <source srcset="/img/hero.avif" type="image/avif">
  <img src="/img/hero.webp" width="1200" height="800" alt="" fetchpriority="high" decoding="async">
</picture>
<a class="skip-link" href="#main">Skip to content</a>
<main id="main" tabindex="-1"></main>
```

```css
/* Tailwind v4, only when the project already runs it: utilities resolve to tokens, never to Tailwind's own palette. */
@layer tokens, theme, base, components, utilities;
@import "tailwindcss";
@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-text: var(--text); --color-accent: var(--accent);
  --radius-2: var(--r-2); --radius-3: var(--r-3); --spacing-2: var(--space-2); --spacing-4: var(--space-4);
  --font-sans: var(--font-sans); --font-display: var(--font-display);
}
```

```js
// will-change only for the duration of the animation; durations and easings come from the same tokens motion-audit.mjs reads.
export function lift(el, keyframes, options) {
  const cs = getComputedStyle(el);
  el.style.willChange = 'transform, opacity';
  const anim = el.animate(keyframes, { duration: parseFloat(cs.getPropertyValue('--dur-3')), easing: cs.getPropertyValue('--ease-out').trim(), ...options });
  anim.finished.finally(() => { el.style.willChange = ''; });
  return anim;
}
```

```json
{ "extends": "stylelint-config-standard",
  "rules": { "declaration-no-important": true, "selector-max-id": 0, "selector-max-specificity": "0,2,0",
             "declaration-property-value-disallowed-list": { "transition": ["/all/"], "z-index": ["/^[0-9]{3,}$/"] } } }
```

## 6. Anti-patterns

| Slop | Fix |
|---|---|
| Literal values in component CSS (`padding: 13px`, `#333`, `250ms`) | Use the token; if none fits, add one to `tokens.css` with a reason. `../../scripts/measure.mjs` reports off-scale values |
| `!important` to win a fight | Move the rule to the right `@layer`; layers beat specificity |
| `z-index: 9999` | One of the four `--z-*` tokens plus `isolation: isolate` on the parent |
| CDN fonts with a flash of unstyled text | Self-host via `@fontsource`, `swap` with the metric-matched fallback face, preload the body regular |
| Blur or `backdrop-filter` over animated or scrolling content | Semi-opaque `--surface`; blur only on one static overlay per screen |
| JS for hover states (`mouseenter` toggling classes) | `:hover` inside `@media (hover: hover)`, with a `:focus-visible` twin |
| `<div onclick>` as a button | `<button type="button">`; free keyboard, focus, name and role |
| `outline: none` with nothing in its place | `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }` |
| `100vh` heroes on mobile | `100svh` for a fixed hero, `100dvh` for scrolling content |
| Animating `box-shadow` or `height` | Shadow: fade a `::after` that carries the final shadow. Height: `grid-template-rows: 0fr` to `1fr`, or `clip-path` |
| `transition: all` | Name the properties: `transition: transform var(--dur-1) var(--ease-out), opacity var(--dur-1) var(--ease-out)` |
| Inline `style="color: #..."` or Tailwind arbitrary values (`text-[15px]`) | Class reading a token, or the token mapped in `@theme inline`; dynamic values through a custom property |

## 7. Hand-off artefact

One file, `engineering.md`, beside `tokens.css`. QA reads the budget table into its performance pass and the font manifest into its capture matrix (fonts loaded, no swap shift).

```markdown
# Engineering sheet: <project>
Owner: engineering. Consumed by: build, qa (4.9). Every exception is a row, not a conversation.

Layer order: tokens, base, components, utilities. Theme: html[data-theme], color-scheme light dark. Tokens origin: same-origin /assets/tokens.css.

| Budget (p75, 4x CPU, 4G, 390 px) | Target | Measured (qa 4.9) | Exception and reason |
|---|---|---|---|
| LCP / INP / CLS / TBT | 2.5 s / 200 ms / 0.1 / 200 ms | | |
| JS gzipped / CSS gzipped / fonts transferred | 150 kB / 50 kB / 200 kB | | |

| Font family | Role | Files | Weights | Subset | display | Fallback face | Preloaded |
|---|---|---|---|---|---|---|---|
| Open Runde | body, ui | 3 static woff2 | 500, 600, 700 | latin | swap | Arial, size-adjust 107.12% | 500 |
| Instrument Serif | display | 1 woff2 | 400 | latin | optional | Georgia | no |

| Rendering cost log: decision | Proposed by | Cost (3.7) | Verdict | Substitute or condition |
|---|---|---|---|---|
| Glass nav with backdrop-filter | direction | High | Allowed | Static header only, 1 per screen, off under (prefers-reduced-transparency) |

| Justified literal: file:line | Value | Reason |
|---|---|---|
```

## 8. Checklist

- [ ] `@layer tokens, base, components, utilities;` is the first line of the entry stylesheet; every rule is inside a layer; no `!important` outside utilities; no `z-index` outside `--z-*`.
- [ ] `tokens.css` is same-origin and declares `--space-*`, `--r-*`, `--fs-*`, `--dur-*`, `--ease-*` on `:root` or the app shell; `../../scripts/measure.mjs` prints the scales it read, not the fallbacks; no literal outside it without a comment.
- [ ] `color-scheme: light dark` on `:root`; `[data-theme]` switches; `prefers-color-scheme` applies only without a stored choice.
- [ ] At most 2 families, 4 files; body regular preloaded once; every `swap` face has a metric-matched fallback; display face is `optional`.
- [ ] Every animated property is `transform`, `opacity` or `clip-path`; no `transition: all`; `will-change` only from JS; at most one blur or `backdrop-filter` per screen, static; cost log has a row per effect from 3.7.
- [ ] Hero image has `width`, `height`, `fetchpriority="high"`, AVIF or WebP; below-fold images are lazy.
- [ ] `100svh` or `100dvh`, never `100vh`; components switch by `@container`; `clamp()` has tokens at both ends.
- [ ] Skip link first, `:focus-visible` ring everywhere, reduced-motion wrapper present, forced-colors rules present, `lang` set, labels and errors associated, 44 px targets via `min-height` and `min-width`.
- [ ] Icons inline with `currentColor` or a same-origin sprite; illustrations as `<img>` with dimensions.
- [ ] `stylelint` passes; one stylesheet per surface; source maps on; `engineering.md` filled with budgets, manifest and cost log.

## 9. Sources

- MDN. @layer https://developer.mozilla.org/en-US/docs/Web/CSS/@layer ; W3C CSS Working Group. CSS Cascading and Inheritance Level 5: Cascade layers https://www.w3.org/TR/css-cascade-5/#layering
- MDN. @font-face https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face ; size-adjust https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust ; ascent-override https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/ascent-override ; font-display https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display ; unicode-range https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range
- web.dev. Best practices for fonts https://web.dev/articles/font-best-practices ; Fontsource documentation https://fontsource.org/docs/getting-started/introduction ; unjs fontaine (metric-matched fallbacks) https://github.com/unjs/fontaine ; Capsize https://seek-oss.github.io/capsize/
- web.dev. Cumulative Layout Shift https://web.dev/articles/cls ; Interaction to Next Paint https://web.dev/articles/inp ; Largest Contentful Paint https://web.dev/articles/lcp ; Total Blocking Time https://web.dev/articles/tbt ; Fetch Priority API https://web.dev/articles/fetch-priority
- web.dev. content-visibility https://web.dev/articles/content-visibility ; Avoid large, complex layouts and layout thrashing https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing
- web.dev (Chrome team). Rendering performance https://web.dev/articles/rendering-performance ; Stick to compositor-only properties and manage layer count https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count ; How to create high-performance CSS animations https://web.dev/articles/animations-guide
- Chrome for Developers. Scroll-driven animations https://developer.chrome.com/docs/css-ui/scroll-driven-animations ; Analyze runtime performance https://developer.chrome.com/docs/devtools/performance
- W3C (2023). WCAG 2.2 Understanding 2.4.7 Focus Visible https://www.w3.org/WAI/WCAG22/Understanding/focus-visible ; 2.5.8 Target Size (Minimum) https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum ; 1.4.12 Text Spacing https://www.w3.org/WAI/WCAG22/Understanding/text-spacing ; 4.1.2 Name, Role, Value https://www.w3.org/WAI/WCAG22/Understanding/name-role-value ; 2.4.1 Bypass Blocks https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks ; 3.1.1 Language of Page https://www.w3.org/WAI/WCAG22/Understanding/language-of-page ; 3.3.1 Error Identification https://www.w3.org/WAI/WCAG22/Understanding/error-identification ; 4.1.3 Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages
- W3C. ARIA in HTML https://www.w3.org/TR/html-aria/ ; WebAIM. Skip navigation links https://webaim.org/techniques/skipnav/
- MDN. prefers-reduced-motion https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion ; forced-colors https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors ; prefers-contrast https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast ; color-scheme https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
- MDN. CSS container queries https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries ; viewport units (dvh, svh, lvh) https://developer.mozilla.org/en-US/docs/Web/CSS/length#relative_length_units_based_on_viewport ; will-change https://developer.mozilla.org/en-US/docs/Web/CSS/will-change ; font-variant-numeric https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric ; contain https://developer.mozilla.org/en-US/docs/Web/CSS/contain
- Tailwind CSS v4. Theme variables and @theme inline https://tailwindcss.com/docs/theme ; stylelint https://stylelint.io/ ; stylelint-config-standard https://github.com/stylelint/stylelint-config-standard
