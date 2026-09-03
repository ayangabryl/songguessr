---
name: layout
description: Decides the spacing scale, radius system and concentricity, alignment, flex versus grid, composition device per region, vertical rhythm and max widths, touch targets, responsive and density strategy, state layouts and the content-versus-control layer map, then measures the rendered DOM to prove it. The front desk calls this desk for every build (step 3 System, step 4 Build), for section selection on marketing sites (references/sections.md), and whenever spacing, padding or corners look off or a review finds off-scale values.
---

# Layout

Layout is the part of design users never name and always feel. Every gap, inset and corner comes from a scale, every edge lands on an axis, and every claim is measured on the rendered DOM, not eyeballed in a comp. Paths are relative to the atelier root. `[source: ...]` is traceable to section 9; `[house]` is a studio rule that the brief may override.

## 1. When the front desk calls this desk

- Run sheet step 3 (System): this desk owns the space, radius and layer tokens in `templates/tokens.css`. Stop condition: every value is on a scale.
- Run sheet step 4 (Build): compose screens from tokens only; every off-scale value carries a one-line reason. Stop condition: 390, 768 and 1440 wide render without overflow or scroll jump.
- Marketing, brand or portfolio jobs: choose section variants from `references/sections.md`; present the next variant when the client rejects one.
- Review or audit: capture at 1440, 1024 and 390 wide, run the measure snippet (section 5) or `scripts/measure.mjs`, report `selector: property = value (nearest token)`.
- Any desk that reports "feels off": this desk answers with a number or closes the finding. `[house]`

## 2. Inputs required

- `brief.md` with the primary task in one sentence; it decides what sits in the control layer (section 4.6).
- `concept.md` with the one idea and the chosen direction; the direction fixes the shape language (capsule or role-mapped radii).
- Type roles from typography (font sizes drive padding, section 4.2) and the density expectation from strategy (pointer-heavy tool or touch product).
- For section work: the content inventory (which sections exist, how many items each holds).

## 3. Decisions this desk owns

### 3.1 Composition device by content type `[house; measure from Bringhurst; list mechanism from otherkind.design, 2026]`

| Content | Default | Escape hatch |
|---|---|---|
| Reading (article, docs, long copy) | One column, measure 60 to 72 ch (`--measure: 64ch`), left-aligned, page margin `--space-4` at 390 wide | A second column only for a persistent table of contents at 64 rem or wider; the prose column keeps its measure |
| Scanning a list (engagements, changelog, posts) | One column of rows, label left, meta right-aligned (`justify-content: space-between`), row padding-block `--space-1` to `--space-2`, as otherkind.design's engagements list | Card list when each item carries an image or more than two fields |
| Comparing (plans, products, options) | Grid of equal cards, 3 across at most, `repeat(auto-fit, minmax(min(100%, 18rem), 1fr))`, gap `--space-5` | Comparison table when items have more than 5 attributes |
| A tool (editor, console, dashboard) | App shell: fixed rail 15 to 17.5 rem plus fluid canvas, `grid-template-columns: 16rem minmax(0, 1fr)` | Top bar plus one column when there are fewer than 5 destinations |
| A stage or hero object (mascot, product, demo) | Centred stage at 40 to 55 percent of viewport height, controls floating beneath in the control layer | Split copy and object at 64 rem or wider when the copy exceeds 2 display lines |

### 3.2 Radius by role `[house; capsules and concentricity from Apple WWDC25 323 and 356]`

| Token | px | Use for | Why |
|---|---|---|---|
| `--r-0` | 0 | Full-bleed surfaces, table cells, dividers, anything touching a viewport edge, editorial images | A radius against a hard edge reads as a mistake |
| `--r-1` | 6 | Checkboxes, chips, code spans, tags, focus ring on square controls, small thumbnails | Below 6 px a radius is a softening, not a shape |
| `--r-2` | 12 | Inputs, buttons, list-row hover, menu items, popovers, segmented track (non-capsule system) | Matches 12 px control padding; concentric inside `--r-3` at 8 px inset |
| `--r-3` | 20 | Cards, panels, modals on mobile, stage shapes | Container scale; 20 − 8 = 12 keeps nested controls on the scale |
| `--r-4` | 28 | Sheets, desktop dialogs, hero images, the stage | Page-scale objects; 28 − 8 = 20 |
| `--r-pill` | 999 | Every interactive control in a capsule system; circles for icon buttons | iOS 26 default for bordered buttons; reads as touchable |

Default: one shape language per product. Either role-mapped (`--r-1`, `--r-2`, `--r-3`, `--r-pill` for circles only) or capsule (`--r-pill` for all controls, `--r-3` and `--r-4` for containers). Escape hatch: none; mixing is a finding.

### 3.3 Flex versus grid `[source: MDN CSS layout; house heuristics]`

| Situation | Use | Why |
|---|---|---|
| One row or column of siblings sized by content (toolbar, chip row, button group) | `flex` | 1D; `gap` and `align-items` are all you need |
| Two axes that must line up (label and field pairs; a transport with button, meter and numeral sharing a baseline) | `grid` | Rows and columns defined once; children snap to both |
| Named regions that reflow at breakpoints | `grid-template-areas` | One declaration per breakpoint; no nesting, no order hacks |
| Card grid that wraps by available width | `grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr))` | Intrinsic; `min(100%, ...)` prevents overflow below 16 rem |
| Children of different parents must align (row columns across cards) | `grid` plus `subgrid` on the child | Children inherit the parent's tracks |
| Component adapts to its container, not the viewport | `container-type: inline-size` plus `@container (min-width: 32rem)` | The same card works in a sidebar and a main column |
| Centre one thing in both axes | `display: grid; place-items: center` | One line, no margin auto dance |
| Equal-width segments (segmented control) | `grid-auto-flow: column; grid-auto-columns: 1fr` | `flex: 1` breaks when one label wraps |
| Content-driven width with a floor and ceiling | `grid-template-columns: minmax(12rem, 1fr) 3fr` | `minmax` is the only sane "at least, at most" |
| Overlapping layers (mascot over stage, badge over avatar) | `grid` with every child in `grid-area: 1 / 1` | No `position: absolute`, participates in layout, no z-index escalation |

Signals you chose wrong: three nested flex wrappers to align two things (use grid); `margin-left: auto` twice (a smell); `width: calc(33.333% - 16px)` (use `gap`); `position: absolute` for anything with a layout relationship to siblings. `[house]`

### 3.4 Density `[source: Material density; house multipliers]`

| Situation | Default | Escape hatch |
|---|---|---|
| Touch product or mixed input | `--density: 0`; control height 44 px | `+1` (comfortable, 48 px) for reading-heavy or older audiences |
| Pointer-only tool with many rows | `--density: -1` (compact, 40 px) | Never compact on `(pointer: coarse)`; force 0 or +1 there |

Control height = `44px + 4px × density`; vertical padding and list-row padding move one scale step; radius, region gaps and type size do not change. Density is space, not text.

Lists the user scans (feeds, results, tables, indexes) are measured in items above the fold, and the brief carries the baseline (strategy). Defaults: a single-line row is `--space-2` padding over line-height, so 36 to 40 px at 14 to 16 px type on pointer and 44 px on touch; a two-line row (title plus meta) is 56 to 64 px; the row, not each word in it, is the target. Inter-row separation is a hairline or one `--space-2`, never a `--space-6` band. Row count above the fold at 1440x900 and 390x844 must be at least the baseline in the brief; measure with `scripts/measure.mjs --count=<row selector> --count-min=<baseline>`. `[house]`

## 4. Rules

### 4.1 Spacing scale

1. Base 4 px, structural unit 8 px. Both divide every common viewport and density (1×, 1.5×, 2×, 3×) into whole device pixels; 8 dp is the Material layout grid and 4 dp its component grid; halving and doubling stay on-scale. `[source: Material spacing methods; Material 3 grids and spacing]`
2. Token roles. `[house]`

| Token | px | Use it for | Do not use it for |
|---|---|---|---|
| `--space-1` | 4 | Icon-to-label gap inside a control, hairline insets, meter segments | Anything between two separate components |
| `--space-2` | 8 | Inline gaps between siblings (chips, segments), padding-block of compact controls | Section spacing |
| `--space-3` | 12 | Padding-block of default controls, label-to-field gap, list-row padding-block | Page margins |
| `--space-4` | 16 | Default component padding, gap between related components, mobile page margin | Gaps within one control |
| `--space-5` | 24 | Card and panel padding, gap between groups inside a section, desktop gutter | Inline gaps |
| `--space-6` | 32 | Gap between sections of one screen region, desktop panel padding | Inside controls |
| `--space-7` | 48 | Gap between regions (top bar, stage, transport), hero breathing | Anything inside a component |
| `--space-8` | 64 | Section rhythm on mobile, page padding-block on desktop | Inside a region |
| `--space-9` | 96 | Section rhythm on desktop, stage top offset on tall viewports | Product screens |

3. Small inside, large between: gap between groups at least 2× the gap within a group; gap between regions at least 2× the gap between groups. 8, 16, 48 reads without a single border. Proximity is the strongest grouping cue and overpowers similarity and colour. `[source: NN/g proximity; Refactoring UI, more space around a group than within it]`
4. The largest gap on a screen is its vertical rhythm. A card whose padding exceeds the gap between cards has inverted hierarchy. `[house]`
5. Never fix alignment with an off-scale value (13, 18, 22 px); fix the component that produced the misalignment. Adjacent scale steps differ by at least 25 percent, which is why the scale is not linear. `[source: Refactoring UI]`
6. Odd steps (12, 24, 48) are for padding and rhythm; doublings (8, 16, 32, 64) are for gaps. Mixing is fine; each usage maps to one token. A marketing hero-to-fold gap of 128 px needs `--space-10: 128px` added to the token sheet with a reason, never a literal. `[house]`
7. Vertical rhythm: section gaps `--space-9` (96 px) on desktop and `--space-8` (64 px) on mobile; group gaps `--space-5` to `--space-6` (24 to 32 px); element gaps `--space-2` to `--space-4` (8 to 16 px). `[house]`
8. Max widths: prose `--measure` (64 ch); marketing pages 75 to 80 rem (1200 to 1280 px) centred; app shells fluid to 90 rem (1440 px), then centred. `[house; Bringhurst for the measure]`

### 4.2 Padding versus margin; padding grows with radius and font size

9. `gap` on the parent for spacing between siblings; `padding` for the inside of a container; `margin` only for one-off document flow (prose). Never padding on the child and gap on the parent for the same visual space. `[house]`
10. Outside ≥ padding ≥ inner gap: a container's padding is at least the gap between its children (24 padding, 16 gap) and the margin around it at least its padding (32 margin, 24 padding). `[house]`
11. Horizontal control padding is 1.5 to 2× vertical (12/20, 8/16); equal padding makes a text button a square with words in it. Icon-only controls use equal padding. `[source: Refactoring UI; house ratio]`
12. Vertical padding of a text control ≈ 0.5 to 0.75× font size (16 px text: 8 to 12 px); horizontal ≈ 1.0 to 1.5×. `[house, after Refactoring UI]`
13. Rounded rectangles keep `padding-inline ≥ radius × 0.75` or text runs into the curve; capsules keep `padding-inline ≥ height / 2` so the label sits in the straight section. `[house]`
14. When a component has sizes, scale padding and radius with the font size from the same scales: sm 13 px / 8×12 / `--r-1`; md 16 px / 12×20 / `--r-2`; lg 18 px / 16×28 / `--r-3`. Never 8 px padding on a 20 px label. `[house]`

### 4.3 Radius, concentricity and corner faults

15. Bordered buttons are capsules by default on iOS 26; small and mini controls on macOS stay rounded rectangles for density. Interactive = capsule, container = rounded rectangle with a large radius. `[source: WWDC25 323]`
16. Concentricity: a nested shape shares its container's corner centre, so `inner radius = outer radius − distance from the container's edge`. A button at the bottom of a sheet shares the sheet's corner centre. SwiftUI: `.rect(corner: .containerConcentric)`; if the inset exceeds the outer radius the inner corner becomes 0, so set a minimum. `[source: WWDC25 323 and 356; nilcoalescing ConcentricRectangle]`
17. Pinched: inner radius too small for its inset (6 px corner inside a 20 px card at 8 px padding); the gap looks thin at the corner and thick along the edge. Fix: inner = 20 − 8 = 12. Flared: inner radius ≥ outer (a 20 px child inside a 20 px card); the child appears to bulge. Same fix. `[house]`
18. A 1 px border wrapping a filled child: the child's radius is `outer − 1px`, or the fill peeks through as a lighter halo. `[house]`
19. Radius ≥ height / 2 is a capsule whether you meant it or not: commit to `--r-pill` or keep radius ≤ 40 percent of height. `border-radius: 50%` only on squares; on rectangles it makes ellipses. `[house]`
20. Radius carries personality: none reads formal, small neutral, large playful. Choose once in the concept; stay consistent. `[source: Refactoring UI]`

### 4.4 Alignment

21. Four kinds; name the one in use per axis. Edge (shared left, right or top edge; default for text and lists). Centre (shared axis; short display lines, single-focus stages, icon buttons). Optical (adjusted by shape so it looks aligned; icons, punctuation, circles beside squares). Baseline (mixed type sizes share a baseline, not box centres). `[source: Bjango; Marvel]`
22. One primary alignment axis per column. A centred stage above a left-aligned form is two axes and needs a visible reason (a full-width divider or a background change). `[house]`
23. Baseline alignment of mixed sizes: `align-items: baseline`, or `text-box-trim: trim-both; text-box-edge: cap alphabetic` where supported. Without it, offset by `(line-height − cap-height) / 2` per size using scale values. `[source: CSS Inline Layout 3]`
24. Icon beside label: centre on the cap height, not the line box; with `line-height: 1.5` a box-centred icon sits about 2 px low. Set icon height to cap height + 20 percent with `line-height: 1` on the label, or use the baseline method. `[house]`
25. Optical corrections: play triangles shift toward the point by 3 to 6 percent of the icon width (1 px at 24 px); arrows shift against their direction; circles draw about 10 percent larger than squares to match weight. Align by centroid, not bounding box. `[source: Bjango; adamarant]`
26. Line-height in px is a multiple of 4 (24 for 16 px, 28 for 18 px, 40 for 32 px); block margins are multiples of the body line-height so baselines re-synchronise after every block. `[source: Bringhurst]`
27. Text against an edge aligns by glyph, not box; round glyphs and quotes hang 1 to 2 px outside (`hanging-punctuation: first` where supported). `[house]`

### 4.5 Composition devices

28. Single column: reading column 640 to 720 px (about 66 ch at 16 to 18 px); product single-column screens 560 to 720 px, but the figure and primary control scale to the viewport, not the column. Page margin 16 px at 390 wide, 24 at 768, 32 or more at 1024, then the column caps and centres. Write it as `width: min(100% - 2 * var(--space-4), 40rem); margin-inline: auto;`, not a media query. `[source: Bringhurst; house]`
29. Grids: 8 pt grid for everything spatial; 12 columns with 24 px gutters at 1024 and wider, 8 columns at 768, 4 columns with 16 px gutters below 600. Columns align regions; do not force a 5-segment control into 12 columns. Fixed-width rails beat percentage columns for sidebars. `[source: Material layout grid; Refactoring UI, grids are overrated; house]`
30. Stage and hero: the stage object takes 40 to 55 percent of viewport height; the whole group (figure, headline, primary control) 55 to 70 percent above the fold on desktop and 60 to 75 percent on mobile. Figure ≥ 30 percent of viewport height and ≥ 40 percent of column width; headline within one line-height of the figure's ground line; primary control within 48 px below the headline. Sizes from `clamp()`, not breakpoints. `[house]`
31. Stage shape (disc, arch, rounded rectangle in `--surface-2`) is one flat shape sized so the figure overlaps its edge by 10 to 20 percent: never fully inside, never floating free. `[house]`

### 4.6 The two layers from iOS 26 `[source: HIG Materials; WWDC25 219 and 356]`

32. Content layer (`--z-content`): what the user came for. Stage, mascot, headline, results, lists, media. Solid or tonal surfaces only. Scrolls.
33. Control layer (`--z-control`): navigation and controls that persist while content changes. Top bar, mode switch, transport, toasts. Floats with its own inset (`--space-3` from edges on mobile, `--space-4` on desktop), large radius or capsule.
34. Glass (backdrop blur) only on the control layer, only when content scrolls beneath it, with a `prefers-reduced-transparency` fallback to a solid surface. Never glass on content, never glass on glass; a control on a glass bar is a solid fill or tint. If nothing scrolls under the bar it does not need glass.
35. Controls morph in place between states (the same capsule grows to hold different items); content transitions beneath. Anchor positions of the control layer do not move between states.

### 4.7 Touch and pointer targets

| Standard | Size | Spacing | Source |
|---|---|---|---|
| Apple HIG | 44×44 pt default, 28×28 pt minimum; macOS 28 default, 20 minimum | About 12 pt around bezelled, 24 pt around unbezelled elements | HIG Accessibility, Buttons |
| Material 3 | 48×48 dp | ≥ 8 dp between targets | m3.material.io |
| WCAG 2.2 SC 2.5.8 (AA) | 24×24 CSS px, or an undersized target whose 24 px circle meets no other target or circle | Circle test; inline text links exempt | W3C |
| Studio rule | 44×44 CSS px on touch, 32×32 on pointer-only; the visual may be smaller | ≥ 8 px between targets; ≥ 16 px between a destructive and a frequent target | `[house]` |

35b. Targets are controls: buttons, icon buttons, toggles, inputs, standalone action links, and whole list rows or cards. Inline links inside running text or a meta line (author, domain, "165 comments" in a sentence) are exempt under WCAG 2.2 SC 2.5.8's inline exception and stay at line height; padding them to 44 px is the fastest way to destroy the density a scanning brief asks for. Give a list row one primary target (the row or its title as a block with a 44 px hit area on touch) and leave secondary inline links alone; `scripts/measure.mjs` counts inline text links separately and does not fail them. `[source: WCAG 2.2 2.5.8; house]`
36. Grow the hit area, never shrink the visual: `position: relative; &::before { content: ""; position: absolute; inset: calc((44px - 100%) / 2); }` or `min-block-size: 44px; display: inline-grid; place-items: center`. Five segments at 390 px minus 32 px margin = 71 px each, fine; eight would be 44 px with no spacing, so eight segments need a different control. `[house]`

### 4.8 Responsive

37. Mobile first: the 390 px layout is the default; `min-width` queries add room, not elements. `[house]`
38. Breakpoints by content, not device: add one where the layout breaks (measure over 75 ch, a control row wraps, a target drops below 44 px) and name it by what happens (`--bp-two-column: 52rem`). Typical result 2 to 3 breakpoints: 40, 64, 90 rem. `[house]`
39. Prefer intrinsic layout (`auto-fit` plus `minmax`, `flex-wrap` with rem `flex-basis`, `clamp()`, container queries); reach for a media query only to rearrange regions. `[house]`
40. Fluid values with `clamp()`: `slope = (max − min) / (vmax − vmin)`, `intercept = min − slope × vmin`, then `clamp(min, intercept + slope × 100vw, max)` with min and max in rem. 32 to 56 px between 390 and 1280 px: `clamp(2rem, 1.34rem + 2.7vw, 3.5rem)`. Body text stays 16 to 18 px; display type and section spacing are fluid. Never `vw` alone. `[source: Utopia; WCAG 1.4.4]`
41. Test at 320 px wide (WCAG 1.4.10 reflow) and 200 percent zoom: no horizontal scroll, no overlap. A single-screen app fits 390×664 with `100dvh`, never `100vh`. `[source: WCAG 2.2; house]`

### 4.9 Empty, loading and error layout `[house; NN/g response times; UX Tigers progress indicators; web.dev CLS]`

42. Reserve the space: every state renders in the same box as the populated state (same min-height, same anchors for figure, headline and primary control). Diff two states; anchors move 0 px.
43. Skeletons match final dimensions (text lines at line-height with 60 to 90 percent widths; media via `aspect-ratio`). One shimmer or none, period ≤ 1.5 s. Show no indicator for the first ~1 s; once shown, hold ≥ 0.5 s.
44. Empty state = the populated layout with one sentence and one action in the content slot, same alignment. Error lives where the failing content would be; a toast is for events unrelated to the current region.
45. Layout shift budget CLS < 0.1: `aspect-ratio` for media, `min-height` for async text, `font-display: optional` or size-adjusted fallbacks.

### 4.10 Z-index and stacking `[house; CSS stacking contexts]`

46. Four tokens by default: `--z-content: 0; --z-control: 10; --z-overlay: 20; --z-toast: 30`. Add `--z-sticky`, `--z-dialog`, `--z-tooltip` only with a reason; eight levels at most. `z-index: 9999` is a bug report.
47. Every positioned component with children sets `isolation: isolate`. Overlays render through a portal at the end of `body`. `transform`, `filter`, `opacity < 1`, `will-change`, `contain: paint` and `backdrop-filter` all create stacking contexts.
48. Modals use the top layer: `<dialog>.showModal()` and `popover` sit above every z-index without a number.
49. Focus order follows visual order: a floating control layer that comes last in the DOM tabs last; put it first and position it with grid areas, or manage focus explicitly.

## 5. Defaults

Layout's block of `templates/tokens.css` (space, radius, layers are already there) plus the derived tokens this desk adds:

```css
:root {
  --target: 44px;                                  /* touch; see pointer override */
  --gap-inline: var(--space-2);
  --gap-group: var(--space-4);
  --gap-region: var(--space-7);
  --gap-section: var(--space-8);                   /* 96 px on desktop, below */
  --pad-control: var(--space-3) var(--space-5);    /* block inline */
  --pad-container: var(--space-5);
  --column-max: 40rem;
  --page-max: 80rem;
  --page-margin: clamp(var(--space-4), 2.5vw, var(--space-6));
  --density: 0;
}
@media (pointer: fine) { :root { --target: 32px; } }
@media (min-width: 64rem) { :root { --gap-section: var(--space-9); } }
.control   { min-block-size: calc(var(--target) + 4px * var(--density)); padding: var(--pad-control); border-radius: var(--r-pill); }
.container { padding: var(--pad-container); border-radius: var(--r-3); }
.column    { width: min(100% - 2 * var(--page-margin), var(--column-max)); margin-inline: auto; }
```

Concentric corners:

```css
.card          { --r-outer: var(--r-3); --pad: var(--space-2); border-radius: var(--r-outer); padding: var(--pad); }
.card > .inner { border-radius: max(var(--r-1), calc(var(--r-outer) - var(--pad))); }   /* 20 − 8 = 12 */
.sheet         { --r-outer: var(--r-4); --pad: var(--space-3); border-radius: var(--r-outer); padding: var(--pad); }
.sheet .cta    { border-radius: max(var(--r-1), calc(var(--r-outer) - var(--pad))); }   /* 28 − 12 = 16 */
.dock          { --r-outer: var(--r-pill); --pad: var(--space-1); border-radius: var(--r-outer); padding: var(--pad); }
.dock > button { border-radius: min(var(--r-pill), calc(var(--r-outer) - var(--pad))); } /* stays a capsule */
```

A square image inside a capsule becomes a disc or the language breaks. `[house]`

Measure it. Paste into DevTools on the rendered page; edit `selectors` to the product's class names. It prints padding, gap, radius and size per selector, flags values off the 4 px scale, checks targets, and checks nested radii against the concentric rule.

```js
(() => {
  const SCALE = new Set([0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128]);
  const RADII = new Set([0, 6, 12, 20, 28, 999, 9999]);
  const selectors = ['header', 'nav a', 'main', '.card', '.card > *', 'button', 'input', '[role=tablist] > *'];
  const px = v => Math.round(parseFloat(v) || 0);
  const capsule = (r, el) => r >= Math.min(el.offsetWidth, el.offsetHeight) / 2;
  const MIN = matchMedia('(pointer: coarse)').matches ? 44 : 32;
  const rows = [];
  for (const sel of selectors) document.querySelectorAll(sel).forEach((el, i) => {
    const cs = getComputedStyle(el), b = el.getBoundingClientRect(), flags = [];
    const pad = ['Top', 'Right', 'Bottom', 'Left'].map(s => px(cs['padding' + s]));
    const gap = [px(cs.rowGap), px(cs.columnGap)], r = px(cs.borderTopLeftRadius);
    pad.forEach((p, k) => SCALE.has(p) || flags.push(`pad[${k}]=${p} off-scale`));
    gap.forEach((g, k) => SCALE.has(g) || flags.push(`gap[${k}]=${g} off-scale`));
    if (!RADII.has(r) && !capsule(r, el)) flags.push(`radius=${r} off-scale`);
    if (el.matches('a,button,input,select,textarea,[role=button],[tabindex]') && (b.width < MIN || b.height < MIN))
      flags.push(`target ${Math.round(b.width)}x${Math.round(b.height)} < ${MIN}`);
    const p = el.parentElement, pr = p && px(getComputedStyle(p).borderTopLeftRadius);
    if (pr && !capsule(pr, p)) {
      const pb = p.getBoundingClientRect(), inset = Math.round(Math.min(b.left - pb.left, b.top - pb.top));
      const want = Math.max(0, pr - inset);
      if (Math.abs(r - want) > 1 && !capsule(r, el)) flags.push(`radius ${r} not concentric (outer ${pr} − inset ${inset} = ${want})`);
    }
    rows.push({ sel: `${sel}${i ? `[${i}]` : ''}`, w: Math.round(b.width), h: Math.round(b.height),
                pad: pad.join('/'), gap: gap.join('/'), radius: r, flags: flags.join('; ') || 'ok' });
  });
  console.table(rows);
  for (const sel of ['header', 'nav', '.card', '[role=tablist]']) {   // sibling gaps should be one token, consistent
    const kids = [...(document.querySelector(sel)?.children ?? [])].map(k => k.getBoundingClientRect());
    const d = kids.slice(1).map((k, i) => Math.round(k.left - kids[i].right)).filter(n => n >= 0);
    if (d.length) console.log(sel, 'sibling gaps', d, new Set(d).size > 1 ? 'INCONSISTENT' : SCALE.has(d[0]) ? 'ok' : 'off-scale');
  }
})();
```

Read the output as a bug list. "off-scale" means fix the token, not the number. "not concentric" means apply rule 16. "INCONSISTENT" means siblings are spaced by margins instead of `gap`. Padding `1/6/1/6` on a button or `1/2/1/2` on an input is the user-agent default: the control was never styled, which is also a finding. `[house]`

## 6. Anti-patterns

- Raw numbers in component CSS (`padding: 13px 18px`, `border-radius: 10px`). Fix: the nearest token, or a new token with a reason.
- Every gap 16 px. Fix: 8 / 16 / 48 so grouping reads without borders (rule 3).
- Padding on children plus `gap` on the parent; margins on siblings instead of `gap`. Fix: rule 9.
- A rounded child with its parent's radius (flared) or a 6 px child in a 28 px parent (pinched). Fix: rule 16.
- Capsule buttons beside square inputs; a square avatar inside a capsule. Fix: one shape language (section 3.2).
- A radius on an element touching the viewport edge. Fix: `--r-0`.
- Icons centred on the line box; play triangles centred by bounding box. Fix: rules 24 and 25.
- Three nested flex wrappers to align two things. Fix: grid (section 3.3).
- Breakpoints named after devices and chosen before the layout broke. Fix: rule 38.
- `vw`-only font sizes; `100vh` on mobile; disabled zoom. Fix: rules 40 and 41.
- Glass on content, glass on glass, blur on a bar with nothing scrolling beneath. Fix: rule 34.
- A 44 px visual with a 20 px hit area. Fix: rule 36.
- Loading, empty or error states that shift the anchors. Fix: rule 42.
- `z-index: 9999`, or a stacking war won by a bigger number. Fix: rules 46 to 48.

## 7. Hand-off artefact

Layout spec, appended to `tokens.css` as comments and to the concept as a table. Consumed by typography, colour, interaction, engineering, qa.

| Region | Composition device (section 3.1) | Layer | Grid | Max width | Gaps (tokens) | Radius | Target |
|---|---|---|---|---|---|---|---|
| <top bar> | <control layer, floating capsule> | `--z-control` | `flex` | fluid | `--space-2` inline | `--r-pill` | 44 px |
| <stage> | <centred stage, 48 percent vh> | `--z-content` | `grid` 1 / 1 overlap | 40 rem | `--space-7` to transport | `--r-4` | n/a |

Plus: shape language (capsule or role-mapped), breakpoints named by what happens, density default, the measure output with zero flags at 390, 768 and 1440 wide, and for marketing jobs the chosen variant per section from `references/sections.md` with the next candidate named.

## 8. Checklist

1. Do all paddings, gaps and margins resolve to `--space-*` (measure output shows zero "off-scale")?
2. Is the group gap ≥ 2× the element gap, and the section gap the largest on screen (96 desktop / 64 mobile)?
3. Does horizontal control padding exceed vertical by 1.5 to 2× and scale with font size?
4. One shape language, and every nested radius = outer − inset (zero "not concentric")?
5. One primary alignment axis per column; mixed sizes on a baseline; icons on cap height; triangles nudged?
6. Grid wherever two axes align; `grid-template-areas` for region reflow?
7. Composition device per region matches the content type table (section 3.1)?
8. Max widths: prose 64 ch, marketing ≤ 80 rem, app fluid to 90 rem?
9. Targets ≥ 44×44 px on touch (32 on pointer) with ≥ 8 px between?
10. 390 px first; breakpoints at visible content breaks; `clamp()` with rem bounds; 320 px and 200 percent zoom hold?
11. Glass only on the floating control layer over scrolling content, with a solid fallback?
12. Loading, empty and error keep every anchor at 0 px shift?
13. Z-index tokens only, `isolation: isolate` on components, dialogs in the top layer?
14. Primary control in the control layer at the same position in every state?

## 9. Sources

- Apple HIG Layout (guides, safe areas, avoid full-width buttons): https://developer.apple.com/design/human-interface-guidelines/layout
- Apple HIG Accessibility (control sizes, 12 and 24 pt padding); Buttons (44×44 pt): https://developer.apple.com/design/human-interface-guidelines/accessibility ; https://developer.apple.com/design/human-interface-guidelines/buttons
- Apple HIG Materials (Liquid Glass on the control layer, not content): https://developer.apple.com/design/human-interface-guidelines/materials
- WWDC25 323 Build a SwiftUI app with the new design (capsule buttons, corner concentricity, containerConcentric): https://developer.apple.com/videos/play/wwdc2025/323/
- WWDC25 219 Meet Liquid Glass; 356 Get to know the new design system (fixed, capsule and concentric shapes): https://developer.apple.com/videos/play/wwdc2025/219/ ; https://developer.apple.com/videos/play/wwdc2025/356/
- ConcentricRectangle in SwiftUI (inner = container − distance; minimum): https://nilcoalescing.com/blog/ConcentricRectangleInSwiftUI
- Material 3 grids and spacing (4 dp base, 8 dp rhythm, grouping by proximity): https://m3.material.io/foundations/layout/grids-spacing/spacing
- Material spacing methods (8 dp grid, 4 dp component grid): https://m2.material.io/design/layout/spacing-methods.html
- Material 3 structure and accessibility (48 dp targets, 8 dp spacing): https://m3.material.io/foundations/designing/structure
- Refactoring UI (spacing scale, 25 percent rule, radius personality, grids are overrated): https://www.refactoringui.com/
- NN/g Gestalt proximity and similarity: https://www.nngroup.com/articles/gestalt-proximity/ ; https://www.nngroup.com/articles/gestalt-similarity/
- Interaction Design Foundation, Gestalt principles: https://www.interaction-design.org/literature/topics/gestalt-principles
- WCAG 2.2 SC 2.5.8 Target Size (Minimum); 1.4.4 Resize Text; 1.4.10 Reflow: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum ; https://www.w3.org/TR/WCAG22/
- Utopia, fluid type with clamp: https://utopia.fyi/blog/clamp/
- MDN CSS layout (flexbox, grid, subgrid, container queries): https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout
- CSS Inline Layout 3, text-box-trim and text-box-edge: https://drafts.csswg.org/css-inline-3/#text-box-trim
- Bjango, formulas for optical adjustments; Marvel, optical adjustment: https://bjango.com/articles/opticaladjustments/ ; https://marvelapp.com/blog/optical-adjustment-logic-vs-designers/
- adamarant, optical alignment in UI (3 to 6 percent shift, 1 px at 24 px): https://adamarant.com/en/blog/optical-alignment-in-ui-7-spacing-fixes-math-gets-wrong
- Bringhurst, Elements of Typographic Style (measure, vertical rhythm): https://webtypography.net/
- NN/g response time limits; UX Tigers progress indicators: https://www.nngroup.com/articles/response-times-3-important-limits/ ; https://www.uxtigers.com/post/progress-indicators
- web.dev Cumulative Layout Shift: https://web.dev/articles/cls
- otherkind.design (engagement list with right-aligned year; 2-up team grid, max 500 px, 24 px gap, 20 px radius, #F7F7F7 canvas; fetched 2026-09-03): https://otherkind.design/
