# Noot head avatars — 2026-09-08

Lobby initials are replaced by head portraits from the same Blender GLB used by the playground. Standings use the same component. Local preference changes and remote profile updates feed the portrait's headwear, head color, eyewear and frame color; the current difficulty supplies the matching Noot body palette. Player names remain accessible, and decorative images have empty alternative text.

Portraits render once through a shared queue into transparent 144px PNGs. Only selected head/eye fashion assets are loaded, duplicate appearances share a bounded 48-entry promise cache, and the temporary WebGL renderer releases its context after the batch. Each row contains an image, not another animated scene. Unmounted or superseded portrait requests cannot overwrite the current appearance.

Local rendered QA: three-player standings with distinct headphones, beanie and bucket hat; twelve-player lobby, with all twelve images loaded and only one playground canvas; narrow 390px dark layout with no document overflow. Long standings names truncate visually while retaining the full accessible name and title. TypeScript/production build and scoped lint passed.
