---
name: colour
description: Decides the base hue, builds the whole palette as OKLCH formulas of that one hue (canvas, surfaces, container, text ramp, hairline, accent, accent-strong, accent-ink, on-accent), hue-shifted neutrals, tonal elevation, the semantic set, multi-accent products and their ink, gradients, light and dark as two separate systems, contrast maths (WCAG 2.2 and APCA via scripts/contrast.py), gamut clipping, state colours with color-mix(), colour-vision checks and the colour proof table. The front desk calls this desk at run-sheet step 3 (System) for every job that sets or changes colour, and at step 4 (Build) to measure rendered pairs; it never picks type (typography) or writes shadows into components (layout, engineering).
---

# Colour desk

The colourist on the studio team. This desk turns the brief and the concept into one hue and a set of formulas, then proves every pair with a number. Values here are defaults; a rule in this file is the only thing that overrides them. `[source: ...]` is traceable to section 9; `[house]` is a studio rule.

## 1. When the front desk calls this desk

- Run-sheet step 3 (System): choose `--hue`, fill the colour block of `templates/tokens.css` for light and dark, measure every pair, write the colour proof (section 7).
- Run-sheet step 4 (Build): re-measure rendered pairs on the running page (text on container, on accent, on hovered fills, in both themes, in every variant).
- Any routing row that names "colour", any per-variant theming (levels, categories, tenants), any dark-mode job, any contrast finding from QA.
- Not called for: type roles and sizes (`../typography/PLAYBOOK.md`); shadow geometry and layer map (`../layout/PLAYBOOK.md`); token plumbing and `color-scheme` wiring (`../engineering/PLAYBOOK.md`).

## 2. Inputs required

| Artefact | From | What this desk reads from it |
|---|---|---|
| Intake card, lines 4 and 7 | front desk | Brand colours that must not change; the three tone words and the forbidden word |
| `brief.md` | strategy | Primary task (decides how loud the accent may be), device and context (OLED phones push dark-mode rules), accessibility target (default WCAG 2.2 AA) |
| `concept.md` | direction | The one idea and the chosen direction; the kill list (often names the current gradient or the purple) |
| Type spec | typography | Which roles are body, label and meta, so `--text`, `--text-2`, `--text-3` are measured at the right size |

Stop condition: no palette is written until the brand constraint (line 4) and the tone words (line 7) are on the card. `[house]`

## 3. Decisions this desk owns

### 3.1 Base hue

Take the brand hue if one exists (convert the brand hex with `python3 scripts/contrast.py "#hex"` and read the OKLCH hue back by trial, or use a browser `oklch()` conversion). If none exists, pick the row whose connotation matches the tone words. `[house]`

| OKLCH hue | Family | Connotes | Where it fails |
|---|---|---|---|
| 15 to 35 | Red, coral | Urgency, appetite, warmth, sport | Danger clash: the accent and the error state merge; clips above C 0.25 at L 0.62 |
| 40 to 75 | Orange, amber | Energy, craft, autumn, food | Cheap at high chroma; low gamut cap (C 0.145 at L 0.62) so it turns to mustard when darkened for ink |
| 80 to 110 | Yellow, ochre | Optimism, caution, signage | Cannot carry white ink at any L; dark ink only; reads as a warning state |
| 120 to 165 | Green | Growth, health, money, "go" | Success clash: move `--success` to 160 to 170 or add a glyph; mint (150 to 165) reads as a fintech template |
| 170 to 210 | Teal, cyan | Calm, medical, technical | Pale and thin at L above 0.8; low cap (C 0.11 at L 0.62) |
| 220 to 260 | Blue | Trust, software, finance | The default of every SaaS since 2012; needs a distinct neutral tint or it is a template |
| 265 to 300 | Indigo, violet | Creativity, premium, "AI" | The AI-slop hue of 2023 to 2026; only with a written reason in `concept.md` |
| 305 to 350 | Magenta, pink | Play, fashion, youth | Loud at large area; never above C 0.05 on a canvas |
| 350 to 15 | Crimson, rose | Luxury, editorial, food | Same danger clash as red; use L 0.35 or lower for a luxury voice |

Neutrals carry the same hue at low chroma (section 4.2). A brand with two hues keeps the calmer one as `--hue` and the other appears only as illustration or a single semantic role. `[house]`

### 3.2 How many accents

| Situation | Default | Escape hatch |
|---|---|---|
| Product UI, tool, dashboard | One accent: primary action, focus ring, active state, links. Nothing else | A second hue only as a semantic status colour (section 4.5), never as a second brand accent |
| Content that owns categories (levels, teams, tags) | One brand accent for chrome; per-item hues live on the item's container only (section 4.6) | Whole-screen retheme per variant (swap `--hue`) when the variant is the product's mode, as in a difficulty level |
| Marketing or brand site | One accent, area 10 percent or less of the screen | An analogous helper hue (30 degrees or less from `--hue`) for illustration only |
| Data visualisation | Sequential ramp of one hue by L; categorical from the Okabe-Ito set | Diverging ramp of two hues 180 degrees apart through a neutral midpoint |

### 3.3 Elevation and boundaries

| Situation | Light default | Dark default | Escape hatch |
|---|---|---|---|
| Group content without a control boundary | `--container` tone, no border | `--container` tone, no border | None: tone and hairline never sit on one element |
| Separate rows inside one surface | `--hairline` at L 0.90 (decorative, exempt from 3:1) | `--hairline` at L 0.30 | Whitespace of one `--space-4` instead |
| Boundary of a control (input, unselected segment, tappable card) | `--outline` at L 0.60, measured 3.75:1 on canvas | `--outline` at L 0.55, measured 3.97:1 | Fill the control with `--surface-2` and drop the outline when the fill itself measures 3:1 against its parent |
| Raised card or popover | `--surface` on `--canvas` plus one tinted shadow `0 1px 2px oklch(0.2 0.01 var(--hue) / 0.10), 0 4px 12px -4px oklch(0.2 0.01 var(--hue) / 0.16)` | Surface L raised 0.04 to 0.06 per level, no shadow | Dark: one contact shadow `0 1px 2px oklch(0 0 0 / 0.4)` under an overlay only |
| Overlay (dialog, sheet) | `--surface` plus scrim `oklch(0.1 0.01 var(--hue) / 0.5)` | `--surface-2` plus the same scrim | None |

### 3.4 Gradients

| Situation | Default | Escape hatch |
|---|---|---|
| Any UI surface, button, card, heading | None. Flat tone | A lit material (hero panel, stage disc) only: 2 stops, same hue, delta L 0.15 or less, delta C 0.02 or less; the darkest stop is what gets measured for text |
| Text | Never, at any size | None |
| Data (heatmap, progress) | Sequential ramp by L only | Diverging ramp per 3.2 |

## 4. Rules

### 4.1 Working in OKLCH

1. Every colour is `oklch(L C var(--hue))` or a fixed-hue semantic. L is perceptual lightness 0 to 1; two hues at equal L look equally bright, so one L gives one contrast behaviour across a hue sweep. `[source: Ottosson, 2020; Evil Martians, 2022]`
2. Chroma discipline by area: canvas C 0.004 or less, surfaces 0.002 to 0.016, containers 0.04 to 0.06, accents 0.12 to 0.16, semantic fills in the same band as the accent. Large area, low chroma; small area, high chroma. `[house]`
3. Gamut cap per L (sRGB, measured with `scripts/contrast.py`): at L 0.52 the largest in-gamut C is 0.21 at hue 25, 0.12 at hue 60, 0.105 at hue 90, 0.145 at hue 150, 0.105 at hue 230, 0.275 at hue 280; at L 0.72 it is 0.17 (25), 0.17 (60), 0.145 (90), 0.195 (150), 0.14 (230), 0.145 (280); at L 0.93 it is 0.035 (25), 0.04 (60), 0.12 (150), 0.04 (230). A formula whose C exceeds the cap clips and the family drifts. The script prints `(clipped to gamut)`; a clipped token is a fail. Cap C with `min()` per hue or lower the shared C. `[source: Ottosson, 2020; house, measured]`
4. 60-30-10: canvas and surfaces about 60 percent of the screen, containers and secondary surfaces about 30, accent 10 or less. Count accent pixels on a capture if in doubt. `[source: 60-30-10 convention; house threshold]`

### 4.2 Neutrals

5. Hue-shifted neutrals, never pure grey. Every neutral carries C 0.004 to 0.02 of `--hue`; canvas 0.004, text 0.012, hairline 0.010. Pure grey beside a tinted accent reads as the complement (simultaneous contrast) and looks dirty. `[source: Wathan and Schoger, Refactoring UI; Albers, 1963]`
6. Pure grey (C 0) is right in exactly three cases: an image-heavy gallery where any tint would fight the photographs; a monochrome brand whose card names grey; a print proof. Even then the accent, if any, is one hue. `[house]`
7. Never `#000` or `#fff` as a large surface. Light canvas L 0.985; light `--surface` may be `oklch(0.995 0.002 h)` but not `#fff`; dark canvas L 0.17; dark text L 0.93. `[source: Apple WWDC19; Material 3 surfaces; house numbers]`

### 4.3 Text ramp

8. Three text levels and no fourth "muted" one. Each passes 4.5:1 on `--canvas` and `--surface-2` in both themes. Measured for hue 150: light `--text` 16.55:1, `--text-2` 7.09:1, `--text-3` 5.03:1 on canvas and 4.62:1 on surface-2; dark `--text` 15.56:1, `--text-2` 8.93:1, `--text-3` 6.66:1 on canvas and 4.89:1 on surface-2. `[source: WCAG 2.2 1.4.3; house, measured]`
9. Light `--text-3` stops at L 0.53. L 0.56 on a tinted canvas measures 4.44:1 and fails. Disabled text is `--text-3` at 60 percent opacity plus a non-colour cue and is the only text allowed below AA. `[source: WCAG 2.2 1.4.3 exempts inactive components; house, measured]`
10. Dark `--text` sits at L 0.93 (15.56:1 on L 0.17), never L 1.0 (18.97:1 and it halates on OLED). `[source: Apple WWDC19; house, measured]`

### 4.4 Accent and ink

11. Contrast on a coloured fill depends almost only on L. Light system: accent L 0.52, C 0.14 (capped per rule 3), white ink `oklch(0.99 0 0)` measures 4.97 to 5.77:1 on every hue from 25 to 330 (5.02:1 at hue 150). Dark system: accent L 0.72, C 0.14, dark ink `oklch(0.20 0.03 h)` measures 6.89 to 7.67:1 on every hue; white ink measures 2.28 to 2.57:1 and fails. `[house, measured]`
12. The dead zone is L 0.58 to 0.66: white ink passes 3:1 only, dark ink passes 4.5:1 only from L 0.60 up. At L 0.62 C 0.17 white gives 3.24 to 3.86:1 (large text or glyphs only) and dark ink gives 4.59 to 5.40:1. Do not put an accent there unless its text is 24 px or a glyph. `[house, measured]`
13. `--accent-ink` is the accent pulled toward the text lightness for thin things (links, icons, one accent word): light L 0.45 C 0.12 (6.75:1 on canvas), dark L 0.80 C 0.13 (10.73:1). The accent fill itself is never used as text below 24 px: light accent on canvas measures 4.96:1, dark 8.14:1, so light passes AA only at hue 150 and above the cap it will not. `[house, measured]`
14. Focus ring: `--focus` at light L 0.60 C 0.18 (3.46:1 on canvas), dark L 0.78 C 0.14 (10.06:1); 2 px, offset 2 px, measured against the canvas it sits on, not the control. `[source: WCAG 2.2 1.4.11, 2.4.13; house numbers]`

### 4.5 Semantic colours

15. Four fixed hues, not the brand hue: `--success` 150, `--warning` 75, `--danger` 25, `--info` 235. If `--hue` is within 20 degrees of one of them, shift that semantic 15 to 20 degrees away (green brand: success to 165 to 170) and always add a glyph or label. State is never colour alone. `[source: Apple HIG Color; WCAG 2.2 1.4.1; house numbers]`
16. Each semantic has a container pair and a text-on-canvas value. Light: container L 0.93 C 0.035, on-container L 0.32 C 0.06 (measured 10.19 to 10.47:1); text on canvas L 0.45 C 0.09 (6.8 to 7.5:1). Dark: container L 0.28 C 0.04, on-container L 0.90 C 0.05 (10.80 to 10.86:1); text on canvas L 0.78 C 0.11 (9.1 to 10.0:1). `[house, measured]`
17. Colour-vision deficiency: red-green deficiency affects about 8 percent of men. Semantic pairs that must be told apart differ in hue by 90 degrees or more and in L by 0.25 or more, or carry a glyph. Danger 25 versus success 150 alone fails deuteranopia; danger plus a cross glyph and success plus a tick passes. Warning 75 versus danger 25 is separated by L (0.78 versus 0.62 fills) and by glyph. `[source: Okabe and Ito, 2008; WCAG 2.2 1.4.1; house]`

### 4.6 Multi-accent products

18. Variants (levels, categories, teams) hold L and C and rotate hue only, then each C is capped per rule 3 so no variant clips. Test white ink and dark ink on every variant, pick per hue by the higher ratio, and record the ink in the proof. At light L 0.52 C 0.14 white ink wins on every hue; at dark L 0.72 dark ink wins on every hue; at L 0.62 dark ink wins on every hue (4.59 to 5.40:1). Yellow (hue 80 to 110) cannot go dark without turning to mustard: keep it at L 0.72 or above with dark ink in both themes. `[house, measured]`
19. Category dots or chips in five hues are rainbow slop. Categories get a hue only when the hue carries meaning the user must recall (a level, a team); otherwise one accent and a label. At most 6 category hues, spaced 50 degrees or more, each with its own on-colour recorded. `[house]`

### 4.7 Dark mode

20. Dark is a second system, not an inversion. Canvas L 0.17, surface 0.225, surface-2 0.29; each elevation raises L by 0.04 to 0.06 and drops the shadow. Accent chroma falls 10 to 20 percent (0.16 to 0.14) and accent L rises (0.52 to 0.72). Containers gain chroma (0.045 to 0.05) to stay visible. Text at L 0.93 with C 0.006. `[source: Apple WWDC19 "lights dimmed"; Material 3 tonal elevation; house numbers]`
21. Never a pure black canvas: `#000` kills tonal elevation, smears on OLED scroll and doubles perceived halation of white text. `[source: Material 3 surfaces; Apple HIG Dark Mode; house]`
22. Wire both themes through `color-scheme: light dark` so form controls and scrollbars follow, and keep `[data-theme]` for the manual switch. `[source: web.dev color-scheme, 2020]`

### 4.8 States

23. Hover and pressed are L shifts of the same colour via `color-mix()`, not new tokens. Light: hover `color-mix(in oklch, var(--accent), black 8%)` (about L minus 0.04), pressed 14 percent. Dark: hover `color-mix(in oklch, var(--accent), white 8%)` (about L plus 0.04), pressed 14 percent. Measured: a 0.04 L step is 1.15 to 1.17:1 between the two fills, visible but not a second colour. Ink is re-measured on the pressed fill. `[source: MDN color-mix(); house numbers]`
24. Selected state is `--container` plus `--on-container`, never the accent fill (that is for the primary action). `[house]`

## 5. Defaults

Copy into the colour block of `templates/tokens.css`; set `--hue` once. Ratios below are measured for hue 150 with `scripts/contrast.py`; re-measure after changing the hue and cap `--accent` chroma per rule 3.

```css
:root {
  --hue: 150;
  color-scheme: light;
  --canvas:        oklch(0.985 0.004 var(--hue));
  --surface:       oklch(0.995 0.002 var(--hue));
  --surface-2:     oklch(0.955 0.008 var(--hue));
  --container:     oklch(0.930 0.045 var(--hue));
  --on-container:  oklch(0.300 0.060 var(--hue));   /* on container 11.01:1 */
  --text:          oklch(0.220 0.012 var(--hue));   /* on canvas 16.55:1, on surface-2 15.18:1 */
  --text-2:        oklch(0.450 0.012 var(--hue));   /* on canvas 7.09:1, on surface-2 6.51:1 */
  --text-3:        oklch(0.530 0.012 var(--hue));   /* on canvas 5.03:1, on surface-2 4.62:1; meta only */
  --hairline:      oklch(0.900 0.010 var(--hue));   /* decorative, 1.29:1 */
  --outline:       oklch(0.600 0.020 var(--hue));   /* control boundary 3.75:1 */
  --accent:        oklch(0.520 0.140 var(--hue));   /* fill; cap C at the hue's gamut (rule 3) */
  --accent-strong: oklch(0.450 0.120 var(--hue));   /* thin fills, 6.75:1 on canvas */
  --accent-ink:    var(--accent-strong);            /* links, icons, one accent word */
  --on-accent:     oklch(0.990 0 0);                /* on accent 5.02:1 */
  --focus:         oklch(0.600 0.180 var(--hue));   /* on canvas 3.46:1 */
  --success: 150; --warning: 75; --danger: 25; --info: 235;
  --danger-container: oklch(0.93 0.035 var(--danger)); --on-danger-container: oklch(0.32 0.06 var(--danger)); /* 10.47:1 */
  --danger-text: oklch(0.45 0.09 var(--danger));    /* on canvas 7.50:1 */
  --scrim: oklch(0.10 0.01 var(--hue) / 0.5);
  --shadow-1: 0 1px 2px oklch(0.2 0.01 var(--hue) / 0.10), 0 4px 12px -4px oklch(0.2 0.01 var(--hue) / 0.16);
}
[data-theme="dark"] {
  color-scheme: dark;
  --canvas:        oklch(0.170 0.012 var(--hue));
  --surface:       oklch(0.225 0.014 var(--hue));
  --surface-2:     oklch(0.290 0.016 var(--hue));
  --container:     oklch(0.270 0.050 var(--hue));
  --on-container:  oklch(0.920 0.030 var(--hue));   /* 11.81:1 */
  --text:          oklch(0.930 0.006 var(--hue));   /* on canvas 15.56:1, on surface-2 11.44:1 */
  --text-2:        oklch(0.760 0.012 var(--hue));   /* on canvas 8.93:1, on surface-2 6.56:1 */
  --text-3:        oklch(0.680 0.012 var(--hue));   /* on canvas 6.66:1, on surface-2 4.89:1 */
  --hairline:      oklch(0.300 0.012 var(--hue));
  --outline:       oklch(0.550 0.020 var(--hue));   /* 3.97:1 */
  --accent:        oklch(0.720 0.140 var(--hue));   /* lighter, less chroma than light */
  --accent-strong: oklch(0.800 0.130 var(--hue));   /* 10.73:1 as text on canvas */
  --accent-ink:    var(--accent-strong);
  --on-accent:     oklch(0.200 0.030 var(--hue));   /* on accent 7.67:1 */
  --focus:         oklch(0.780 0.140 var(--hue));   /* 10.06:1 */
  --danger-container: oklch(0.28 0.04 var(--danger)); --on-danger-container: oklch(0.90 0.05 var(--danger)); /* 10.80:1 */
  --danger-text: oklch(0.78 0.11 var(--danger));    /* 9.12:1 */
  --shadow-1: none;
}
.button-primary { background: var(--accent); color: var(--on-accent); }
.button-primary:hover  { background: color-mix(in oklch, var(--accent), black 8%); }
.button-primary:active { background: color-mix(in oklch, var(--accent), black 14%); }
[data-theme="dark"] .button-primary:hover  { background: color-mix(in oklch, var(--accent), white 8%); }
[data-theme="dark"] .button-primary:active { background: color-mix(in oklch, var(--accent), white 14%); }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```

Repeat the `--danger-*` trio for `--success-*`, `--warning-*` and `--info-*` with the same L and C. Per-variant accents: set `--hue` on the variant's container element and re-measure ink there.

Contrast maths. WCAG 2.2: body text 4.5:1 or more; large text (24 px, or 18.66 px at weight 700) 3:1; UI boundaries, focus rings, icon strokes 3:1; ratio is (Lmax + 0.05) / (Lmin + 0.05) on sRGB luminance. APCA is polarity-aware and grades dark mode honestly: Lc 75 minimum for body, Lc 60 for labels and non-body text, Lc 45 for large headlines, Lc 30 placeholders, Lc 15 the visibility floor. Ship on WCAG numbers, tune with APCA. `[source: WCAG 2.2 1.4.3, 1.4.11; APCA readability criterion]` Worked example:

```bash
python3 scripts/contrast.py "oklch(0.22 0.012 150)" "oklch(0.985 0.004 150)"
# fg oklch(0.22 0.012 150) -> #171c18
# bg oklch(0.985 0.004 150) -> #f8fbf9
# WCAG 16.55:1   AA body 4.5:1 pass; AA large and UI 3:1 pass; AAA body 7:1 pass
# APCA Lc +101.2   body Lc 75 pass; UI label Lc 60 pass; large Lc 45 pass
python3 scripts/contrast.py "oklch(0.99 0 0)" "oklch(0.52 0.15 150)"
# bg oklch(0.52 0.15 150) -> #007f35 (clipped to gamut)      <- clipped: lower C to 0.14 (the hue-150 cap is 0.145)
python3 scripts/contrast.py --ramp 150 0.012                # neutral ramp with hex, to hand engineering
```

Colour-vision checks, run on a capture in both themes:

```css
/* 1. Grayscale: every state and variant must still be told apart. */
.proof-gray { filter: grayscale(1); }
/* 2. Deuteranopia (Machado et al. 2009 matrix); apply to <html> for a capture. */
.proof-deutan { filter: url(#deutan); }
```
```html
<svg width="0" height="0" aria-hidden="true"><filter id="deutan"><feColorMatrix type="matrix" values="
  0.367 0.861 -0.228 0 0
  0.280 0.673  0.047 0 0
 -0.012 0.043  0.969 0 0
  0 0 0 1 0"/></filter></svg>
```

## 6. Anti-patterns

| Slop | Why it fails | Fix |
|---|---|---|
| Purple-to-blue gradient (hue 280 to 250) | The 2023 to 2026 AI landing-page default; signals template before the copy is read | One hue, flat `--accent`; if a lit material is needed, 2 stops same hue, delta L 0.15 or less (3.4) |
| Neon glow, coloured halo, blurred blob behind elements | Depth without a light model; kills text contrast at the bright stop | Tonal `--container` and one tinted shadow (`--shadow-1`); dark mode uses L steps |
| Glassmorphism on cards and content | Blur on content costs contrast and frames; glass is for chrome over scroll | Solid `--surface`; blur only on a bar or sheet with a reduce-transparency fallback (engineering) |
| Rainbow category dots or chips | Six hues with no meaning; every chip competes with the accent | One accent plus a label; hues only when they carry meaning, per rule 19, each with recorded ink |
| Pure grey neutrals (`#f5f5f5`, `#333`) on a coloured brand | Reads as the complement of the accent; palette looks assembled, not authored | Neutrals at C 0.004 to 0.02 of `--hue` (rule 5); compare `#fafafa` with `#f8fbf9` |
| Grey-on-grey body or "muted" text below AA | Hierarchy by illegibility; L 0.56 on a tinted canvas measures 4.44:1 | `--text-3` at L 0.53 or lower in light, 0.68 in dark; hierarchy by size and weight |
| Dark mode as inverted light mode | Shadows vanish, accents scream, white text halates, containers disappear | Second system per rule 20: raise L per level, drop chroma 10 to 20 percent, text L 0.93 |
| Gradient text | Contrast unmeasurable at the light stop; anti-aliasing fringes | One word in `--accent-ink` or nothing |
| White text on a mid accent (L 0.58 to 0.66) at body size | 3.2 to 3.9:1; fails AA | Move the accent to L 0.52 (white ink) or L 0.72 (dark ink); rule 12 |
| Brand green reused for success, brand red for danger | State and brand merge; a "saved" badge looks like a logo | Shift the semantic hue 15 to 20 degrees and add a glyph (rule 15) |
| Same C on every hue without a gamut check | Yellow and blue clip; the family drifts and one variant is "the loud one" | Cap C per hue (rule 3); the script must print no `clipped` |
| Hairline as a control boundary | 1.29:1; the input has no edge | `--outline` at 3:1 or more, or a filled control |
| Tone and border on one element | Double boundary; visual noise | Container tone or outline, never both (3.3) |
| `#000` canvas, `#fff` text | No room for elevation; halation | Canvas L 0.17, text L 0.93 |

## 7. Hand-off artefact

The colour proof. One row per pair that appears on screen, in both themes, in every variant. Ratios come from `scripts/contrast.py`, never from looking. Engineering reads the hex column; QA re-measures the rendered page against it.

```markdown
## Colour proof: <project>
Hue: 150 · light accent L 0.52 C 0.14 (cap 0.145) · dark accent L 0.72 C 0.14 · semantic hues 150 / 75 / 25 / 235

| Pair (fg on bg) | Theme | fg oklch | bg oklch | fg hex | bg hex | WCAG | APCA Lc | Needs | Result |
|---|---|---|---|---|---|---|---|---|---|
| --text on --canvas | light | 0.22 0.012 150 | 0.985 0.004 150 | #171c18 | #f8fbf9 | 16.55:1 | +101 | 4.5 | pass |
| --text-3 on --surface-2 | light | 0.53 0.012 150 | 0.955 0.008 150 | #676e68 | #edf2ed | 4.62:1 | +67 | 4.5 | pass |
| --on-accent on --accent | light | 0.99 0 0 | 0.52 0.14 150 | #fcfcfc | #0a7e3a | 5.02:1 | -78 | 4.5 | pass |
| --on-accent on --accent:active | light | 0.99 0 0 | mix black 14% (0.447 0.12 150) | #fcfcfc | #07662d | 6.93:1 | -87 | 4.5 | pass |
| --outline on --canvas | light | 0.60 0.02 150 | 0.985 0.004 150 | #78847a | #f8fbf9 | 3.75:1 | +64 | 3 | pass |
| --text on --canvas | dark | 0.93 0.006 150 | 0.17 0.012 150 | #e5e9e6 | #0c110d | 15.56:1 | -92 | 4.5 | pass |
| --on-accent on --accent | dark | 0.20 0.03 150 | 0.72 0.14 150 | #0c1a0f | #5bbd74 | 7.67:1 | +57 | 4.5 | pass |
| variant "hard" on-accent on accent | light | 0.99 0 0 | 0.52 0.14 25 | #fcfcfc | #ab413e | 5.75:1 | -82 | 4.5 | pass; ink white |

Gamut: 0 tokens clipped (script output attached).
CVD: grayscale and deuteranopia captures attached; every state and variant distinguishable: yes/no, with the glyph that carries it.
```

## 8. Checklist

Run on the token sheet plus one capture per theme. Any "no" is a fail.

- [ ] Exactly one `--hue`; every non-semantic colour is a formula of it, and no literal hex or `gray()` appears outside `tokens.css`?
- [ ] Every neutral has C 0.004 to 0.02 of `--hue` (or pure grey is justified by rule 6 in `concept.md`)?
- [ ] `--text`, `--text-2`, `--text-3` measure 4.5:1 or more on `--canvas` and `--surface-2` in both themes?
- [ ] `--on-accent` measures 4.5:1 or more on `--accent`, on its hover and on its pressed fill, in both themes and in every variant, with the ink recorded per hue?
- [ ] `--outline` and `--focus` measure 3:1 or more on the canvas they sit on; hairlines are never a control boundary?
- [ ] `scripts/contrast.py` prints no `clipped` for any token?
- [ ] Dark theme: canvas L 0.17 (not `#000`), text L 0.93 or lower, accent C lower and L higher than light, elevation by L not shadow?
- [ ] Semantic hues are 150 / 75 / 25 / 235 (shifted if within 20 degrees of `--hue`), each with a container pair at 4.5:1 or more, and no state is colour alone?
- [ ] Accent area 10 percent or less of the capture; one accent hue plus semantics only?
- [ ] No gradient, or the one gradient is 2 stops, same hue, delta L 0.15 or less, and its darkest stop is in the proof?
- [ ] Grayscale and deuteranopia captures keep every state and variant distinguishable?
- [ ] Colour proof (section 7) exists as a table with a hex, a ratio and a result on every row?

## 9. Sources

- Ottosson, Björn. A perceptual color space for image processing (OKLab), 2020; and OKHSV and OKHSL (gamut notes), 2021. https://bottosson.github.io/posts/oklab/ ; https://bottosson.github.io/posts/colorpicker/
- Sitnik, Andrey and Turner, Travis. OKLCH in CSS: why we moved from RGB and HSL, Evil Martians, 2022. https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
- W3C WCAG 2.2, 1.4.3 Contrast (Minimum). https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum ; 1.4.11 Non-text Contrast. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast ; 1.4.1 Use of Color. https://www.w3.org/WAI/WCAG22/Understanding/use-of-color ; 2.4.13 Focus Appearance. https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance
- Somers, Andrew. APCA Readability Criterion (Lc 90/75/60/45/30/15). https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell ; https://readtech.org/ARC/
- Material Design 3, Color system: roles, tonal palettes and surfaces. https://m3.material.io/styles/color/system/overview ; https://m3.material.io/styles/color/roles
- Apple Human Interface Guidelines, Color. https://developer.apple.com/design/human-interface-guidelines/color ; Dark Mode. https://developer.apple.com/design/human-interface-guidelines/dark-mode ; WWDC19, What's New in iOS Design (dark mode as dimmed lights). https://developer.apple.com/videos/play/wwdc2019/808/
- Radix Colors, understanding the scale (12 steps, each with a stated use). https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- Wathan, Adam and Schoger, Steve. Refactoring UI (saturate your greys toward the accent), 2018. https://www.refactoringui.com/
- Albers, Josef. Interaction of Color (simultaneous contrast), 1963. https://www.albersfoundation.org/alberses/teaching/interaction-of-color
- Okabe, Masataka and Ito, Kei. Color Universal Design: how to make figures and presentations that are friendly to colorblind people, 2008. https://jfly.uni-koeln.de/color/
- Machado, Oliveira and Fernandes. A physiologically-based model for simulation of color vision deficiency, IEEE TVCG 2009 (deuteranopia matrix). https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
- web.dev, Improved dark mode default styling with the color-scheme CSS property, 2020. https://web.dev/articles/color-scheme
- MDN, color-mix(). https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix ; MDN, oklch(). https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch
- Live OKLCH light and dark token system built from one `--hue`: `/workspace/src/game-shell.css` (read 2026). Measurement tool: `scripts/contrast.py`. Token sheet: `templates/tokens.css`.
