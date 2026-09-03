# Case: Hacker News, front page (rethink)

Client's words: "Keep it dense and honest, keep it fast, keep the orange as ours, but rethink what the front page is for the people who come back to it several times a day." A prior studio's pass kept the exact ranked-list structure and only reset the type; the client rejected it in writing. This job's scope is rethink, and the bar for a rethink is structural, not typographic.

## The divergence
Four structural options were drawn (`concept.md`), differing in structure, not skin:
1. **Flat list, type only** — the exact structure the client already rejected. No new signal for a several-times-a-day reader.
2. **Alive rail** — the flat list re-partitioned into two weight bands, computed from a cached previous snapshot: Rising (new or gaining) at full weight above a mark, Steady (unmoved) below, quieter. Chosen.
3. **Two-pane** — a list plus a live comment-velocity readout for the selected thread. Serves "alive" but a second pane halves the list column and threatens the density floor.
4. **Heat re-sort** — reorder the whole list by momentum instead of points. Serves "alive" as the primary order, but a dismissed story can jump back up on a later visit, fighting the return ritual's sense of "where things sit."

Chosen: **Alive rail** (option 2). The brief's return ritual puts "what's new since last visit" ahead of "what's alive right now," and the brief's own secondary-task ranking lists them in that order. Option 2 answers both from one mechanism; option 3 answers only the second and costs the row count to do it.

**The one idea**: a tide line — the list is one flat ranking with a mark drawn across it by what has moved since the reader last looked; above the mark gets full weight, below it goes quiet, and the mark itself vanishes with nothing to show for a reader it has never met.

## The mechanism
**Velocity signal** (`departments/interaction/PLAYBOOK.md` 3.5), generalised to double as the since-last-visit signal: a story's velocity is its point/comment delta against a cached `hn-snapshot` in `localStorage`. A story absent from that snapshot is the maximal case of the same computation and is labelled "new" instead of a number — one function, not two features. The same computation sets both the visible delta (`+38`, tertiary tone, tabular) and which band a row falls into (Rising if new or above a points/comments threshold, Steady otherwise). No new control: the signal is read-only text inside the existing row link. On first run, with no snapshot, the page is structurally the flat list (divergence option 1) rather than an empty "Rising" band announcing a feature with nothing in it.

## What each desk decided and why
- **Strategy** (`brief.md`): return ritual is "what's new, then what's alive"; competitor map places six products on a dense/airy by ephemeral/considered grid and finds the empty quadrant — dense and visibly alive — is the one HN doesn't own and the one tone word ("alive") its current build doesn't deliver. Metric: 24 rows at 1440, 12 at 390, plus the mechanism visibly reachable on a returning visit.
- **Direction** (`concept.md`): chose Alive rail over Two-pane on the return-ritual ordering; chose **Tool density** over Swiss grid, because density is named as the idea itself (fixed rows, tabular numerals, 60-72rem measure) rather than a byproduct, and Swiss grid's large size jumps have no headline to spend themselves on across thirty equal-weight rows.
- **Layout**: 4px space scale, 8px rhythm; row grid identical between Rising and Steady bands (no taller row, no box, no strip) so the "alive" signal costs nothing in scanning speed; `--measure: 68rem` for a scanning column, not a 44rem prose measure.
- **Typography**: Geist Variable, self-hosted, `font-display: swap` with a metric-approximated fallback; one family, four sizes (13/14/16/20px), under the six-size escape hatch; tabular numerals on every numeric span.
- **Colour**: one hue (43, HN's own orange) carried through both themes via OKLCH; every text/UI pair measured with `contrast.py` and commented in `tokens.css` (lowest body pair 5.06:1 light / 6.61:1 dark, both above the 4.5:1 floor; all UI/large pairs above 3:1).
- **Motion**: tool snap dialect (`motion-spec.md`) — nothing animates on load, no stagger; only hover/press feedback at `--dur-1`/`--ease-out` and one token-consumer-level colour transition at `--dur-3`/`--ease-in-out` for the theme switch; reduced motion collapses all durations to 0ms.
- **Interaction/Engineering** (`app.js`, `index.html`, `styles.css`): the velocity computation, the seeded demo snapshot (deterministic, pseudo-random keyed by item id, so captures are stable across runs), the theme toggle persisted to `hn-theme`, and the loading/error/retry states — all static HTML/CSS/vanilla JS, one `fetch('items.json')`, no framework, no build step.

## What QA found
Three loops (`qa-report.md`). Loop 1 found three defects, all fixed and re-measured clean in loop 2: two off-scale spacing values (UA-default `<p>` margins on the footer and error state, not a token), 62 off-scale padding values on mobile rows (a redundant `padding-block: 2px` override), and the skip link under the 44px mobile touch floor. Loop 2 read as ship-ready by this desk's own checklist (weighted 9.54/10, J and K both 10), but an independent direction-desk audit of the loop 2 build then found five findings the checklist does not test for directly:

- **S2-1**: HN's section nav (new, past, comments, ask, show, jobs, submit) and login had been removed with no decision recorded for it anywhere in `concept.md` or `brief.md` — restored as a real `<nav>` inline in the desktop header and as a scrollable row under the wordmark on mobile.
- **S2-2**: the "new" label wrapped alone onto its own line on mobile — domain and "new" now travel as one nowrap unit.
- **S3-1**: the Rising/Steady weight step (500/400) was illegible at 15px/1x — the one thing the idea depends on. Steady titles now also drop to `--text-2`, still ≥4.5:1 in both themes.
- **S3-2**: the mobile theme control read as the header's strongest element — reduced to a 44px icon button with a `--line` border and a dynamic `aria-label`.
- **S3-3**: meta-line rhythm and a footer copy nit (S4) — a thin space before the delta, `--text-3` moved one step lighter (bounded by the row-hover background's own 4.5:1 floor), and the footer shortened to "30 stories."

Fixing S2-1 introduced two regressions the QA scripts caught before the report was written: the restored `login` link initially lost its inline-text-link target exemption (a flex child's used `display` is blockified, the same rule already governing `.title-link`), and the nav links then failed on width alone once height was fixed. Both were fixed with a real `min-height`/`min-width: var(--target)` hit area instead of leaning on the exemption. Final loop 3 measurements: **24** rows above the fold at 1440x900, **13** at 390x844m (floor 12, one row spent on the restored mobile nav, priced in by the audit itself); 0 contrast failures either theme; 0 off-scale values; 0 targets under floor; 0px horizontal overflow; 0 off-token motion; the loop 2 "ease-in on UI" script false positive is now fixed and reads clean. Weighted score **9.54/10** — unchanged from loop 2, because all five direction-desk findings sat inside categories the checklist was already scoring 10 (J and K measure density and structural difference, not a silently deleted IA layer; A measures pass/fail contrast, not whether a passing pair is visually distinguishable enough to carry the idea). The score not moving while five real defects got fixed is itself the finding: this desk's own protocol cannot see what it does not measure. J at 10, K at 10, no category under 7, zero open S1. Ship.

**Reskin check (K)**: before, a stranger sees "an orange-topped list of thirty plain text links, numbered, no visual grouping at all." After, a stranger sees "a numbered list split partway down by a thin orange rule and a caption saying what's new; everything above is bold and marked 'new' or carries a small + number, everything below is fainter." The two lines describe different things — a partition, a caption, a weight step and a delta convention that the before-image has nothing to show for.

## Before and after (loop 3, current)
Before (current live Hacker News, 1440x900): `/opt/cursor/artifacts/casework/hn-before-1440.png`
After, idle return with the mechanism visible (1440x900, light): `/opt/cursor/artifacts/casework/hn-rethink3-idle-light-1440.png`
After, dramatic return (1440x900, dark): `/opt/cursor/artifacts/casework/hn-rethink3-returning-with-new-items-dark-1440.png`
After, mobile (390x844, light): `/opt/cursor/artifacts/casework/hn-rethink3-idle-light-390.png`
