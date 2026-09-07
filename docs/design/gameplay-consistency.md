# Gameplay consistency — September 7, 2026

## Brief and direction
Players listen, guess or skip, discover the answer, then continue alone or ready up together. Preserve SongGuessr's existing typography, difficulty palette, Noot, and ruler. This is a fixed-brand repair; separate concept studies would create another competing system.

The supplied solo screenshot separates title from score and actions. Source review also found multiplayer hard-coded to the Easy palette. Both modes now use a shared SongIdentity component, title → artist → score hierarchy, and restrained 240ms reveal motion. Controls remain after the answer on phones. Long titles wrap instead of being clamped. Minimum deck space reserves room for ordinary results, but exceptional long text can grow rather than clip.

## Scope
Solo result layout and multiplayer result grouping, difficulty colors, text scale and shared motion. Scoring, synchronized readiness, answer validation and Noot proportions are preserved. Real catalog and existing room service remain authoritative.

## Review
Self-review by Codex. Build passed (existing large-chunk advisory). Initial craft checker flags body leading; updated shared line-height. Render and interaction coverage recorded below after final checks. No claim of participant testing or production certification.

## Shared multiplayer stage
Replaced the separate portrait grid and duplicate hero mascot with one stage of connected players. Stable seats preserve identity while wave, solve, skip and ready feedback changes around each pet. Scores stay in a compact standings column; on phones standings follow the game and the stage scrolls horizontally for larger groups. Album playback moves above the stage on phones to avoid covering a pet. This extends the existing game system rather than opening a new visual direction.

Self-review: inspected live local three-person reveal at desktop and 390px in dark mode. Desktop and phone had no document overflow. Exercised joining and the wave control. Earlier solo reveal inspected in light/dark and phone width; ruler position was unchanged before/after reveal. Full-room performance, eight-person interactions, winning celebrations and all-ready transitions were not visually exercised in this pass.
