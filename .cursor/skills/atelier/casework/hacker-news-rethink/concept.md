# Concept: Hacker News, front page (rethink)

Owner: direction desk. Consumed by: layout, typography, colour, motion, interaction, qa.

## Divergence: four structures
1. Keep the ranked single list, hierarchy by type only (no history, no bands). Serves: fast scanning for a first-time visitor; the safest baseline. Costs: nothing new at all for a several-times-a-day reader — this is the exact structure the client already rejected once with better type on top.
2. Alive rail: the one flat list is re-partitioned into two weight bands computed from a cached previous snapshot — Rising (new since the snapshot, or gaining points/comments) at full weight above, Steady (everything else, unmoved) below, both internally still ranked by points. Serves: the return ritual directly ("what's new, what's alive"). Costs: needs local snapshot state; degrades to option 1's flat structure when no snapshot exists (first run).
3. Two-pane: a dense list on the left, the selected thread's top comment and a live comment-velocity readout on the right. Serves: comments-as-the-product, "alive" made visible as text rather than a number. Costs: a second pane halves the list column on desktop and forces two screens on mobile, which directly threatens the 24/12 density floor.
4. Heat re-sort: reorder the whole list by a computed momentum score instead of raw points, with the point rank demoted to a small secondary number. Serves: "alive" as the primary ordering principle. Costs: a story a reader already dismissed can jump back toward the top on a later visit purely because it is still accumulating comments, which fights the return ritual (the reader loses their sense of "where things sit") more than it serves it.

Carried into direction: options 2 and 3, the two that most directly answer the tone word "alive" while changing structure, not skin. Chosen: option 2 (Alive rail), because the brief's return ritual puts "what's new since last visit" ahead of "which thread is alive" as the first thing a returning reader looks for, and the brief's own secondary-task ranking lists "see what's new" above "see what's gaining"; option 2 answers both from one mechanism, option 3 answers only the second and costs the density floor to do it.

## The one idea
A tide line: the list is one flat ranking with a mark drawn across it by what has moved since the reader last looked; above the mark gets full weight, below it goes quiet, and the mark itself vanishes with nothing to show for a reader it has never met.

## Direction
Candidates from `departments/direction/references/directions.md`, matched from the signal table's "a tool, dashboard, editor, admin, developer product; fast, dense, keyboard" row:
1. Tool density: dense, fixed-height rows, tabular numerals, one sans family, minimal ornament, list column at 60 to 72 rem rather than a 44 rem prose measure — built for exactly a 30-row scanning list and it is the only catalogue entry that names density itself as the idea rather than a byproduct.
2. Swiss grid: precise, one neo-grotesk, asymmetric column spans, large size jumps for a headline-and-meta hierarchy. It fits the "honest" tone word but its large size jumps and 12-column asymmetric spans are built for a marketing page with one or two lead items, not a uniform list of thirty equal-weight rows; it would cost rows to get the size contrast it wants.

Recommended: Tool density. The brief's tone words are dense, honest, alive, and its success metric is a row count; Swiss grid's signature move (large size jumps, asymmetric spans) has no headline to apply itself to on this screen and would spend space the density floor cannot afford.

## References as mechanisms
| Reference | Borrowed mechanism (not the look) | Where it applies here |
|---|---|---|
| Mail inbox unread convention (Gmail, Mail.app) | Unread items render at full type weight; read items drop to a lighter weight with no separate icon or dot | The Rising/Steady weight bands: no colour, no badge, just a weight and tone step |
| A trading-terminal price ticker | A small tabular delta sits beside a live number, in a tertiary tone, and is simply absent when the number has not moved | The velocity signal beside points: `764 · +38` in `--text-3`, tabular, never a colour, never shown for a flat number |
| Techmeme's lead-cluster rule | One horizontal rule is the entire structural break between a top cluster and the rest of the river; no card, no shaded band, no border-box | The tide-line divider itself: a single rule plus one line of text, nothing boxed |

## Kill list
1. A flat, undifferentiated rank order shown identically on every visit regardless of history — the exact structure the client already rejected with better type on top.
2. Rank driven only by cumulative points, with no signal for whether a thread is still gaining or has gone quiet.
3. A meta line with points, comments and age all set at equal size and weight.
4. No dark theme, no persisted preference.
5. Interactive controls (the open-story target, the comments count) sized under the 44 px touch floor.

## The one new mechanism
Velocity signal (`departments/interaction/PLAYBOOK.md` section 3.5, row "I check whether a thread or item is alive"), generalised to double as the since-last-visit signal: a story's velocity is its point and comment delta against a cached previous snapshot; a story absent from that snapshot (it did not exist at the last visit) is the maximal case of the same computation and is labelled "new" instead of a number. One function produces both labels, so the mechanism is one, not two.
Interaction desk specification: trigger is page load, reading `hn-snapshot` and `hn-last-visit` from `localStorage`; states are a tabular delta (`+38`) in `--text-3` beside the points figure for a measurable gain, the word "new" in the same slot for a story absent from the snapshot, and nothing in that slot for a flat or negative delta; the same computation sets which weight band (Rising or Steady) a row falls into. No control is added — the signal is read-only text inside the existing row, so it needs no separate keyboard or touch path beyond the row's own link, and it degrades to nothing (the flat, undivided list of divergence option 1) when `hn-snapshot` does not exist, which is the honest first-run state. Reduced motion: the divider and any weight change apply with no transition; nothing about this mechanism moves.

## Decisions nobody else made
1. "New" is not a separate flag stored anywhere; it is what the velocity computation returns for a story with no prior snapshot entry, so the exact function that prints "+38" also prints "new" for a different input, one function and one meaning, not two features bolted together.
2. A Rising row and a Steady row sit on the identical row grid (same height, same padding) — velocity is carried by weight and a tertiary-tone number, never by a taller row, a box or a coloured strip, so the "alive" signal costs the reader nothing in scanning speed.
3. On first run, with no snapshot to compare against, the page is structurally divergence option 1 (the flat list not chosen) rather than an empty "Rising" band announcing a feature with nothing in it; a mechanism with no data behaves as if it had never been specified, not as a visible gap.

## What must stay
The orange as the one accent hue; the 30-item dataset and its seven given fields; static HTML/CSS/vanilla JS with no framework, no build step and no network request beyond the local `items.json`.
