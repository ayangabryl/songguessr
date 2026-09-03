# Concept: Hacker News front page

Owner: direction desk. Consumed by: layout, typography, colour, motion, engineering, qa.

## Sixty-second triage (current build, `hn-before-1440.png` / `hn-before-390.png`)
- Letter-spaced uppercase labels on more than one element? No.
- A coloured side stripe, tinted icon square or badge carrying no data? No.
- A dot, ring or pulse pretending to be live? No.
- A gradient, glow, halo, aurora or blur on content? No.
- Text below 4.5:1, or pale text on a pale chip? **Yes** — meta text (points/user/age/comments) reads as grey-on-white well under 4.5:1 at ~9–10 px.
- More than one accent hue? No, one orange only.
- Mixed radii or a local radius tweak? No, radius 0 throughout.
- A mascot with slop eyes? Not applicable, no character.
- Layout that jumps between states, or idle motion on more than one figure? No motion exists at all currently.
- Three equal cards, a bento, a carousel? No.

Verdict: the current build is already close to the studio's own instinct (one accent, flat surfaces, no gradients, no cards) — its failures are legibility and target size, not decoration. The redesign keeps the current build's restraint and fixes what a script can prove is broken.

## The one idea
A printed ledger: one accent, one ruled line per row, numbers stack in a column, nothing floats.

## Direction
Brief signal: "A tool, dashboard, editor, admin, developer product, fast, dense, keyboard" (the tone words — quiet, dense, legible — and the primary task — scan and decide, at high frequency, all day — match this row in `departments/direction/references/directions.md` section 1). Brief has guessed lines (archaeology), so two candidates are presented, matching the signal table's own pairing for this row:

1. **Tool density**: one sans, one signal hue at low area, dense rows at 32–36 px height, tabular numerals, tool-snap motion (120–200 ms). Its "nothing decorates" ethos and its scanning-list composition device fit a page whose entire content is 30 identical rows.
2. **Swiss grid**: one neo-grotesk, three weights, structural hairlines, a saturated accent on at most 5 percent of area. Fits the "no nonsense" reading but its large size jumps and 12-column asymmetry are built for a page with a hero and a few headline blocks, not 30 uniform rows.

Recommended: **Tool density**. If rejected, the next candidate is Swiss grid; if that is also rejected, the fallback order (section 12) moves to Studio mono, the quieter neighbour.

## References as mechanisms
| Reference | Borrowed mechanism (not the look) | Where it applies here |
|---|---|---|
| otherkind.design (`departments/direction/references/directions.md` §3) | Engagement list: label left, a value right- or lead-aligned in tertiary tone, one running text size | Meta line: the points figure leads the line in tabular numerals so it forms a vertical column without any extra markup |
| Linear, cited under Tool density (§10) | Dense rows at a fixed height; 120–200 ms tool-snap feedback; hover shifts surface lightness only, no colour change | Story row hover/press states; theme toggle transition |
| Teenage Engineering product pages, cited in `departments/direction/PLAYBOOK.md` §4.2 rule 3 ("six to eight colours… disable as much as possible") | One accent, everything else neutral; restraint as the whole visual argument | The orange appears in exactly four places (see "decisions nobody else made") and nowhere else on the page |

## Kill list
1. Meta text under 4.5:1 on its background — replaced with `--text-2` measured at 6.5:1+ on both themes.
2. An upvote hit area smaller than its glyph — replaced with a 44×44 px control on touch, glyph unchanged in visual size.
3. No visual gap between a row's own fields and the next row — replaced with an inter-row gap at least twice the intra-row (title-to-meta) gap.
4. Title, domain and meta set at one size and weight — replaced with a three-step type scale (16/14/13 px) and two weights (500/400) so the eye can group without reading.
5. No visible keyboard focus — replaced with a 2 px focus ring on every link, button and the theme toggle.
6. No dark theme — added as a genuine second system (not an inversion), toggle persisted in `localStorage`.
7. A pipe character (`|`) as the only separator between nav items and between meta fields — replaced with a hairline rule (nav) and a middot at reduced opacity (meta), which read at a glance without adding a character to say out loud.

## Decisions nobody else made
1. The points figure is the first token of the meta line (it already is, in the source data) and is set in tabular numerals — so the digits form a vertical ledger column straight down the page with no grid or extra markup, purely from digit width and word order.
2. The rank number is right-aligned in a fixed two-character column in tabular numerals, so ranks 1–9 and 10–30 share one right edge instead of the tens digit shifting the ones column left as the list passes nine.
3. The accent (`--accent`, the brand orange) appears in exactly four places on the rendered page: the header bar, the "Y" mark, the current-page nav indicator, and the vote control's pressed/selected state — never as a link colour, a hover tint on rows, or a border. A grayscale capture of the page loses only those four regions.

## What must stay
The orange bar and the "Y" mark; the nav item set and order (new, past, comments, ask, show, jobs, submit) plus login; the seven per-row fields (rank, title, domain, points, author, age, comments); the eight footer links (Guidelines, FAQ, Lists, API, Security, Legal, Apply to YC, Contact); no framework, no build step, no external requests.
