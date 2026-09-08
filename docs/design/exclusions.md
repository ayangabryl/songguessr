# Exclusion search repair

Scope: repair the existing Mix exclusion control in the shared solo/multiplayer panel. Preserve the site's typography, green accent, 44px controls, panel layout, Apply/Cancel draft behavior and existing catalog filtering. This is a narrow interaction fix, not a full Mix redesign.

Observed: artist exclusions are an uncontrolled semicolon-delimited text field saved on blur, without suggestions or removable selections. Artist catalog search is capped at five results. The interface cannot distinguish search failure from an empty catalog result.

Chosen interaction: a labeled artist search with an attached, bounded results area and contained scrollbar; click or Arrow keys/Enter selects an artist immediately into the draft; selected names appear as removable chips. Escape dismisses results before closing Mix. Search across the catalog so exclusions remain searchable regardless of active inclusion filters. Keep genre toggles, explicitly mark excluded items, and prevent one artist/genre being included and excluded simultaneously. Do not commit text merely because focus leaves the field. No arbitrary custom artist names: select the canonical catalog name.

Alternatives considered within this repair: retaining free text would preserve spelling errors and hidden blur commits; a second modal would obscure the draft; inline search keeps the complete action in Mix and works in both the desktop sheet and phone layout. Reuse existing field dimensions, neutral surfaces and focus colors. Result rows have 44px minimum targets, long names wrap, and selected chips have an explicit remove label. Network requests debounce, stale responses cannot replace new results, and a failed request has a retry action.

Validation pending: real catalog search, keyboard selection, remove/reselect, empty result, cancel/apply/reopen, both shared consumers, light/dark and narrow layouts.

## Local review

Implemented and reviewed in the actual shared panel. Solo: searched Taylor Swift, selected with ArrowDown/Enter, dismissed results with Escape without closing Mix, cancelled and confirmed the draft was discarded; selected Drake, applied, reopened and confirmed persistence, then removed/applied to restore the original local mix. An impossible name showed the empty state. Multiplayer: the same search worked; selecting Belle Mariano for inclusion cleared her conflicting exclusion.

Inspected desktop dark and 390 × 844 dark/light rendered states. Results remain within one rounded field/list surface and the inner scrollbar; long lists are bounded instead of expanding the entire sheet. Removed an unstyled clear button found during the first visual pass. Both artist sections now explicitly say include/leave out.

A broad local `ma` query returned 38 artists instead of five; after removing external portrait hydration from typed queries, a measured request completed in 0.94s. That is a local observation, not a production latency guarantee. The search retains stored portraits for inclusion results. Typed searches debounce for 160ms, time out after 8s, ignore superseded responses and expose retry on failure. Network-failure/retry behavior was reviewed in code but not exercised under simulated offline conditions.

17 existing focused artist/match tests and the production build passed; whitespace check passed. Local validation completed; included in the following multiplayer stability release.
