---
name: typography
description: Decides serif or sans by product type and tone, the pairing, the modular scale and its line-heights, measure, tracking, numerals, optical sizes, weight hierarchy, text colour ramp roles, headline groups, type on dark and when a monospace voice is right; picks families from references/fonts.md. The front desk calls this desk at run-sheet step 3 (System) for every job that sets or changes type, and at step 4 (Build) to check rendered text; it never loads fonts (engineering) or picks colours (colour).
---

# Typography desk

The typographer on the studio team. This desk turns the brief and the concept into a type spec that layout, colour and engineering can build from without taste. Numbers here are defaults; a rule in this file is the only thing that overrides them. `[source: ...]` is traceable to section 9; `[house]` is a studio rule.

## 1. When the front desk calls this desk

- Run-sheet step 3 (System): choose families, ratio, roles and write the type rows of `tokens.css` plus the type spec (section 7).
- Run-sheet step 4 (Build): check rendered sizes, line boxes, measure and numerals on the running page with `scripts/measure.mjs`.
- Any job row in the routing table that names "typography", and any "make it premium" or audit job where QA has flagged type findings.
- Not called for: font loading, `size-adjust`, subsetting (`../engineering/PLAYBOOK.md`); text colour values (`../colour/PLAYBOOK.md`; this desk only names the roles).

## 2. Inputs required

| Artefact | From | What this desk reads from it |
|---|---|---|
| Intake card, line 1 and 7 | front desk | Product type, device and reading context; the three tone words and the forbidden word |
| `brief.md` | strategy | Primary task (decides density), locales (decides script coverage), performance budget (decides file count) |
| `concept.md` | direction | The one idea and the chosen direction; the kill list (often names the current families) |
| Space scale from `tokens.css` | layout | The 4 px grid every line-height and text margin must land on |

Stop condition: no family is chosen until the tone words and the primary task are on the card. `[house]`

## 3. Decisions this desk owns

### 3.1 Serif or sans

Pick the row that matches the product type; if two rows fit, the tone words decide. Families are from `references/fonts.md`; "body face" means the body family reused at a heavier weight. `[house]`

| Product type or tone | Display | Body | UI (labels, controls) | Mono | Escape hatch |
|---|---|---|---|---|---|
| Tool or dashboard | None: body face at 600, largest size `--fs-5` (31 px) | Inter (opsz) or Geist | Body face | Geist Mono or Commit Mono for IDs, code, timestamps | Brand needs a voice: one italic serif eyebrow (Instrument Serif at `--fs-3`), never a serif heading |
| Consumer app | Body face at 600; Open Runde when the tone word is warm or friendly | Inter, Open Runde, Figtree | Body face | None; tabular numerals in the body face | Character-led brief: Bricolage Grotesque display at 28 px and above |
| Editorial or long reading | Newsreader or Source Serif 4 (opsz) | Same serif, body 18 px, ratio 1.333 | Inter or Public Sans (UI stays sans) | None | One-family editorial: Fraunces via its opsz axis for both display and body |
| Luxury or fashion | Canela, or substitute Fraunces 300 (SOFT 0, WONK 0), at 40 px and above | Untitled Sans or Söhne; substitute Hanken Grotesk | Body face | None | Didone display (Cormorant) at 40 px and above; never below 24 px |
| Playful or character-led | Bricolage Grotesque, or Fraunces (SOFT 100, WONK 1) | Manrope, Open Runde or Figtree | Body face | Departure Mono as a pixel motif in at most 2 places per screen | Clash Display only when a tone word is "loud"; still 28 px and above |
| Developer or technical | Body face at 600 | Geist, Inter or IBM Plex Sans | Body face | Geist Mono, JetBrains Mono or Commit Mono for code, logs, IDs, metrics | Whole-site mono at 14 px/20 px when the product is a terminal, CLI or infrastructure brand (see rule 3.4) |
| Brand or portfolio | Instrument Serif, Fraunces or GT Alpina (substitute Fraunces); or a grotesk with a hook (Schibsted Grotesk, Bricolage Grotesque) | Inter, Hanken Grotesk or Switzer | Body face | Commit Mono for meta and captions | Direction presents two candidates, one serif-led and one grotesk-led; the build ships one |

### 3.2 Scale ratio

| Situation | Default | Escape hatch |
|---|---|---|
| Product UI, dashboards, tools | 1.25 (major third) from 16 px; the ladder in section 4.2 | 1.2 (minor third) when the primary task needs more than 6 text sizes visible at once; ladder 13/16/19/23/28/33/40 px |
| Editorial, long reading | 1.333 (perfect fourth) from 16 px, body 18 px and above; ladder 12/16/21/28/38/51/68 px | 1.25 when the page also carries UI (comments, tools) |
| Marketing or brand site | 1.25; display step `--fs-7` (49 px) may be multiplied once more by 1.25 to 61 px for the hero | Never mix ratios on one screen `[source: Tim Brown, 2011]` |

### 3.3 Weight and voice

| Situation | Default | Escape hatch |
|---|---|---|
| Weights across both families | Three: 400 body, 500 labels and emphasis, 600 headings (or display face at 400) | 700 for one word per screen; a 300 only for a display serif at 40 px and above |
| Second voice inside text | True italic of the body face for eyebrows, captions, quoted titles, one emphasised word | Italic display face for the eyebrow when the display is a serif |
| Labels and eyebrows | Sentence case, body face 500, one step below body (`--fs-1`), letter-spacing 0 | Caps only for an acronym string or legal mark, tracked +0.05 em to +0.12 em |

### 3.4 Monospace voice

| Situation | Default | Escape hatch |
|---|---|---|
| Labels, meta, timestamps, IDs, tabular data, code | Mono at `--fs-0` or `--fs-1`, weight 400 or 500, line-height 20 px; tabular by construction | Mono at `--fs-2` for code blocks only |
| Headings or body of a non-technical product | Not mono: this is a costume. A mono hero line on a consumer app signals template output | Whole-site mono is a direction, not a decoration: it needs body at 14 px/20 px, measure at or below 60 ch, no size above `--fs-5`, and a product that is itself a terminal, CLI or studio. otherkind.design sets its whole site in ABC Monument Grotesk and Monument Grotesk Mono at 14 px/20 px `[source: otherkind.design CSS, observed 2026]` |

## 4. Rules

### 4.1 Pairing

1. Contrast of construction, not of era. Pair one strong formal trait (high-contrast serif, soft rounded terminals, condensed grotesk) with a quiet workhorse that has the opposite trait. Two neo-grotesks or two Garalde serifs read as a mistake, not a pairing. `[house]`
2. Shared x-height within about 5 percent. Set "xn" in both faces at 100 px and measure the x-height; the difference must be 5 px or less, or the smaller face gets a size correction of the same percentage. `[house]`
3. At most two families plus an optional mono. UI labels, buttons and numerals use the body family. `[house]`
4. Display serifs with no text cut (Instrument Serif, DM Serif Display, Cormorant, Zodiak) appear only at 28 px and above; Instrument Serif at 32 px and above. `[house]`
5. Three weights maximum across both families (default 400, 500, 600). Hierarchy comes from size, weight, colour and space, not from weight count. `[house]`
6. The display face earns its place: it appears at 2 or more sizes on 2 or more screens. A serif used once for one hero line is a costume. `[house]`
7. Italic is a second voice, never a paragraph or a button. Prefer a true italic; refuse synthesised slant and bold with `font-synthesis: none`. `[source: Butterick; house]`
8. A body face qualifies only if it has tabular numerals (`tnum`), a real 500 or 600, a distinguishable `Il1` and `0O`, and hinted rendering at 13 px on Windows. Missing any one makes it a display face. `[house]`
9. Variable fonts: one file with `wght` and, where present, `opsz`; load at most 2 files. Loading, `font-display` and `size-adjust` fallbacks are engineering's rules (`../engineering/PLAYBOOK.md`). `[house]`
10. Anti-pairings: Inter + Roboto; Playfair Display + Lato; any two geometric sans; a rounded sans with a soft serif (two soft voices, no contrast). `[house]`

### 4.2 Scale, leading, measure

11. One modular ratio, written as tokens (`--fs-0` to `--fs-7`). Default 1.25 from 16 px, rounded to whole px, line-heights on the 4 px grid. `[source: Tim Brown, 2011; house numbers]`

| Token | Size | Line-height | Step | Tracking | Use |
|---|---|---|---|---|---|
| `--fs-0` | 12.8 px (renders 13 px) | 20 px (1.54) | 16 / 1.25 | 0 | timestamps, helper text, eyebrows |
| `--fs-1` | 14 px | 20 px (1.43) | half step | 0 | secondary text, table cells, labels |
| `--fs-2` | 16 px | 24 px (1.50) | base | 0 | paragraphs, inputs, buttons |
| `--fs-3` | 20 px | 28 px (1.40) | 1.25 | 0 | lead paragraphs, sublines |
| `--fs-4` | 25 px | 32 px (1.28) | 1.25 squared | -0.005 em | card and section titles |
| `--fs-5` | 31 px | 36 px (1.16) | 1.25 cubed | -0.01 em | page headings |
| `--fs-6` | 39 px | 44 px (1.13) | 1.25 to the 4th | -0.02 em | hero headline (product) |
| `--fs-7` | 49 px | 52 px (1.06) | 1.25 to the 5th | -0.025 em | display, marketing hero, large numerals |

12. Line-height by size: 1.50 at body (1.45 to 1.60 by x-height), 1.30 to 1.40 at lead and title, 1.10 to 1.20 at heading, 1.00 to 1.10 at display; multi-line display at 48 px and above sits at 1.00 to 1.05. Use the px values above; `--lh-body` 1.5, `--lh-snug` 1.25 and `--lh-tight` 1.1 are for text whose size is not known in advance (CMS content). `[source: Butterick, 120 to 145 percent; house for display]`
13. Measure 45 to 75 characters, 66 ideal; 40 to 50 ch in narrow columns or beside a figure. Set `max-width` in `ch` on the paragraph (`--measure: 64ch`), not on the container. `[source: Bringhurst via webtypography.net]`
14. Paragraph spacing: `margin-block: 0.75em` or a first-line indent, never both. `[source: Butterick]`
15. No orphan word in a headline: `text-wrap: balance` for headings of 3 lines or fewer, `text-wrap: pretty` for body. `[house]`
16. Vertical rhythm: every line-height and text-block margin lands on the 4 px grid so neighbouring columns share baselines. `[house]`

### 4.3 Micro-typography

17. Tracking: negative only above 32 px: -0.01 em at 32 px, -0.02 em at 40 px, up to -0.03 em at 64 px and above. Body and UI text at 0. Never track lowercase apart. `[source: Butterick; Apple HIG tracking tables; house thresholds]`
18. Caps, when unavoidable (acronym string, legal mark), are tracked +0.05 em to +0.12 em. Letter-spaced caps as a label device cost 10 to 15 percent legibility at label sizes and are the first slop signal. `[source: Butterick, 5 to 12 percent; house]`
19. Numerals: anything that changes while visible (counter, timer, score, "Try 1 of 5", any table column) uses `font-variant-numeric: tabular-nums`; running text uses proportional. Add `lining-nums` if the face defaults to old-style. `[source: Butterick]`
20. Optical sizing: leave `font-optical-sizing: auto` on; for a manual `opsz` axis set it equal to the rendered px. Never a display cut below 20 px or a text cut above 40 px. `[source: Apple WWDC20; MDN variable fonts]`
21. Weight hierarchy: body 400, emphasis and labels 500, headings 600 (or the display face at 400). 700 is reserved for one word per screen. `[house]`
22. Hanging punctuation: `hanging-punctuation: first last` where supported (Safari), else `text-indent: -0.4em` on the quote line. Optically align display lines whose first glyph is round or open (O, C, T, quote) by -0.04 em to -0.08 em. `[source: Bringhurst; Bjango]`
23. `font-kerning: normal; font-feature-settings: "liga" 1` everywhere; `dlig` off in UI text. Real `…`, `–`, `—` and smart quotes in copy. `[source: Butterick; house]`

### 4.4 Text colour ramp roles

24. Three text levels, named `--text`, `--text-2`, `--text-3`; no fourth "muted" level. Hierarchy comes from size and weight first; colour reinforces it. Every level passes 4.5:1 on `--bg` and `--surface-2` in both themes, measured by the colour desk (`../colour/PLAYBOOK.md`, section 5). `[house; source: WCAG 2.2 1.4.3]`
25. Role mapping: `--text` for headings and body; `--text-2` for sublines, labels, eyebrows; `--text-3` for captions, placeholders and meta only. Disabled text is `--text-3` at 60 percent opacity plus a non-colour cue, and is the only text allowed below AA. `[house; WCAG 1.4.3 exempts inactive components]`

### 4.5 Headline group

26. Eyebrow, headline and subline are one object with one left edge (or one centre line, never mixed). Eyebrow `--fs-0` body face 500 `--text-2` (or italic display face at `--fs-2` in `--accent-strong`), margin-bottom 8 px to 12 px; headline `--fs-6` or `--fs-7`, `--text`, `text-wrap: balance`, 2 lines or fewer on product, 3 or fewer on marketing; subline `--fs-3` body face 400 `--text-2`, measure 55 ch or less, margin-top 12 px to 16 px, `text-wrap: pretty`. `[house]`
27. Headline to subline size ratio 2.5:1 or less on product (39/20 or 49/20), 3:1 or less on marketing. Eyebrow-to-headline is the smallest gap; subline to the next object is at least 2 times the group's internal gap. `[house; Gestalt proximity]`
28. One item in the group carries the accent: the eyebrow or one word of the headline via colour, never both, never a gradient fill. Centred groups only when every line is 40 ch or less and no body text follows. The group's box keeps one height across states (win, lose, idle); reserve space for the longest copy. `[house]`

### 4.6 Type on dark

29. Light text on dark reads one step heavier (irradiation). Drop one weight step on body 16 px and above where the family has a 300 or 350 (Inter, Geist, Fraunces); otherwise keep 400 and lower `--text` to L 0.93. `[house; source: Apple WWDC19 dark mode session]`
30. Never pure white. `--text` at L 0.95 or below (measured 16.5:1 on `--bg` L 0.17); L 0.97 and above halates on OLED. `--text-2` at L 0.74 (8.3:1) is the working level for most dark UI; do not raise it to compensate for thin weights. `[house, measured]`
31. Display serifs with hairlines (Cormorant, Zodiak, Instrument Serif) at 400 on dark: raise to 500 if one exists or add 0.01 em tracking; hairlines below 1 px vanish on 1x screens. `[house]`

## 5. Defaults

Copy into the type block of `tokens.css`; replace the family names from the table in 3.1.

```css
:root {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Instrument Serif", var(--font-sans);   /* only if 3.1 gives a display face */
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --fs-0: 0.8rem;    --fs-1: 0.875rem; --fs-2: 1rem;      --fs-3: 1.25rem;
  --fs-4: 1.5625rem; --fs-5: 1.953rem; --fs-6: 2.441rem;  --fs-7: 3.052rem;
  --lh-tight: 1.1; --lh-snug: 1.25; --lh-body: 1.5; --measure: 64ch;
}
html { font-family: var(--font-sans); font-size: 100%; font-kerning: normal;
  font-feature-settings: "liga" 1; font-optical-sizing: auto; font-synthesis: none;
  -webkit-text-size-adjust: 100%; }
body { font-size: var(--fs-2); line-height: 24px; color: var(--text); text-wrap: pretty; }
p { max-width: var(--measure); margin-block: 0.75em; }
h1 { font-size: var(--fs-6); line-height: 44px; font-weight: 600; letter-spacing: -0.02em; text-wrap: balance; }
h2 { font-size: var(--fs-5); line-height: 36px; font-weight: 600; letter-spacing: -0.01em; text-wrap: balance; }
h3 { font-size: var(--fs-4); line-height: 32px; font-weight: 600; letter-spacing: -0.005em; }
.lead { font-size: var(--fs-3); line-height: 28px; color: var(--text-2); max-width: 55ch; }
.label, .eyebrow { font-size: var(--fs-1); line-height: 20px; font-weight: 500; color: var(--text-2); letter-spacing: 0; }
.meta, .caption { font-size: var(--fs-0); line-height: 20px; color: var(--text-3); }
.num, td.num, .timer, .score { font-variant-numeric: tabular-nums lining-nums; }
.display { font-family: var(--font-display); font-size: var(--fs-7); line-height: 52px; font-weight: 400; letter-spacing: -0.025em; }
code, .mono { font-family: var(--font-mono); font-size: var(--fs-1); line-height: 20px; font-variant-numeric: tabular-nums; }
@media (prefers-color-scheme: dark) { body { font-weight: 350; } }  /* only when the family has 350; else remove */
```

At ratio 1.2 the ladder is 13/16/19/23/28/33/40 px; at 1.333 it is 12/16/21/28/38/51/68 px with body 18 px and above (editorial only). `[house]`

## 6. Anti-patterns

| Slop | Why it fails | Fix |
|---|---|---|
| Space Grotesk, Poppins, Montserrat or Playfair Display as defaults | Overused 2018 to 2026; reads as a template before the copy is read | Pick from the table in 3.1 or the catalogue; if the brief names one of these, direction must justify it in `concept.md` |
| Uppercase tracked labels everywhere | 10 to 15 percent legibility loss at 12 px to 14 px; first slop signal | Sentence case, body face 500, `--fs-1`, letter-spacing 0 |
| More than two families | Hierarchy by novelty; every screen re-teaches the reader | Two families plus an optional mono; the third family is deleted, not demoted |
| Centred long body text | Ragged left edge costs the return sweep on every line | Left-align to the column edge; centre only lines of 40 ch or less with no body beneath |
| Letter-spacing on body or UI text | Breaks word shapes at 14 px to 16 px | 0 at 32 px and below; negative only above per rule 17 |
| Display face used for body | No text cut: hairlines vanish, spacing too tight at 16 px | Display face at 28 px and above; body in the workhorse |
| Fake small caps (`font-variant: small-caps` on a face without `smcp`) | Browser shrinks capitals; strokes go thin and grey | Use a face with real `smcp`, or sentence case |
| Gradient text | Breaks contrast measurement and anti-aliasing; slop signal | One word in `--accent-strong`, or nothing |
| Five weights, synthesised bold or italic | Weight noise; faux styles smear on Windows | Three weights, `font-synthesis: none`, load the true italic |
| Proportional figures on a timer, score or table | Digits dance as they change | `font-variant-numeric: tabular-nums` (rule 19) |
| Line-height 1.5 on a 48 px display, or 1.1 on body | Gaps wider than the type; or lines colliding | Table in rule 11 |
| Body measure above 75 ch or no `max-width` | Eye loses the line on the return | `max-width: var(--measure)` on the paragraph |
| Serif used once in a hero | Costume, not a system | Rule 6: 2 sizes on 2 screens, or drop it |
| Mono headline on a consumer product | Costume (3.4) | Mono for meta and data only, or make it the whole-site direction |

## 7. Hand-off artefact

The type spec. One row per role; every row maps to a token and a place. The colour desk fills the colour column with a measured ratio; engineering reads the family column to decide files.

```markdown
## Type spec: <project>
Families: body <family> (weights 400, 500, 600) · display <family or none> (400) · mono <family or none> (400)
Ratio: 1.25 from 16 px · line-heights on the 4 px grid · measure 64ch

| Role | Family | Size token | Line-height | Weight | Letter-spacing | Numerals | Colour role | Where used |
|---|---|---|---|---|---|---|---|---|
| Display | display | --fs-7 (49 px) | 52 px | 400 | -0.025em | proportional | --text | marketing hero only |
| Headline | body | --fs-6 (39 px) | 44 px | 600 | -0.02em | proportional | --text | page h1 |
| Heading | body | --fs-5 (31 px) | 36 px | 600 | -0.01em | proportional | --text | section h2 |
| Title | body | --fs-4 (25 px) | 32 px | 600 | -0.005em | proportional | --text | card, dialog h3 |
| Lead | body | --fs-3 (20 px) | 28 px | 400 | 0 | proportional | --text-2 | subline under h1 |
| Body | body | --fs-2 (16 px) | 24 px | 400 | 0 | proportional | --text | paragraphs, inputs, buttons |
| Label | body | --fs-1 (14 px) | 20 px | 500 | 0 | tabular where counting | --text-2 | form labels, eyebrows, tabs |
| Meta | body or mono | --fs-0 (13 px) | 20 px | 400 | 0 | tabular | --text-3 | timestamps, helper text |
| Data | mono | --fs-1 (14 px) | 20 px | 400 | 0 | tabular lining | --text | tables, IDs, code |
```

## 8. Checklist

Run on a screenshot plus one DOM pass (`scripts/measure.mjs`). Any "no" is a fail.

- [ ] 2 families or fewer, 3 weights or fewer, and the display face appears at 2 or more sizes on 2 or more screens?
- [ ] Every rendered `font-size` is a scale token (13/14/16/20/25/31/39/49 px at 1.25, or the chosen ratio)?
- [ ] Body line-height 1.45 to 1.60, display 1.00 to 1.15, all line boxes on the 4 px grid?
- [ ] Longest paragraph measures 45 to 75 ch (`el.innerText.length / lines`)?
- [ ] `letter-spacing` is 0 at 32 px and below and 0 or negative above; no letter-spaced caps labels?
- [ ] Every counter, timer, score and numeric column has `font-variant-numeric: tabular-nums`?
- [ ] Headline group: one edge, eyebrow gap smallest, box height stable across states?
- [ ] `--text`, `--text-2`, `--text-3` measured 4.5:1 or better on `--bg` and `--surface-2` in both themes (colour desk's numbers)?
- [ ] Dark theme: `--text` at L 0.95 or below; body weight dropped one step or `--text` at L 0.93?
- [ ] No family from the slop signals list in `references/fonts.md` without a written reason in `concept.md`?
- [ ] Type spec (section 7) exists as a table, every row mapped to a token and a place?

## 9. Sources

- Butterick, Practical Typography: letterspacing 5 to 12 percent for caps, none for lowercase; line spacing 120 to 145 percent; tabular figures. https://practicaltypography.com/letterspacing.html ; https://practicaltypography.com/line-spacing.html
- Bringhurst, The Elements of Typographic Style (measure 45 to 75 characters, hanging punctuation), via Rutter, The Elements of Typographic Style Applied to the Web. https://webtypography.net/2.1.2
- Brown, Tim. More Meaningful Typography (modular scales), A List Apart, 2011. https://alistapart.com/article/more-meaningful-typography/
- Apple WWDC20, The details of UI typography (optical sizes, tracking). https://developer.apple.com/videos/play/wwdc2020/10175/ ; Apple HIG Typography. https://developer.apple.com/design/human-interface-guidelines/typography
- Apple WWDC19, What's New in iOS Design (dark mode as dimmed lights). https://developer.apple.com/videos/play/wwdc2019/808/
- MDN, Variable fonts guide (`opsz`, `font-optical-sizing`). https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Fonts/Variable_fonts
- Undercase Type, Fraunces axes (opsz 9 to 144, SOFT, WONK gated at opsz above 18). https://github.com/undercasetype/Fraunces
- Kern, Laurids. Open Runde (rounded Inter, OFL). https://github.com/lauridskern/open-runde
- Bjango, Optical adjustments. https://bjango.com/articles/opticaladjustments/
- W3C WCAG 2.2, 1.4.3 Contrast (Minimum). https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
- otherkind.design, body set in ABC Monument Grotesk and Monument Grotesk Mono at 14 px/20 px, letter-spacing -0.2 px (stylesheet read 2026). https://otherkind.design
- Catalogue, licences and pairing recipes: `references/fonts.md`. Font loading, `font-display`, `size-adjust`: `../engineering/PLAYBOOK.md`.
