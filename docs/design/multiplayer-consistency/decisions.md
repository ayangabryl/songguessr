# Solo / multiplayer consistency pass

The user asked for a clean multiplayer interface consistent with solo. This is
a fixed-brand alignment, not a new visual direction. Solo is the source study:
Instrument Serif for the wordmark, clip numeral and song title; Open Runde for
controls; difficulty-derived colors; open space, a thin ruler and pill controls.

Observed in before captures: multiplayer changes the wordmark and song title to
bold sans, frames the game in a large card, repeats play instructions in four
places and gives a congratulatory banner more emphasis than the answer. It also
hides the wardrobe button at narrow widths. Solo's local backend is absent on
the preview server; use intercepted fixture responses to review the real solo
playing/result components, and do not claim a live match was verified.

Preserve: shared Noot stage, room membership, copy invite, host options, search
and selected track IDs, 5,000-point ladder, round clock, standings/ties, readiness,
reconnection, keyboard input, reduced motion, light/dark and difficulty colors.

Scope: keep the existing stage + standings arrangement, adopt solo's actual
tokens and typography, simplify repeated copy, put the ready action near the
answer, retain accessible outfit/wave actions. No new font or visual concept is
needed. This narrow repair uses before/after comparison rather than three new
page concepts. Remove competing legacy table CSS so the shared answer typography
has one authoritative definition. Do not alter the unrelated round-stage note.

Review path: lobby → start → play/skip → search/guess → reveal → ready/wait;
plus final/tied scores, reconnect, long titles/names, narrow layout, light/dark.
Browser fixtures validate UI behavior, not server synchronization or real audio.

## Result and verification

Multiplayer now uses the shared solo display/control font roles, difficulty
tokens, open canvas, 56px transport controls and pill actions. The track title
leads results. Ready precedes the companion stage and only shows a checkmark
after the server-owned `ready` flag is received. The pending indicator clears on
that acknowledgement. The wardrobe remains available at narrow widths. Noots
now inherit the current match difficulty rather than staying green.

Consolidated table styling into match.css and removed obsolete table layouts
from round-experience.css; shared SongIdentity and solo rules remain there.
No new typeface, palette, backend service, scoring rule or room protocol added.

A fresh-context visual reviewer found premature ready confirmation, excess
vertical spacing and duplicated play instructions. These were repaired. Main
browser review additionally found a 2px field/play height mismatch and a theme
transition still running under reduced motion; both were repaired. Intermediate
theme captures are retained as `transitional-*.png`, not final appearance.

Chrome/Metal browser fixture checks passed: skip changes stage; keyboard arrows
select an option; Escape dismisses; Enter submits; result → ready gives 1/3 and
waiting; reconnect recovers; lobby Start returns to play; wardrobe opens on
mobile. Captured lobby, playing, search/empty, answer, waiting, reconnect, tie,
finished, light/dark, Hard palette, long strings, 390px and 320px layouts, and a
777px-high desktop. No page errors. Local API responses and a quiet generated
test tone exercised the actual solo components, not a recreated solo mockup.

Final computed fonts match the solo family roles; transport heights are exactly
56/56/56px on desktop. Document width equals viewport at 320 and 390px. Production
client/worker/admin build passed; 18 match/song identity regressions passed.
Existing bundle-size warnings remain. No live multi-client/backend or real-song
playback certification is implied. No deployment or commit made.
