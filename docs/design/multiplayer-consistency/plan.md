# Multiplayer consistency study

Reference: the existing solo console, inspected live on 2026-09-08. Preserve Open Runde, Instrument Serif, difficulty colors, the Noot asset, shared song search and server-authoritative match scoring. The supplied input screenshot shows a focus contour clipped at its left and right edges.

Primary task: hear a clip → search/select → confirm Guess or Skip → see answer → Ready up. Host/join and customization must preserve keyboard focus. Support 2–12 seats, long names/titles, desktop, mobile, light/dark, reconnect and reduced motion.

Plans with identical content:

- A: solo-style stage on the left; standings remain a narrow right column. Familiar task, but the party and ruler lose width. Mobile moves standings below.
- B: full-width solo-style stage; standings follow below as one quiet list. Strongest solo continuity and room for the party; standings require scrolling on short screens. Provisional preference.
- C: compact standings strip above a centered stage. Scores stay visible, but six to twelve seats wrap and displace the primary controls.

Shared contract: wordmark and toolbar align with solo; one serif clip numeral, one ruler, one play/search/action row. Scores and time share a small secondary line. No separate scoring ladder or repeated action labels under each character. Select a song before confirming it, just as in solo. Roster names remain interactive and identify the characters. One stable party instance across play/reveal to avoid needless reloads.

Capture working arrangements before selecting. Keep server commands and the repaired media controller unchanged while replacing their presentation. Use inset focus contours so rounded fields remain intact inside scrolling sheets.

Working comparison: A uses the solo shapes but constrains its instrument to a sidebar layout. C gives the first reading position to standings and pushes the controls down as names grow. B preserves the solo instrument's full width and leaves scoring below the decision. Selected B after wireframe, typography and material renders. The initial study omitted the difficulty token, making Play invisible; this was corrected and recaptured before acceptance. Mobile study exposed excessive nested insets and search padding; the product layout will use one mobile inset.

The comparison is an agent visual judgment, not an independent human vote. Native browser captures are in the task tool history; the study files preserve the three working options and wire/type snapshots.

Implementation and acceptance: selected B is now in MatchArena, using the actual shared controls. Mobile review led to a scrollable large-party stage and bounded lobby roster. A separate code review found pause restarting, missing final attempt marks, and incorrect timeout/spectator descriptions; these were corrected and exercised locally. Detailed observations and remaining platform limits are in `docs/qa/multiplayer-consistency.md`. User acceptance remains pending.
