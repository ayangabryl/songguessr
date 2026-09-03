# Brief: Hacker News, front page (rethink)

Owner: strategy desk. Consumed by: direction, layout, typography, colour, motion, interaction, qa.

## Problem
The front page is a single, undifferentiated rank order shown identically to a first-time visitor and to someone on their fifth visit of the day. Nothing on the page marks what changed since the reader last looked, and nothing marks which threads are gaining discussion right now versus sitting quiet at a high rank from an hour ago. A studio has already tried a type-only pass on this exact structure and the client rejected it in writing: "that is not what we asked for." The structure itself, not its type, is the unaddressed problem.

## User
Primary: a working developer or founder, desktop or phone, checking in 2 to 5 times a day for 60 to 120 seconds between other tasks; skims fast, already knows the format, wants to know what is new before deciding what to open. Secondary: a first-time visitor arriving from a shared link, who has no "since last time" to check and reads the page as a plain ranked list.

## Return ritual
Several times a day. First look is for what showed up since the last visit; second look, for the returning reader, is which of those new or already-seen threads is still gaining comments right now (alive versus settled). The visit is worth it when at least one thread is new or visibly moving; it is a wasted click when the page looks exactly as it did an hour ago with no way to tell.

## Competitor map (rethink)
Axes: dense (many items, little air) to airy (few items, generous space) by ephemeral/live (ranked by what is moving right now) to considered (ranked by editorial or community judgment, changes slowly).

| Product | Position | Mechanism it owns |
|---|---|---|
| Lobsters | dense, considered | Tag-filtered list with community-moderated ranking; low noise, slow-moving order |
| Reddit r/programming | airy, ephemeral | Card list with vote arrows and live comment counts; upvote animation signals motion |
| Techmeme | dense, considered | Story clusters with a lead link and a rail of related coverage; curated, not crowd-ranked |
| Product Hunt | airy, ephemeral | Daily-reset leaderboard with a live vote count climbing through the day |
| Daring Fireball | airy, considered | Single-column linked list in one editorial voice; no ranking signal at all, just sequence |
| Lemmy / Tildes | dense, ephemeral | Federated or grouped feed with visible recent-activity sort, community-run |
Client today: dense, midway between ephemeral and considered (points-ranked, but points barely move once a thread ages out of the front page). Empty quadrant: dense and clearly ephemeral, ranked and marked by what is moving right now rather than by a static point total. That is the position this rethink takes: HN is already the dense end of the map; no competitor owns dense-and-visibly-alive, and it is the one tone word ("alive") the client used that none of the current structure delivers.

## Job to be done
When I open the front page for the third time today, I want to see what is new since I last looked and which of those threads is picking up steam, so I can spend my 90 seconds on the one or two that are actually worth it right now rather than re-reading the same rank order.

## Primary task of this screen
Scan the list and pick the one or two threads worth opening right now.

## Secondary tasks (ranked)
1. See what is new since the last visit.
2. See which threads are gaining comments (alive) versus settled.
3. Switch theme (light/dark), open a story's comments directly.

## Success metric
At least 24 stories fully above the fold at 1440x900 and 12 at 390x844 (current live build: 24 and 12 exactly, measured with `scripts/measure.mjs --count=.story-row --count-min=24|12`), AND on a returning visit with a seeded previous snapshot, the since-last-visit divider and at least one non-zero velocity delta are present and reachable in the capture matrix (the reskin check in `qa-report.md` records this as a yes/no, not a number, because "the ritual is visible" is a structural fact, not a count).
Baseline: current live Hacker News build shows 24 stories fully above the fold at 1440x900 and 12 at 390x844 (measured on the given before-captures, `hn-before-1440.png` and `hn-before-390.png`).

## States that must be designed
- First run: no `hn-last-visit`, `hn-seen` or `hn-snapshot` in `localStorage`. Every story renders in the plain, undivided list with no divider, no dimming and no velocity deltas; nothing implies history that does not exist.
- Returning: `hn-last-visit`, `hn-seen` and `hn-snapshot` present. Stories not in `hn-seen` render above a "since your last visit" divider at full weight; stories in `hn-seen` render below it, dimmed to `--text-2`; any story present in `hn-snapshot` with a higher point or comment count shows a small tabular delta beside the number it changed.
- Empty: not applicable to this dataset (`items.json` always holds 30 stories); if the fetch returns zero items, the list region shows one sentence ("No stories loaded.") and a Retry action in the same box the list would occupy.
- Loading: shown only if `items.json` has not resolved within 300 ms; a skeleton of 8 rows at the same row height, held at least 300 ms once shown.
- Error: `items.json` fails to load; one sentence naming the failure and a Retry action, in the list's own box, keeping the header and theme toggle live.
- Success or end state: the story list renders with the row count the brief measures; no separate "success" confirmation is needed for a read-only scanning screen.

## Constraints
Static HTML, CSS and vanilla JS; no framework, no build step, no network request beyond the local `items.json`; fonts vendored from the four permitted Fontsource packages or a system stack, typography desk's choice with a stated reason; WCAG 2.2 AA; reduced motion honoured (split policy); light and dark themes stored under `localStorage` key `hn-theme`, toggled from the header; the orange stays the brand's one accent hue; the 30-item dataset and its seven fields are fixed.

## HCI notes
Von Restorff: the since-last-visit divider is the one visually distinct element on the page baseline; the "new" zone above it is the only place using full text weight, so a returning reader's eye lands there first without being told to. Zeigarnik: the divider itself is the visible open loop between visits — a reader who saw it "empty" (no new stories) at 8am has a reason to check back at noon. Doherty: the velocity delta is precomputed at render, so it costs 0 extra requests and shows within the same paint as the rest of the row. Miller/Cowan: the returning reader does not have to hold "what did I read before" in memory; the divider does that for them. Gestalt proximity: the "new" zone and the "seen" zone are two groups separated by a gap at least twice the inter-row gap, so the boundary reads without a border or a background colour.

## The one idea (proposed, for the direction desk to confirm or replace)
A tide line: stories the reader has not seen sit above the mark at full weight; everything already seen settles below it, quieter with every visit; the number that is moving gets noticed, not the number that is highest.
