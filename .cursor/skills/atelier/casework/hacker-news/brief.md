# Brief: Hacker News front page

Owner: strategy desk. Consumed by: direction, layout, typography, colour, motion, interaction, qa.

## Problem
The current front page (`hn-before-1440.png`, `hn-before-390.png`) sets meta text (points, user, age, comments) at roughly 9–10 px in a grey that measures under 4.5:1 on white — a body-text contrast failure at a size readers scan 30 times per visit. The upvote triangle carries no padding, so its hit area is far under the 44 px floor for a control used on every row. Title, domain and meta run at nearly the same weight and size, so proximity between fields is read character by character instead of seen at a glance. There is no dark theme and no visible focus ring.

## User
Primary: programmers and founders who read Hacker News many times a day, on desktop at work and on a phone in between tasks. High frequency, low patience, expert with the format (Jakob's law: 20 years of the same layout is itself a usability asset). Secondary: none named; the page has one audience.

## Job to be done
When I have a spare minute between tasks, I want to scan the newest stories and judge each one's title, source, age and popularity fast, so I can decide what to open without losing the minute.

## Primary task of this screen
Scan 30 headlines and choose one to open — the story link or its comments.

## Secondary tasks (ranked)
1. Navigate to another list (new, past, ask, show, jobs) or submit.
2. Switch theme (light / dark).
3. Sign in.

## Success metric
**Loop 2 correction** (direction audit: the first loop shipped a build that measured clean and did the primary task worse than the page it replaces — strategy anti-pattern, "a success metric that is an output or unmeasurable"; QA now runs a brief pass first, `departments/qa/PLAYBOOK.md` §4.0). Two numbers, both read with `scripts/measure.mjs --count=.story-row --count-min=<n>`:

1. **Density (primary task, scanning):** at least 24 story rows fully above the fold at 1440x900, and at least 12 at 390x844. This is the number that failed loop 1 (6 and 3) despite every other measurement passing — a redesign of a scanning list must not show fewer items than the page it replaces.
2. **Legibility (why the redesign exists at all):** zero horizontal overflow and zero contrast failures at 390, 768 and 1440 px, in both themes; smallest text at least 12 px (the old build's own meta text measures 9.3 px at 1440 and 10.7 px at 390, both below this floor — measured live, same command).

Baseline: measured on `https://news.ycombinator.com/` with `node scripts/measure.mjs <url> --viewport=1440x900|390x844m --wait=.athing --count=.athing --count-min=1` — **25 rows above the fold at 1440x900, 15 at 390x844m**, smallest text 9.3 px (1440) / 10.7 px (390), both under the 12 px floor. The redesign's density target (24 / 12) is set just under the 1440 baseline and at 80 percent of the 390 baseline — the touch-accessible 44×44 px vote control this same brief requires costs real width and height the live page does not spend on its own ~18×18 px hit area, so exact parity at 390 is not achievable without dropping the touch target below WCAG 2.2 SC 2.5.8; 12 is the floor QA measured as achievable while keeping it.

## States that must be designed
- First run and returning: identical — the page has no personalisation or history.
- Empty: not applicable; the list always renders the 30 items in `items.json`.
- Loading: `items.json` is a local file served with the page and typically resolves under 100 ms, so per interaction rule 3.2 the result is shown with no indicator; a "Loading stories…" line covers the rare slow case and a skeleton is not needed at this speed.
- Error: the fetch of `items.json` fails (offline, moved file) — a one-line message plus a Retry action, in the same region the list would occupy, per layout rule 42.
- Success or end state: none; this is a browsing screen, not a task with completion.

## Constraints
Static HTML + CSS + a small amount of vanilla JS rendering `items.json`; no framework, no build step; self-hosted or system fonts only; WCAG 2.2 AA; reduced motion (split policy); light and dark via `prefers-color-scheme` and a manual toggle in `localStorage["hn-theme"]` as `data-theme` on `<html>`; no external network requests at load. Brand: the orange bar and the "Y" mark must not change. IA: the seven nav items, login, and the eight footer links must not change.

## HCI notes
- Hick's law: the nav offers 7 destinations plus login and theme — at the edge of the 5–7 guidance, but it is the format's own 20-year-old convention (Jakob's law), so it is kept familiar rather than trimmed.
- Fitts' law: the upvote control is the only frequent tap target in each row; it gets the full 44×44 px touch target even though its glyph stays small (layout rule 36, grown hit area via `::before`/padding, not a bigger drawing).
- Gestalt proximity: the gap between a row's title/domain group and its meta line must be smaller than the gap between two rows, so the eye reads a row as one unit (layout rule 3: inter-group gap ≥ 2× intra-group gap).
- Von Restorff: exactly one accent hue (the brand orange) is reserved for identity and the vote-affordance/current-page marker so nothing else competes with it for attention.
- Miller/Cowan: no row asks the reader to hold more than the four fields already in the meta line; nothing is added.

## The one idea (proposed, for the direction desk to confirm or replace)
A printed ledger: one accent, one ruled line per row, numbers stack in a column, nothing floats.
