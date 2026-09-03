---
name: brand
description: The identity desk. Owns the identity system (positioning, tone, naming when asked, the mark and its lockups, type and colour as brand, the written design language) and every surface that is not a web page - presentation decks, social sets, OG images, email and newsletters, print, app icons and favicons, signage, packaging, merch, pitch and case-study pages, brand guidelines, the asset kit, rollout and the consistency audit. The front desk calls it on a new brand, a brand refresh, any request for a "design language", and any deliverable that is not a web page; it chooses within the direction catalogue and hands mark craft to illustration, type to typography, palette to colour.
---

# Brand desk

The identity designer on the studio team. A brand is a set of decisions that make anything the company ships recognisable at a glance, measured on surfaces the web desks never see: a slide at 6 m, an icon at 16 px, a card at 85 mm. This desk writes those decisions down as numbers and hands each surface a spec. It chooses within `../direction/references/directions.md`; it does not invent an eleventh direction. `[source: ...]` is traceable to section 9; `[house]` is a studio rule.

## 1. When the front desk calls this desk

- A new brand, a brand refresh, or any request for a "design language", "visual identity" or "look and feel across everything".
- Any deliverable that is not a web page: deck, pitch, social set, OG image, print, app icon or favicon, email or newsletter, signage, packaging, merch, brand guidelines, asset kit.
- Run-sheet step 2 alongside direction on the "Marketing, brand or portfolio site" row: the site inherits the identity, not the other way round.
- QA or direction reports that two touchpoints do not look like the same company (consistency audit, section 7).
- Not called for: page layout (`../layout/PLAYBOOK.md`), drawing the mark (`../illustration/PLAYBOOK.md`, rules 15 to 18), token maths (`../typography/PLAYBOOK.md`, `../colour/PLAYBOOK.md`). This desk decides; those desks craft. `[house]`

## 2. Inputs required

| Artefact | From | What this desk reads from it |
|---|---|---|
| Intake card, all eight lines | front desk | Who and what (line 1), success (3), what must not change (4: an existing mark, a colour, a name), references and dislikes (5, 6), tone words and the forbidden word (7), locales (8) |
| `brief.md` | strategy | Primary task of the brand launch (sell, hire, raise, be found); the baseline numbers for section 3.8 |
| `concept.md` | direction | The one idea and the chosen direction; the kill list; the three mechanisms |
| Existing assets | client | Mark source vectors, licensed fonts, current guidelines, the last three decks, the last ten social posts |

Stop condition: no mark, type or colour decision until the positioning sentence (3.1) is written and the direction is chosen. A logo made before positioning is decoration with a name. `[house]`

## 3. Decisions this desk owns

### 3.1 Identity strategy on one page

One page, four blocks, filled in this order. `[source: Neumeier, 2003; Johnson, 2016; house format]`

| Block | Format | Rule |
|---|---|---|
| Positioning | "For [who] who [need], [brand] is the [category] that [difference]." | One sentence, 25 words or fewer; the difference is a fact a competitor cannot claim this quarter |
| Tone | 3 words, each with one "not" beside it ("precise, not cold") | Taken from intake line 7; each word must change a visible decision downstream |
| Forbidden word | 1 word | The word that must never describe the result; it seeds the kill list |
| Competitor map | Two axes, 6 competitors placed, the brand placed last | Axes are attributes buyers use (e.g. "technical to approachable", "infrastructure to product"); the brand sits where no competitor is within 20 percent of either axis, or the positioning is not different |

Zag test: if the positioning sentence could be signed by a competitor, rewrite the difference until it cannot. `[source: Neumeier, 2006]`

### 3.2 Naming (only when asked)

| Criterion | Pass | Fail |
|---|---|---|
| Says-able | A stranger reads it aloud once and gets it right | Two plausible pronunciations |
| Spell-able | Heard once, typed correctly | Dropped vowels, doubled letters, "ly" and "ify" suffixes |
| Length | 2 to 3 syllables, 4 to 9 letters | 1 syllable already taken; 4 or more syllables |
| Domain | `.com` or `.design` available or buyable under a stated budget; social handles free on 3 networks | Only `get-` or `-app` variants left |
| Trademark first check | No live mark in the same class on USPTO Trademark Search and WIPO Global Brand Database | A live mark in classes 9, 35 or 42 for a software product |
| Puns | None | A pun, a misspelling that "looks techy", a word already a common noun in the category |

Present 3 candidates with the table filled for each; the client picks one; legal clearance is the client's counsel, not this desk. `[source: USPTO; WIPO; house criteria]`

### 3.3 The mark

| Situation | Default | Escape hatch |
|---|---|---|
| Tool, studio, developer product, consultancy | Wordmark only, set in the brand display face and hand-kerned | Add a monogram only when an app icon or favicon is on the surface list |
| Consumer app, needs an icon on a home screen | Symbol plus wordmark, symbol works alone at 16 px | Monogram (1 or 2 letters) when the name is long or the category is crowded with symbols |
| Institution, finance, law | Monogram or wordmark; no symbol | Symbol when a 100-year-old device already exists (keep it, redraw it) |
| Brand that lives in motion, events, culture | Dynamic or generative system: fixed wordmark plus a rule-based variable element | Never the wordmark itself as the variable; the name must not move |

Lockups and sizes (every mark ships these) `[source: Johnson, 2016; house numbers]`:

| Lockup | Use | Clear space | Minimum size |
|---|---|---|---|
| Horizontal (symbol left of wordmark) | Headers, signage, decks | The wordmark's x-height on every side | 24 px wide on screen; 8 mm wide in print |
| Stacked (symbol above wordmark) | Square placements, merch, social avatars with a caption | x-height | 24 px; 8 mm |
| Mark only (symbol or monogram) | App icon, favicon, avatar, embroidery | x-height of the lockup it was cut from | 16 px; 6 mm |

Craft (grid, silhouette, single-colour version, 16 px cut, outlined paths) is the illustration desk's, rules 15 to 18 of `../illustration/PLAYBOOK.md`. This desk hands it the brief: which row above, the display face, the one hue, the surfaces list. `[house]`

### 3.4 Typography as brand

| Situation | Default | Escape hatch |
|---|---|---|
| Families | 1 body family, 1 display or mono voice, from `../typography/references/fonts.md` table A | A commercial family from table B when the budget names it; record the substitute from the last column |
| Roles | Display (wordmark, deck titles, posters), text (everything read), data (mono for numbers, code, meta) | Drop the data role when the brand never shows numbers |
| The brand size | One display size the brand is known at: 96 px on screen, 64 pt on slides, 120 pt on A2; the same tracking and weight everywhere | Scale by the ratio in the type spec, never by eye |
| Licensing | OFL or Fontshare for web, desktop and app; check page-view tiers and app embedding before a commercial face ships | System fonts (email, Google Slides shared externally) with a written fallback stack |

Anything set in the display face at the brand size, with the brand tracking, reads as the brand before the mark is seen. That is the test. `[house]`

### 3.5 Colour as brand

| Situation | Default | Escape hatch |
|---|---|---|
| Core | One hue as `--hue`; the palette is the colour desk's formulas of it | A second hue only as illustration or one semantic role (`../colour/PLAYBOOK.md`, 3.1) |
| Accent | 1, at 10 percent of area or less | None |
| Neutrals | Hue-shifted per the colour desk; never `#000` or `#fff` as surfaces except in print where paper is white | Pure grey only for an image-led monochrome brand |
| Brand colour proof | The accent and the mark tested on white, on black (L 0.17 canvas), and on 3 brand photographs; each pair measured with `scripts/contrast.py` | A photo that fails gets a flat one-colour scrim at 40 percent alpha or a different photo, never a gradient |
| Print | Pantone or CMYK build recorded beside the hex and OKLCH; a proof printed before a run | None |

### 3.6 The design language

The design language is a written table of 8 to 12 rules that make anything look like the brand without the mark present. Each rule is a number or a name, not an adjective. Fill it once; every surface spec in `references/surfaces.md` inherits it. `[house; mechanism from otherkind's Cloudflare Workers refresh, which unified compute, storage and AI under one expressive and technical language]`

Worked example, a technical developer platform (direction: Swiss grid with Tool density mechanisms):

| Rule | Value |
|---|---|
| Shape language | Rectangles; 0 px radius on structure, 6 px on controls; no capsules |
| Corner radius set | 0, 6, 12 px; nested radii concentric |
| Stroke weight | 1 px hairlines at 3:1 for structure; 2 px for icons on a 24 grid |
| Grid | 12 columns, 24 px gutters, visible as hairlines on decks and posters |
| Type | Inter Tight display at -0.02 em, Inter text, Geist Mono for every number, ID, code and caption |
| Colour | Neutral canvas L 0.985, ink L 0.20, one signal hue 45 (orange) at C 0.14 on 10 percent of the area or less; no second accent |
| Photo treatment | Real product captures at 2x, no device frame, 1 px hairline border; no stock, no 3D renders |
| Illustration style | Line, 2 px, `currentColor`, diagrams only; no people, no blobs |
| Motion dialect | Tool snap: 120 to 200 ms, opacity and 4 px moves; the one set piece is a live data readout |
| Data voice | Tabular mono, units after a thin space, timestamps ISO 8601 |
| Depth | None: no shadows, no glow, no blur; hierarchy by size, weight and hairlines |
| Tone in copy | Sentence case, verbs first, numbers not adjectives; the forbidden word is "magical" |

### 3.7 Applications

Full specs, safe areas, exports and failure lists are in `references/surfaces.md`. The decisions each surface forces are here.

| Surface | Default | Escape hatch |
|---|---|---|
| Presentation deck | 16:9 at 1920 x 1080; 12-column grid (96 px margins, 24 px gutters, 122 px columns); one idea per slide; body 24 pt minimum, titles 48 to 64 pt; 30 words per slide maximum; light theme or dark theme, never both in one deck; six templates: cover, section, content, quote, number, closing | Dark theme only for a projected keynote in a darkened room; a seventh template needs a written reason |
| Social set | 1080 x 1080, 1080 x 1350, 1080 x 1920, 1200 x 630 OG, 1500 x 500 X header, 1584 x 396 LinkedIn banner; text at 5 percent of the shortest side or larger (54 px on 1080); 3 layouts only: statement, figure and caption, number | A fourth layout only for a recurring series with its own name |
| Email and newsletter | 600 px single column, system font stack with the brand face as progressive enhancement, one column, plain-text version written first, 16 px body, 44 px buttons, under 102 KB of HTML | Two columns never; a 640 px column when the platform forces it |
| Print | Business card 85 x 55 mm; A4 or Letter documents; A2 posters; 3 mm bleed; 300 dpi; CMYK conversion checked on a proof; uncoated 350 gsm card, 120 gsm document, 170 gsm silk poster | Pantone spot for the accent when the budget allows; US card 88.9 x 50.8 mm for a US client |
| App icons and favicons | 1024 px master, no text, one shape, one hue, tested at 16 px; Android adaptive icon with the mark inside the 66 dp safe circle | A monogram when the symbol fails the 16 px test |
| Signage and merch | One-colour version required first; cap height 25 mm per 3 m of viewing distance; embroidery at 6 mm minimum detail | Full colour on printed banners only |
| Pitch and case-study page | Structure from the layout desk's case-study region table (`../layout/references/sections.md`, section 15); copy structure from the words desk (`../words/PLAYBOOK.md`, section 4.5); rule 16 below is the summary | None |
| Brand guidelines | 12 sections, 20 to 40 pages, PDF plus a live tokens page that engineering reads | A 4-page "brand sheet" for a pre-seed company, with the same 12 headings |

### 3.8 Rollout and measurement

Rollout order, three waves; nothing in wave 2 ships before wave 1 is complete. `[house]`

| Wave | Ships | Why first |
|---|---|---|
| 1 | Site, sales deck, social avatars and headers, email signature, OG image | The surfaces a prospect sees in the first hour |
| 2 | Newsletter template, social post templates, business cards, app icon and favicon, pitch deck | Recurring surfaces; templates stop drift |
| 3 | Signage, merch, packaging, printed guidelines, event stands | Slow, expensive, changed last |

Measurement: a brand launch is judged on three numbers with a baseline from `brief.md`: traffic (sessions in the first 7 days against the prior 7; otherkind's Cloudflare Workers refresh reported 4.26M visits in week one), recall (a 5-second test with 20 respondents: unaided recall of the name and one attribute, target 60 percent or more), and the consistency audit score (section 7, target 45 of 50 or more across 5 touchpoints). `[source: otherkind.design; house thresholds]`

## 4. Rules

1. Positioning before pixels. No mark, type or colour decision until section 3.1 exists. `[source: Neumeier, 2003]`
2. A brand is what they say it is, not what you say it is; the tone words are tested on strangers in the recall test, not asserted. `[source: Neumeier, 2003]`
3. Different beats better: if the competitor map shows a neighbour within 20 percent on both axes, the positioning changes, not the logo. `[source: Neumeier, 2006]`
4. Strategy, story, idea, design, implementation, in that order, with a half step of engagement between story and idea; skipping to design produces a mood board. `[source: Johnson, 2016]`
5. One idea carries the identity; it is the same one idea as `concept.md`. The mark, the type and the colour each express it once. `[source: Bierut; house]`
6. The mark ships a single-colour version first; colour is applied, never baked in. `[source: illustration desk rule 15; house]`
7. Clear space equals the wordmark's x-height on every side; minimum sizes are 24 px and 8 mm for lockups, 16 px and 6 mm for the mark alone. Below those, the mark is omitted, not shrunk. `[house]`
8. Two families maximum plus an optional mono; one brand size for display; the same weight and tracking at that size on every surface. `[source: typography desk rules 3 and 5]`
9. One hue, one accent at 10 percent of area or less, hue-shifted neutrals; every text pair measured. Print builds recorded beside screen values. `[source: colour desk rules 1 to 5]`
10. The design language has 8 to 12 rows; each row is a number or a name. If a row has an adjective, replace it or delete it. `[house]`
11. One idea per slide: if the slide needs a second heading, it is two slides. Glance test: the point of the slide is read in 3 seconds. `[source: Duarte, 2008]`
12. Slides: 24 pt minimum for every text including footers; titles 48 to 64 pt; 30 words maximum; one figure per slide; the figure is a real capture, a diagram in the brand's line style, or a number. `[source: Duarte, 2008; Kawasaki 10/20/30 for the minimum size; house numbers]`
13. Social text is 5 percent of the shortest side or larger and sits inside the platform's safe area; a post that needs the caption to be understood is a caption, not a graphic. `[source: Instagram, X, LinkedIn size docs; house threshold]`
14. Email is plain-text first: the HTML version is written after the plain-text version says everything, and it ships with a `text/plain` alternative. Copy shape per `../words/PLAYBOOK.md` section 4.6. `[house]`
15. Print: 3 mm bleed, 3 mm safety inside the trim, 300 dpi at final size, black text as 100 K not rich black under 12 pt, rich black (60 40 40 100) for areas over 25 mm, total ink under 300 percent. `[source: Moo; Vistaprint; house]`
16. Pitch and case-study copy: brief in the client's words in 80 words or fewer, 2 to 4 measured outcomes with dates, images with 15-word captions, one next link; no "Challenge, Solution, Results" headings. `[source: layout desk section 15; house]`
17. App icons: 1024 px master, no text, no transparency on iOS, no rounded corners drawn in (the platform masks); the symbol reads at 16 px in greyscale. `[source: Apple HIG App Icons; Android adaptive icons]`
18. Every surface in wave 1 ships with a template, not a one-off file. A one-off becomes the template the next person copies. `[house]`
19. Guidelines state minimum sizes, clear space, misuse examples and the tokens; guidelines that only show the mark on white are incomplete. `[source: Johnson, 2016; Brand New review conventions]`
20. The consistency audit runs before launch and 90 days after; a score under 45 of 50 opens a new brief. `[house]`

## 5. Defaults

Positioning block, copy and fill:

```markdown
For [who] who [need], [brand] is the [category] that [difference].
Tone: [word], not [word] · [word], not [word] · [word], not [word]
Forbidden: [word]
Map: x = [attribute A] to [attribute B] · y = [attribute C] to [attribute D]
[Competitor 1] (x, y) · [2] · [3] · [4] · [5] · [6] · [brand] (x, y)
```

Asset kit structure (folder names are lowercase, files are `brand-<lockup>-<colour>-<size>.<ext>`):

```
brand/
├── mark/
│   ├── svg/        brand-horizontal-colour.svg  brand-horizontal-mono.svg  brand-stacked-colour.svg  brand-mark-mono.svg  brand-mark-16.svg
│   └── png/        brand-horizontal-colour-1024.png  brand-mark-mono-512.png  (1x and 2x, transparent)
├── type/           licence.pdf  brand-display.woff2  brand-text.woff2  brand-mono.woff2  fallback-stack.txt
├── colour/         tokens.css  tokens.json  print.md (CMYK and Pantone beside every hex)
├── templates/
│   ├── deck/       brand-deck-light.key  brand-deck-light.pptx  brand-deck-light.gslides.url
│   ├── social/     1080x1080.fig  1080x1350.fig  1080x1920.fig  og-1200x630.fig  x-1500x500.fig  linkedin-1584x396.fig
│   └── print/      card-85x55.pdf  a4.indd  letter.indd  poster-a2.indd
├── icons/          app-icon-1024.png  adaptive-fg.svg  adaptive-bg.svg  favicon.svg  favicon.ico  apple-touch-icon-180.png
└── guidelines.pdf  design-language.md
```

Brand block for `tokens.css` (the colour and type desks fill the formulas; this desk fixes the names):

```css
:root {
  --hue: 45;                                   /* the one hue; colour desk caps chroma per hue */
  --brand-accent: oklch(0.62 0.14 var(--hue)); /* signal only: primary action, one word, the mark */
  --brand-ink: oklch(0.20 0.012 var(--hue));
  --brand-canvas: oklch(0.985 0.004 var(--hue));
  --font-display: "Inter Tight", var(--font-sans);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --brand-size: 96px;                          /* the display size the brand is known at */
  --brand-tracking: -0.02em;
  --mark-clear: 1ex;                           /* clear space = x-height */
  --mark-min: 24px;
}
```

Deck defaults: 1920 x 1080; margins 96 px; 12 columns of 122 px with 24 px gutters (column n starts at 96 + 146 (n - 1) px); title 56 pt at y 96; body 28 pt, line-height 40 px; footer 24 pt at y 1000; slide positions per template in `references/surfaces.md`, section 3.

Guidelines structure, 12 sections in order: 1 Positioning and tone. 2 The idea. 3 The mark and lockups. 4 Clear space, minimum sizes, misuse. 5 Typography and the brand size. 6 Colour with screen and print values. 7 The design language table. 8 Photography and illustration. 9 Motion dialect. 10 Applications with one example each. 11 Asset kit and tokens page. 12 Contacts and version. `[house]`

## 6. Anti-patterns

| Slop | Why it fails | Fix |
|---|---|---|
| Lettermark in a gradient circle | The default of every logo generator since 2016; indistinguishable at 16 px from 10,000 others | Wordmark only (3.3 default), or a monogram in one flat colour with a silhouette that survives the 32 px squint test |
| Blue-to-purple SaaS gradient brand | Hue 250 to 280 gradient is the AI-landing-page default; no colour is the brand colour | One hue, flat; a lit material only per the colour desk's gradient row |
| "Inter and a blue" identity | Every default of every framework; the brand disappears into the tooling | Inter may stay as text; add a display or mono voice with a brand size and tracking, and move the hue off 220 to 260 or tint the neutrals so the blue is specific |
| Corporate Memphis illustration | Purple noodle people mean "we bought an illustration pack" | Pick a style row in the illustration desk's 3.2 on purpose; line diagrams or photography for technical brands |
| Mood board as brand | Adjectives and other people's work; nothing to hand to a desk | Section 3.1 page plus the 8 to 12 row design language table; if a row cannot be written, the brand is not decided |
| Guidelines with no minimum sizes | The mark shrinks to 40 px on a footer and 4 mm on a pen | Rule 7 table in section 3.3, with misuse examples |
| Five accents | No colour means anything; every touchpoint picks a different one | One accent at 10 percent; categories carry hue only when the user must recall it |
| Logo with text under 8 px (or 3 mm) | Illegible; the wordmark becomes a grey bar | Drop to the mark-only lockup at 16 px; omit under the minimum |
| Deck with 80-word slides and stock photographs | Read aloud by the presenter; nothing is remembered | Rule 11 and 12: 30 words, one figure, real captures |
| Brand that only works on white | The mark vanishes on a photograph, a dark keynote, a black T-shirt | Colour proof on white, black and 3 photographs (3.5); one-colour and reversed versions in the kit |
| Trend faces as the brand voice (Space Grotesk, Clash Display, Instrument Serif alone) | Reads as the year it was made | A face from the catalogue with a written reason; the brand size and tracking do more than the family |
| Dynamic identity where the name moves | Nobody can recall a name that never looks the same | Fixed wordmark; the variable element is a shape, a rule or a colour |

## 7. Hand-off artefact

The brand sheet: one file, `brand/design-language.md`, with these tables in order; every downstream desk reads it before its own playbook.

```markdown
## Brand sheet: <brand>
Positioning: For ... who ..., <brand> is the ... that ...
Tone: ..., not ... · ..., not ... · ..., not ...   Forbidden: ...
Direction: <row from directions.md> with <mechanisms borrowed>
Mark: <wordmark only | monogram | symbol + wordmark | dynamic> · clear space 1 x-height · min 24 px / 8 mm (mark alone 16 px / 6 mm)
Type: display <family> at <brand size> <tracking> · text <family> · data <family or none> · licence <OFL | Fontshare | EULA, tier>
Colour: hue <n> · accent oklch(...) hex #... CMYK ... Pantone ... · proof on white <ratio>, black <ratio>, photo 1 to 3 <ratios>

| Design language rule | Value |
|---|---|
| Shape language | ... |   (8 to 12 rows, per 3.6)

| Surface | Template file | Spec row in references/surfaces.md | Owner | Wave |
|---|---|---|---|---|
| Sales deck | brand/templates/deck/brand-deck-light.key | Deck | ... | 1 |

Measurement: traffic baseline ... · recall target 60 percent · consistency target 45/50
```

Consistency audit, run on 5 touchpoints (default: site home, sales deck slide 3, latest social post, newsletter, business card). Score each item 1 (pass) or 0 (fail) per touchpoint; 50 is the maximum, 45 ships.

| # | Item | Checks |
|---|---|---|
| 1 | Mark | Correct lockup for the space; clear space at least 1 x-height; at or above minimum size |
| 2 | Mark colour | Single-colour or full-colour version as the kit specifies; no recolouring |
| 3 | Display face | The brand display family at the brand size with the brand tracking |
| 4 | Text face | The brand text family; system fallback only where the surface spec allows |
| 5 | Hue | The one hue; accent on 10 percent of the area or less |
| 6 | Neutrals | Hue-shifted neutrals; no `#000` or `#fff` surface except paper |
| 7 | Shape and stroke | Radius set and stroke weights from the design language table |
| 8 | Imagery | Photo or illustration treatment from the table; no stock, no Corporate Memphis |
| 9 | Copy tone | Sentence case, the three tone words visible, the forbidden word absent |
| 10 | Minimums | Text at or above the surface's minimum; inside the safe area |

## 8. Checklist (five minutes)

- [ ] Positioning sentence exists, 25 words or fewer, and no competitor could sign it?
- [ ] 3 tone words each with a "not", and 1 forbidden word, on the sheet?
- [ ] Competitor map has 2 named axes and 6 competitors; the brand is 20 percent clear of the nearest?
- [ ] Direction chosen from the catalogue and named on the sheet?
- [ ] Mark row chosen (3.3); illustration desk briefed; single-colour version, 16 px cut, lockups and minimums exist?
- [ ] 2 families or fewer plus optional mono; brand size and tracking written; licence checked for web, desktop, app?
- [ ] One hue, one accent; colour proof measured on white, black and 3 photographs; CMYK and Pantone recorded?
- [ ] Design language table has 8 to 12 rows and no adjectives?
- [ ] Every surface on the job has a row in `references/surfaces.md` and a template file in the kit?
- [ ] Deck template: 24 pt minimum, 30 words maximum, one theme, six slide types?
- [ ] Social: 3 layouts, text at 54 px or larger on 1080, inside safe areas?
- [ ] Wave 1 list complete; measurement baselines and targets on the sheet?
- [ ] Consistency audit scored on 5 touchpoints; 45 of 50 or more?

## 9. Sources

Strategy and method
- Neumeier, Marty. The Brand Gap, 2003, and Zag, 2006 (a brand is a person's gut feeling; differentiation over better; the onliness statement). https://www.martyneumeier.com/
- Johnson, Michael. Branding: In Five and a Half Steps, Thames and Hudson, 2016 (investigate, strategy, the bridge, design, implement, engage). https://johnsonbanks.co.uk/thoughts/branding-in-five-and-a-half-steps
- Bierut, Michael. How To, Pentagram (one idea; style as residue). https://www.pentagram.com/work/how-to

Mechanism references (case studies)
- Pentagram, work: https://www.pentagram.com/work
- COLLINS, work and 101 Design Rules: https://wearecollins.com/work/ ; https://wearecollins.com/story/101-design-rules/
- Koto, work: https://koto.com/work/
- otherkind, Cloudflare Workers Platform (brand refresh, expressive and technical design language, unified narrative across compute, storage and AI; 4.26M visits in week one): https://www.otherkind.design/projects?project=cloudflare
- Brand New, Under Consideration (review conventions: before and after, lockups, applications, the mark at small size): https://www.underconsideration.com/brandnew/

Decks
- Duarte, Nancy. slide:ology, 2008 (one idea per slide, the glance test). https://www.duarte.com/resources/books/slideology/
- Kawasaki, Guy. The 10/20/30 rule (30 pt minimum). https://guykawasaki.com/the_102030_rule/
- Apple Keynote user guide: https://support.apple.com/guide/keynote/welcome/mac ; Google Slides help: https://support.google.com/docs/topic/9052835

Social and OG
- Instagram help, image ratios and sizes: https://help.instagram.com/1631821640426723
- X help, profile and header images: https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo
- LinkedIn help, image specifications: https://www.linkedin.com/help/linkedin/answer/a563309
- The Open Graph protocol: https://ogp.me/

Icons
- Apple Human Interface Guidelines, App icons: https://developer.apple.com/design/human-interface-guidelines/app-icons
- Android developers, Adaptive icons (108 dp canvas, 66 dp safe zone): https://developer.android.com/develop/ui/views/launch/icon_design_adaptive
- Google Search Central, favicon guidelines: https://developers.google.com/search/docs/appearance/favicon-in-search

Print
- ISO 216:2007, paper sizes (A and B series): https://www.iso.org/standard/36631.html
- Moo, business card design guidelines and resolution guide (300 dpi, vector PDF, bleed and safe area): https://www.moo.com/us/business-cards/design-guidelines ; https://support.moo.com/hc/en-gb/articles/202941330-Image-resolution-and-file-size-guidelines-for-uploading-designs
- Vistaprint, prepress checklist and crop marks and bleed explained (0.125 in or 3 mm bleed, safe zone, CMYK, 300 dpi): https://www.vistaprint.com/hub/prepress-checklist ; https://www.vistaprint.com/hub/crop-marks-explained

Type licensing and trademark
- SIL Open Font License 1.1: https://openfontlicense.org/ ; Google Fonts, licensing: https://fonts.google.com/knowledge/glossary/licensing
- Fontshare, ITF Free Font Licence: https://www.fontshare.com/licenses/itf-ffl
- USPTO, trademark search: https://www.uspto.gov/trademarks/search ; WIPO Global Brand Database: https://branddb.wipo.int/
- Email column width and Gmail clipping at 102 KB: https://www.litmus.com/blog/the-ultimate-guide-to-email-design ; surface specs: `references/surfaces.md`.
