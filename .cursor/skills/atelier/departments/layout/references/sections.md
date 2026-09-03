# Section library

A catalogue of section variants for marketing, brand, portfolio and product-landing sites. The layout desk picks one variant per section from the "when" column, records it in the layout spec (`../PLAYBOOK.md` section 7) with the next candidate named, and hands typography, colour, motion and engineering a fixed box to fill. Every value here is a default; the brief may override with a written reason.

How to use it:

1. Take the content inventory from strategy (which sections exist, how many items each holds) and the direction from `concept.md`.
2. For each section type, read the rows top to bottom; the first row whose "when" matches the product type, tone words and content volume is the default. Rows are ordered from quietest to most expressive.
3. Check the variant's "suits" column against the direction. A variant that does not list the direction needs a one-line reason in the layout spec.
4. When the client rejects a variant, present the next row (or the rejection ladder in section 19). Never decorate the rejected one: no added gradient, icon, badge or animation makes a rejected variant acceptable, and each of those is a slop hit (`../../direction/references/slop-catalogue.md`).
5. A page has one hero, at most one eyebrow, at most one dark or inverted band, at most one set piece, and one CTA band. Exceeding any of these is a finding. `[house]`

Direction keys used in the "suits" column: QE Quiet editorial, SM Studio mono, SG Swiss grid, VI Vitrine, WA Warm analogue, LD Luxe dark, CL Character-led, CS Cinematic scroll, TD Tool density, HB Honest brutalist (`../../direction/references/directions.md`).

## 1. Shared defaults

Rows below state only what differs from these. `[house; grid from ../PLAYBOOK.md rule 29; rhythm from rule 7; measure from Butterick and Bringhurst]`

| Property | Default |
|---|---|
| Grid at 1440 | 12 columns, gutter `--space-5` (24 px), content max 80 rem (1280 px) centred, page margin `--page-margin` |
| Grid at 768 | 8 columns, gutter `--space-5` (24 px), page margin `--space-5` |
| Grid at 390 | 4 columns, gutter `--space-4` (16 px), page margin `--space-4`; everything stacks in source order |
| Vertical rhythm | Section padding-block `--space-9` (96 px) at 64 rem and wider, `--space-8` (64 px) below; group gap `--space-6` (32 px); element gap `--space-2` to `--space-4` |
| Section heading | One `<h2>` ≤ 6 words, left-aligned, weight and size from the type scale; no eyebrow unless the hero variant owns the page's one eyebrow |
| Word counts | Headline ≤ 8 words; deck ≤ 25; feature blurb ≤ 20; quote ≤ 40; bio ≤ 40; button label ≤ 3; caption ≤ 15 |
| Image ratios | Pick from 16:9 (1.78), 3:2 (1.50), 4:3 (1.33), 16:10 (1.60), 1:1, 4:5 (0.80); one ratio per section, at most two per page; always `aspect-ratio` set so CLS stays under 0.1 |
| Image treatment | Uncropped, no filter, no duotone; radius `--r-0` when the image touches a viewport edge, `--r-3` in a grid, `--r-4` when it is the stage |
| Image weight | Hero image ≤ 200 KB, preloaded, `fetchpriority="high"`, never lazy; every other image `loading="lazy"`, ≤ 300 KB, AVIF or WebP with a 2× source |
| Motion | The entrance from `../../motion/PLAYBOOK.md` (one fade-and-rise, ≤ 5 staggered items) and nothing else; a row saying "hand off" means the section needs a motion or creative-web spec before build |
| Hover | Colour or underline change only; no lift, tilt, zoom or shadow growth (slop #39) |
| Control layer | Only navigation lives in `--z-control`; every section below is content in `--z-content` |

## 2. Navigation

| Variant | Description and when | Grid and rhythm | Content | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Hairline bar | Full-width bar with a 1 px rule beneath; the default. Product landing, docs marketing, most sites; "precise", "calm"; 3 to 5 destinations | Inner max 80 rem; height 56 px desktop, 48 px at 390; padding-block `--space-3`; link gap `--space-6`; static, or sticky with a solid fill when the page has more than 5 sections | Wordmark, ≤ 5 links, 1 button | None | QE, SG, TD, LD, WA | Glass with nothing scrolling beneath (#13); 2 buttons; a hamburger at 1440; sticky bar taller than 64 px |
| Pill-in-canvas | One floating capsule in the control layer. Consumer product, app landing; "fluid", "Apple"; 3 to 4 destinations | Inset `--space-4` from the top, centred, `--r-pill`, height 48 to 56 px, max width 40 rem; padding-inline `--space-5` | Wordmark, 3 to 4 links, 1 capsule button | Glass allowed only once content scrolls beneath; morphs in place, never jumps (`../PLAYBOOK.md` rule 35) | VI, CL | Glass on glass; a second floating bar; pill wider than 40 rem; blur under 12 px text |
| Sidebar index | Fixed left rail listing the page's sections or routes with tabular index numbers. Portfolio, long single page with ≥ 6 sections, docs marketing; "precise", "index" | `grid-template-columns: 16rem minmax(0, 1fr)` at 64 rem and wider; collapses to a hairline bar below; rail padding `--space-6`; row padding-block `--space-2` | Wordmark, 5 to 12 rows, one contact link at the bottom | Current row indicated by weight, 150 ms | SG, SM, TD | A rail with fewer than 5 rows; rail wider than the content column at 768; rail as a second column of prose |
| Hidden-until-scroll | No bar at load; the hero owns the viewport; a hairline bar appears after 100 vh of scroll. Brand launch, campaign; "immersive"; ≤ 4 destinations | As hairline bar once shown; wordmark alone stays visible top-left at load | Wordmark at load; bar contents as hairline | Bar translates in over 200 ms ease-out; never hides again on scroll down; renders static without JS | CS, LD | Hiding on scroll-down as well; no fallback without JS; a hero with no wordmark |
| Wordmark-only | Wordmark top-left, one link top-right (contact or email); the footer carries every route. Studio, small portfolio, ≤ 3 pages; "straightforward", "raw" | Padding `--space-5`; no rule; not sticky | Wordmark, 1 link | None | SM, HB, QE | Adding a hamburger "just in case"; a wordmark in a stock display face (#34); footer that omits routes |

## 3. Hero

Rules for every hero: the group (figure, headline, primary control) fills 55 to 70 percent of viewport height at 1440 and 60 to 75 percent at 390, never a fixed `100vh` (`../PLAYBOOK.md` rules 30 and 41); headline ≤ 8 words as one `<h1>`; deck ≤ 25 words; at most 1 primary button plus 1 text link; the hero image or poster is the LCP element and must render under 2.5 s on a mid-range phone `[source: web.dev LCP]`; the eyebrow, if any, is the page's only one (#1). `[house]`

| Variant | Description and when | Grid and rhythm | Content and images | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Statement | One line of display type, nothing else. Studio, manifesto, publication; "calm", "confident"; the page below carries the proof | Span 12 columns left-aligned (or centred as the one short-line exception, #26); min-height 70 vh; type `clamp(2.5rem, 1.2rem + 5.5vw, 6rem)`; padding-block `--space-9` | 3 to 8 words; no deck, no button; no image | Editorial fade or none | QE, SM, HB, SG | A line that says nothing (#46); a button added beneath (that is the editorial variant); hanging punctuation forgotten |
| Split | Type left, artefact right. Product landing, tool, app; "clear", "useful"; there is one real screenshot or object | Type spans columns 1 to 6, artefact 7 to 12 at 64 rem and wider; both align to the top edge, not the vertical centre; stacked type-first at 768 and 390 | Headline, deck, 1 button, 1 link; artefact 3:2 or 4:5 real UI at `--r-3` | Entrance only | TD, SG, VI, WA | Fake 3D or chat mock-up artefact (#49, #52); artefact taller than the type block by more than 2×; centring type against a tall image |
| Vitrine | Product framed in a rounded stage. Consumer app with a stage object; "fluid", "tactile" | Stage `--r-4` on `--surface-2`, 40 to 55 vh tall, spans 10 of 12 columns centred; figure overlaps the stage edge by 10 to 20 percent; headline within one line-height beneath; control capsule ≤ 48 px below (`../PLAYBOOK.md` rules 30 and 31) | Headline ≤ 6 words, 1 capsule control; figure PNG or SVG with transparent ground | Spring on the control, stage object may react once; hand off | VI, CL | Glass on the stage; stage smaller than its controls; a screenshot inside a stage (use split) |
| Editorial | Kicker, headline, deck, one image. Publication, agency, product with a story; "trust", "considered" | Type in columns 1 to 8 left-aligned; image spans 12 beneath at 16:9 or 3:2, `--r-0` if it touches the margins, else `--r-3`; gap `--space-7` type to image | Kicker ≤ 4 words 14 px (the page's one eyebrow), headline, deck, 1 button optional | Entrance only | QE, WA, SG | Eyebrow repeated on later sections (#1); centred deck; stock photograph |
| Full-bleed image with type overlay | Photograph fills the viewport width; type sits on it. Luxury, brand, place; "cinematic", "lit"; one photograph that is the argument | Image `aspect-ratio` 16:9 at 64 rem and wider, 4:5 at 390 via `<picture>`; type block in columns 1 to 6, anchored bottom-left with inset `--space-8`; type ≥ 40 px | Headline, deck ≤ 15 words, 1 button; text contrast ≥ 4.5:1 measured against the image region under the text box; if it fails, a flat one-colour scrim at ≤ 40 percent alpha behind the block, never a gradient (#11); no text over faces | Image reveals from scale 1.02 to 1.0 over 600 ms; otherwise none | LD, CS, WA | Gradient scrim; text centred over the subject; image without `aspect-ratio` (CLS); type under 4.5:1 |
| Interactive set piece | One idea, one object, made in code. Studio, character product, launch; "crafted", "playful" | Stage 50 to 60 vh spanning 12 columns; headline within one line-height beneath; a static poster frame reserved at the same size | Headline ≤ 6 words; the object; one reset or hint affordance that appears after first touch | Hand off to `../../creative-web/PLAYBOOK.md`; reduced motion shows the still frame | SM, CL, CS, VI | Two ideas; a set piece that hides the CTA; no still frame; runs over 8 ms per frame on the main thread |
| Type-only stacked with numeral index | 3 to 5 display lines, each prefixed with a tabular numeral, each a link to a section; the hero is the page's table of contents. Portfolio, exhibition, institutional; "precise", "indexed" | Numerals in column 1 at 14 px mono, lines in columns 2 to 11; line gap `--space-4`; type `clamp(2rem, 1rem + 4vw, 4.5rem)` | 3 to 5 lines ≤ 5 words each; no deck; no image | Underline on hover, 150 ms | SG, HB, SM | More than 5 lines; proportional numerals; lines that are not links; a button beneath |
| Video loop with poster | Silent looping video with a poster as LCP. Launch, hardware, motion-led brand; "immersive" | 16:9 spanning 12 columns, `--r-0`; type beneath in columns 1 to 8, or overlaid by the full-bleed rules | `<video muted autoplay loop playsinline poster>`, 6 to 12 s loop, ≤ 3 MB, no audio track; visible pause control 44 px in the corner; poster ≤ 200 KB | Video pauses under `prefers-reduced-motion` and when off-screen; hand off for anything scroll-driven | CS, LD | Sound; a visible loop seam; video where a still would do; poster missing so the LCP is the first frame |

## 4. Proof

| Variant | Description and when | Grid and rhythm | Content and images | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Logo strip | One static row of client or press logos. Any product with 5 to 7 real, recognisable names | Padding-block `--space-7`; `justify-content: space-between` at 64 rem and wider; 2 rows of 3 or 4 with gap `--space-5` at 390 | 5 to 7 logos, monochrome in one ink (text colour at alpha 0.6 or L 0.45), normalised to equal optical size by cap height 24 to 32 px, not equal boxes; optional label "Used by" 14 px; no count ("Trusted by 10,000+", #9) | None; no carousel (#42; NN/g: auto-forwarding content is ignored) | QE, SG, VI, TD, LD, WA, CS | Carousel; colour logos; 12 logos; one logo visibly heavier; logos as links to nowhere |
| Numbers row | 3 to 4 measured facts with sources. Engineering, infrastructure, hardware, launch; "proven" | 3 or 4 equal columns at 64 rem and wider, 2 at 768, 1 stacked at 390; gap `--space-6` | Numeral 49 to 61 px in tabular figures, label ≤ 4 words 14 px, source and date in `<small>`; real nouns ("4,210 teams", not "10k+") | None; no counters from zero (#41) | SG, TD, LD, CS | Unverifiable numbers; counters; "+" rounding; 6 numbers |
| Quote | One quotation in display type. Studio, editorial, luxury; when one named person carries more than a logo | Measure ≤ 40 ch in columns 1 to 8; padding-block `--space-8` | ≤ 40 words, italic serif in QE and WA; attribution name, role, company at 14 px; optional 1:1 photograph 48 px `--r-pill` | Entrance only | QE, WA, LD, SM | Stars (#56); two quotes here (see testimonials); anonymous attribution |

## 5. Features

| Variant | Description and when | Grid and rhythm | Content and images | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Numbered list | Rows with a numeral, heading and blurb, separated by 1 px rules. Any product; 4 to 8 features of equal weight; "straightforward" | Numeral column 1, heading columns 2 to 5, blurb 6 to 11 at 64 rem and wider; stacked at 390; row padding-block `--space-5` | Numeral 01 to 08 tabular; heading ≤ 6 words; blurb ≤ 20 words; no images | None | SM, SG, QE, HB, TD | Icons per row (#4, #31); "Learn more" arrows; more than 8 rows (split the section) |
| Bento | Cells of unequal size with one hero cell. Consumer app, tool with one headline capability; "fluid", "system"; 4 to 6 features with artefacts | Max 6 cells; at 64 rem and wider a 4-column grid with the hero cell spanning 2 columns by 2 rows, others 1 by 1; 2 columns at 768; 1 column at 390 with the hero first; gap `--space-4`; cell padding `--space-5`; radius `--r-3`; nested media radius `--r-3` minus padding | Each cell: heading ≤ 6 words, blurb ≤ 20, one artefact (screenshot crop at 16:10 or one number); cell surface `--surface-2` solid; no gradient cells (#11); no icon in a coloured circle (#4) | Entrance only; no hover lift | VI, TD, CL | Equal boxes (#24); more than 6 cells; text-only cells (use the list); a cell with a gradient or glow (#12) |
| Alternating rows | Type and image alternate sides, one feature per row. SaaS, hardware, education; 2 to 3 features that each need a picture | Max 3 rows; type in 5 columns, image in 7, sides alternate at 64 rem and wider; at 390 image-first then type, same order every row; row gap `--space-9` | Heading ≤ 6 words, blurb ≤ 40 words (two blurbs), 1 text link; image 16:10 or 4:3 uncropped UI at `--r-3` | Entrance only | TD, WA, VI, QE | 6 rows; mixed image ratios; zigzag order on mobile; a button in every row |
| Table for tools | A feature matrix. Developer tools, infrastructure, comparisons; when items have more than 5 attributes | `<table>` spanning 12 columns; first column 30 percent; sticky header at 64 rem and wider; stacked definition lists below 40 rem; cell padding `--space-3` `--space-4` | ≤ 12 rows; "Yes" or "No" as text, or one glyph with `aria-label`; tabular figures; 1 px rules | None | TD, SG, HB | Ticks in coloured circles; a table built from `<div>`s; horizontal scroll with no indication |
| Tabbed demo | Tabs select one screenshot on a stage. Tool with 3 to 5 modes; "show, don't tell" | Tabs in columns 1 to 4 as a vertical list (horizontal row at 390), stage in columns 5 to 12 at 16:10, `--r-3`, height reserved so tabs never shift | 3 to 5 tabs ≤ 4 words with blurb ≤ 20 words; real UI, one state per tab | Crossfade 200 ms; no auto-advance by default (NN/g); if the brief insists, 6 s, stops on hover and under reduced motion | TD, VI | Auto-cycling; tabs as 5 coloured pills (#10); stage height changing per tab |

## 6. How it works

| Variant | Description and when | Grid and rhythm | Content and images | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Horizontal rail | 3 to 4 steps in a row joined by a 1 px rule behind the numerals. Product with a short setup; "simple", "fast" | 3 or 4 equal columns at 64 rem and wider; vertical timeline below; gap `--space-6` | Numeral, heading ≤ 5 words with exactly one verb, blurb ≤ 20; no images, or one 1:1 glyph per step from a single set | None | TD, SG, VI | Icons in tinted squares (#4); animated dashed connectors; 5 steps (use the timeline) |
| Vertical timeline | 3 to 6 steps down the page with a 1 px vertical rule. Onboarding, service process, story; "guided" | Numeral column 1, rule in the gutter, content columns 2 to 8; optional screenshot columns 9 to 12 at 16:10; step gap `--space-7` | As rail; ≤ 6 steps or split into two sections | Entrance per step; scroll-driven reveal only in CS, hand off | QE, WA, CS, CL | Progress that animates as the user scrolls in non-CS directions (#39); more than 6 steps; steps without a verb |

## 7. Product tour and screenshots

Rules: the screenshot is the object and gets no device frame by default; a browser frame, when the context needs it, is a 1 px hairline rule with 3 dots at 8 px in `--text-3` and no address text; a mobile screenshot sits in a 9:19.5 rounded rectangle at `--r-4` with no bezel; real UI in one high-fidelity state, never a chat-bubble mock-up (#49); 2× source, ≤ 300 KB, lazy below the fold. `[house; Linear release pages as mechanism]`

| Variant | Description and when | Grid and rhythm | Content and images | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Single screenshot | One large capture with a caption. Tool, dashboard; "here it is" | Columns 2 to 11 centred (or 12 full) at 16:10, `--r-3`, 1 px border at 3:1 | Caption ≤ 15 words left-aligned to the image edge | None | TD, SG, VI | 3D tilt; 40 px drop shadow; a frame from three device generations |
| Screenshot pair | Two states or two surfaces side by side. Before and after, desktop and mobile | Two columns of 6 at 64 rem and wider, stacked at 390; gap `--space-5`; the same ratio for both | Two captions; states labelled | None | TD, SG | Different ratios; arrows between the two; "before" in red |

## 8. Team

| Variant | Description and when | Grid and rhythm | Content and images | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Grid with equal crops | Portraits in a grid, one crop for all. Studio, product team of 4 to 16; "we are people" | 4 columns at 64 rem and wider, 3 at 768, 2 at 390 (as otherkind.design's 2-up); gap `--space-5`; card radius `--r-3` | 4:5 portrait, eyes at 40 percent of height, one background treatment; name 16 px, role 14 px `--text-2` beneath | None on hover | SM, VI, WA, CL | Circular crops with coloured rings; one portrait 2× the others; social icons in circles |
| List with roles | Names left, roles right, 1 px rules, no photographs. Studio, consultancy, any team over 16 or camera-shy; "flat" | Rows spanning columns 1 to 8; `justify-content: space-between`; row padding-block `--space-2` | Name, role; optional location in mono | None | SM, SG, HB, TD | Adding avatars later; roles in Title Case (#47) |
| Editorial portraits one per row | One portrait beside one bio per person. Founders, partners, ≤ 6 people; "editorial" | Portrait columns 1 to 5 at 3:2 or 4:5, bio columns 7 to 12; row gap `--space-8`; stacked at 390 | Bio ≤ 40 words; name as `<h3>` | Entrance only | QE, WA, LD | Bios over 40 words; alternating sides (keep one side) |
| Names only typographic | Names at display size as a poster; roles small beside. Collective, agency, launch credits; "raw", "proud" | Columns 1 to 12; line gap `--space-3`; names `clamp(1.75rem, 1rem + 3vw, 3.5rem)` | Name, role in 14 px mono | None | HB, SG, SM | More than 20 names at display size; names as links to nothing |
| Group photograph plus list | One photograph of everyone, then a list. Small studio, shop, restaurant; "together" | Photograph spans 12 at 3:2, `--r-0` or `--r-3`; list-with-roles beneath, gap `--space-7` | One photograph; list as above | None | WA, QE, CS | Stock group shot; a second photograph per person |

Rules for team sections: one lens, one distance, one background per page (a flat tone or all on the canvas; never studio and outdoor mixed); illustrated portraits are acceptable when every portrait is illustrated in one style (otherkind.design's pixel-art figures); hover does nothing, or reveals the role, never zooms. Bios: ≤ 40 words, third person, the same structure for everyone (what they do here, one prior fact), no adjectives about passion, no job-title jokes. `[house]`

## 9. Testimonials

| Variant | Description and when | Grid and rhythm | Content and images | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Single large quote | The proof quote (section 4) placed lower on the page. One named person at a named company; the default when a quote exists | Measure ≤ 40 ch, columns 1 to 8; padding-block `--space-8` | ≤ 40 words; attribution 14 px; one per page | Entrance only | QE, WA, LD, SM | Stars (#56); a second quote beside it |
| Two-column quotes | 2 or 4 shorter quotes in two columns, 1 px rule above each, no cards. SaaS, tools; 2 to 4 named customers | Two columns of 6 at 64 rem and wider, 1 at 390; gap `--space-6` | ≤ 30 words each at 16 to 18 px; attribution 14 px; no photographs, or 1:1 at 40 px | None | SG, TD, VI | Avatar grids; carousel (#42); cards with shadows (#18); "John D., CEO" |
| None | Ship no testimonials. Portfolios, brand launches, and any product whose quotes are not from named people at named companies | n/a | The work and the numbers row carry proof | n/a | All | Inventing a quote; a "wall of love" from social posts |

## 10. Pricing

| Variant | Description and when | Grid and rhythm | Content and images | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Tiers | 2 or 3 equal-width plans, one highlighted by weight. Self-serve product | 3 columns at 64 rem and wider (or 2), 3 narrow columns at 768, 1 at 390 with the highlighted tier first; gap `--space-5`; card padding `--space-6`, radius `--r-3`, 1 px border | Plan name 18 px weight 500; price 49 px tabular with period 14 px; ≤ 6 features as verbs; 1 button per tier; the highlighted tier uses a 2 px border in the text colour, a filled button where the others are outlined, and weight 600 on the name, never a coloured card or ribbon (#8); one plain "Recommended" label allowed | Price swap 150 ms; no layout shift (`min-width: 5ch` on the numeral) | TD, VI, SG | 4 or more tiers; colour highlight; "Custom" with no next step; crossed-out prices in red |
| Annual toggle rules | A segmented control above the tiers. Whenever billing has two periods | Centred above the tiers, gap `--space-6` beneath; 44 px tall; 2 segments | Default annual; the saving shown as an absolute amount ("save £48 a year") beside the annual label, not a slashed price; the choice persists in the URL or state; per-month price shown for both with the billing period stated | Indicator glides 200 ms | TD, VI, SG | A percent-off badge; toggle that changes card heights; monthly default with a nag |
| Feature table | The full comparison beneath the tiers. Products with more than 6 features per plan | `<table>` spanning 12 columns; sticky header row repeating plan names at 64 rem and wider; stacked per plan below 40 rem; rows grouped under a heading row | "Yes" or "No" as text, or one glyph with `aria-label`; tabular figures for limits; every fee and limit listed (no surprise at checkout) | None | TD, SG | Ticks in green circles; a table longer than 30 rows without groups; hidden fees |
| Single price or contact | One price block, or "talk to us" with an email. Studios, agencies, enterprise-only | Columns 1 to 6; padding-block `--space-8` | Price or starting price in tabular figures, what it includes in ≤ 40 words, 1 button or a mailto link | None | SM, QE, HB, LD | A form with 8 fields; "Contact sales" with no email |

## 11. FAQ

Accordion rules: native `<details>` and `<summary>`; 5 to 8 questions; default open none; items open independently; question 18 px weight 500 ≤ 12 words; answer ≤ 80 words of body text, linking to docs when longer; a chevron 16 px at the right rotates 180 degrees over 200 ms (hand off to motion); 1 px rules between items; heading level: the section carries one `<h2>` and each question is the `<summary>` text, promoted to an `<h3>` inside the summary only when the page deep-links to questions. Grid: heading in columns 1 to 4, list in columns 5 to 12 at 64 rem and wider; a single 40 rem measure column below. Suits: all directions. Pitfalls: a plus icon in a coloured circle (#4); the first item open with a planted question; questions that are marketing ("Why is X the best?"); answers over 80 words. `[house; NN/g accordions]`

## 12. CTA band

One verb, one line, no gradient: a headline ≤ 8 words containing exactly one verb, 1 primary button ≤ 3 words, optionally 1 text link. Background: the canvas, one tonal step (`--surface-2`), or the page's single inverted band (text colour as fill, canvas as text), never a gradient (#11), blob (#16) or glow (#12). Padding-block `--space-8` at 390, `--space-9` at 64 rem and wider. Grid: text in columns 1 to 8 with the button right-aligned in 9 to 12; or centred as the short-line exception when the headline is under 5 words. Motion: none. Suits: all directions. Pitfalls: two buttons of equal weight; "Get started today!"; a band after every section (one per page); a form inside the band. `[house]`

## 13. Footer

| Variant | Description and when | Grid and rhythm | Content and images | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Sitemap columns | 3 to 4 link columns with the wordmark left. Product with more than 8 routes | Wordmark and one line in columns 1 to 4; link columns of 2 each from column 5; legal row beneath, 13 px `--text-2`; 1 px rule above; padding-block `--space-8`; 2 columns at 390 | ≤ 6 links per column at 14 px; one-line description ≤ 15 words | None | TD, SG, VI | A newsletter form with no newsletter; 5 columns; social icons from 3 libraries (#54) |
| Single-line | Wordmark, links and copyright in one row. Sites with ≤ 6 routes | `justify-content: space-between`; wraps to 2 rows at 390; padding-block `--space-7` | 3 to 5 links, copyright with year | None | SM, QE, WA | A second row of icons; centring the row |
| Editorial colophon | A typeset paragraph saying who made the site, where, when and with which typefaces. Studio, publication, personal site | Measure ≤ 64 ch in columns 1 to 8; 14 px text or 12 px mono; padding-block `--space-8` | ≤ 80 words; contact email as a link; the routes as an inline list beneath | None | QE, SM, WA, HB | A colophon without the routes; boasting in the colophon |
| Giant wordmark | The wordmark set to the container width. Brutalist, studio, launch; "proud" | Links row above at 14 px; wordmark `font-size` via container units (`clamp(3rem, 22cqi, 20rem)` tuned to the mark's width); legal row beneath; padding-block `--space-8` | Wordmark, 3 to 6 links, copyright | None (a set piece here is a second set piece) | HB, SM, SG, CS | Wordmark that overflows at 390; a gradient fill on the wordmark (#15) |

Footer rules: the footer lists every route on the site; no "back to top" button; the same link style as the body. `[house]`

## 14. Blog and index lists

Rows, not cards: date in tabular mono (columns 1 to 2), title 18 to 20 px (columns 3 to 10), optional one-line summary ≤ 20 words beneath the title; 1 px rules between rows; row padding-block `--space-4`; 10 to 20 rows then numbered pagination (never infinite scroll); tag filters as one row of text links, not pills. Thumbnails only when images are the content, then 3:2 at 120 px wide in columns 11 to 12. At 390 the date sits above the title at 13 px. Suits: all directions; the list mechanism is otherkind.design's engagements list and Linear's changelog. Pitfalls: a card grid with 5 pastel tags (#10); reading-time badges; a "featured" card 3× the others; hover lift on rows. `[house; ../PLAYBOOK.md section 3.1]`

## 15. Case-study page

| Region | Default | Rules |
|---|---|---|
| Hero | Title ≤ 8 words as `<h1>` in columns 1 to 8, then one image at 16:9 spanning 12 (`--r-0` if it touches the margins); or the statement hero for text-led work | The image is the LCP; ≤ 200 KB, preloaded |
| Brief | 3 to 5 sentences, ≤ 80 words, in a measure column (columns 1 to 7) | Says what the client needed, in the client's terms; no "Challenge" heading |
| Role and meta | `<dl>` in columns 9 to 12 beside the brief: client, year, role, team, duration | Tabular figures; labels 13 px `--text-2`; stacks beneath the brief at 390 |
| Outcomes | 2 to 4 numbers in the numbers-row format with a source and date | Tabular numerals; a real noun; no counters |
| Gallery rhythm | Full width (12 columns, 16:9), then 2-up (6 and 6 at 4:5 or 1:1), then full width; repeat; never 3 in a row; image gap `--space-6`, group gap `--space-9`; captions ≤ 15 words left-aligned to the image edge; text interludes ≤ 60 words between groups | One ratio per row; no lightbox; no masonry; screenshots follow section 7 |
| End | One next-project link at display size, then the footer | Never a grid of "related work" |

Suits: SM, QE, SG, LD. Pitfalls: "Challenge / Solution / Results" headings with icons (#4); every image at the same size; a carousel of screens (#42). `[house]`

## 16. About and manifesto

A long-measure typographic page: one column of 60 to 72 ch (`--measure: 64ch`) left-aligned, body 18 to 20 px at line-height 1.55, page margin `--space-4` at 390; the opening 2 sentences at 28 to 36 px as the lead; sections divided by `--space-8` and a plain or numbered `<h2>`; 300 to 900 words in total; one image at most at 3:2 spanning the column, or none; one pull quote at most; no sidebar, no cards. Suits: QE, WA, SM, HB. Pitfalls: centred text (#26); values as three icon cards (#23); an office photograph from a stock library; a timeline of the company's history with dots (#3). `[source: Butterick, line length 45 to 90 characters; Bringhurst; house]`

## 17. Contact

| Variant | Description and when | Grid and rhythm | Content | Motion | Suits | Pitfalls |
|---|---|---|---|---|---|---|
| Form | ≤ 5 fields. Products and services that qualify leads | One column 28 rem in columns 1 to 6; inputs 44 px tall, `--r-2` (or `--r-pill` in a capsule system); label above each field (#59); field gap `--space-5`; submit ≤ 3 words | Name, email, message, optional company and budget `<select>`; errors beside the field in text; success replaces the form at the same height; spam control by honeypot, no visible captcha | Error text appears at 150 ms | TD, VI, WA, SG | A map embed; "We'll reply within 24 hours!" (#48 tone); a live-chat widget over the footer; placeholder-only labels |
| Email-only | A mailto link at display size plus an address list. Studios, portfolios, luxury; the default when no qualification is needed | Columns 1 to 8; email at 28 to 49 px; address, phone and hours as a `<dl>` beneath, gap `--space-6` | Email, optional phone, one physical address as text | None | SM, QE, HB, LD | A form added "just in case"; the email as an image; social icons instead of an address |

## 18. Page recipes

Sections in order with the chosen variant. Every recipe has one hero, one CTA band at most, and one footer; sections not listed are omitted, not added.

| Recipe | Sections in order (variant) |
|---|---|
| Agency or studio (SM) | Wordmark-only nav; hero statement (or interactive set piece if the brief funds it); case-study index as rows (section 14); proof logo strip; team list with roles; contact email-only; footer editorial colophon |
| SaaS product (TD or VI) | Hairline bar; hero split; proof logo strip; features bento; how-it-works horizontal rail; product tour single screenshot; testimonials two-column; pricing tiers with annual toggle and feature table; FAQ; CTA band; footer sitemap columns |
| Portfolio (SG or SM) | Sidebar index; hero type-only stacked with numeral index; case-study rows; about excerpt ≤ 120 words in the long-measure style; contact email-only; footer single-line |
| Brand launch (CS or LD) | Hidden-until-scroll nav; hero full-bleed image with type overlay (or video loop with poster); features alternating rows, 3 at most; proof numbers row; proof quote; CTA band inverted once; footer giant wordmark |
| Docs or product marketing (QE or SG) | Hairline bar; hero editorial; features numbered list; features table for tools; product tour screenshot pair; FAQ; CTA band; footer sitemap columns |

## 19. Rejection ladder

If the client rejects A, present B, then C. After C the brief is wrong; return to strategy. Never re-present A with decoration.

| Section | A | B | C |
|---|---|---|---|
| Navigation | Hairline bar | Wordmark-only | Pill-in-canvas (VI, CL) or sidebar index (SG, SM, TD) |
| Hero | Statement | Editorial | Split, then vitrine or set piece by direction |
| Proof | Logo strip | Numbers row | Quote, or none |
| Features | Numbered list | Alternating rows | Bento (only VI, TD, CL) or table |
| How it works | Horizontal rail | Vertical timeline | Fold the steps into features |
| Team | List with roles | Grid with equal crops | Editorial portraits |
| Testimonials | None | Single large quote | Two-column quotes |
| Pricing | Tiers | Single price or contact | Tiers with feature table |
| Footer | Single-line | Sitemap columns | Editorial colophon, then giant wordmark |
| Contact | Email-only | Form | Email-only plus a `<dl>` of offices |

## 20. Sources

- Refactoring UI (spacing scale, hierarchy by weight not colour, grids are overrated): https://www.refactoringui.com/
- Apple HIG Layout (guides, safe areas, alignment): https://developer.apple.com/design/human-interface-guidelines/layout
- Material 3 layout: applying layout, window size classes, panes, grids and spacing: https://m3.material.io/foundations/layout/applying-layout/window-size-classes ; https://m3.material.io/foundations/layout/grids-spacing/spacing
- Butterick, Practical Typography, line length 45 to 90 characters: https://practicaltypography.com/line-length.html
- Bringhurst, Elements of Typographic Style, measure and rhythm (web edition): https://webtypography.net/
- web.dev, Largest Contentful Paint and optimising the hero image (preload, fetchpriority, 2.5 s): https://web.dev/articles/lcp ; https://web.dev/articles/optimize-lcp
- web.dev, Cumulative Layout Shift (aspect-ratio on media): https://web.dev/articles/cls
- NN/g, F-shaped pattern of reading on the web (left-aligned text and front-loaded headings): https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content-discovered/
- NN/g, auto-forwarding carousels and accordions annoy users and reduce visibility (rotating content is ignored): https://www.nngroup.com/articles/auto-forwarding/
- NN/g, carousel usability (do not auto-forward on mobile; hero image instead of a carousel): https://www.nngroup.com/articles/designing-effective-carousels/
- NN/g, accordions on desktop and mobile (default closed, independent items): https://www.nngroup.com/articles/accordions-on-desktop/
- Baymard, displaying price discounts without the 4 pitfalls (absolute saving beside the price): https://baymard.com/blog/product-page-price-discounts
- WCAG 2.2, 1.4.3 contrast for type over imagery; 2.5.8 target size: https://www.w3.org/TR/WCAG22/
- otherkind.design (wordmark-only navigation, engagements list with right-aligned year, 2-up team grid at 20 px radius; fetched 2026-09-03): https://otherkind.design/
- aveen.co (editorial hero with kicker, serif display and sans deck at 12 and 24 px gaps; fetched 2026-09-03): https://aveen.co/
- linear.app (changelog as rows, screenshots without device frames, restraint in tabbed demos; fetched 2026-09-03): https://linear.app/
- stripe.com press and design pages (logo strips in one ink, numbers rows with tabular figures, sitemap footer; fetched 2026-09-03): https://stripe.com/newsroom ; https://stripe.com/blog/design
