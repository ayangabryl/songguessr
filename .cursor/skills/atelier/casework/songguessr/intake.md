# Intake card: SongGuessr

Date: 2026-09-03. Source: client conversation plus project archaeology (`src/lib/game-state.ts`, `src/lib/stage-progress.ts`, `src/components/Game.tsx`, the current build at 1440x900 and 390x844). Lines marked (guess) were not confirmed.

1. Product and users: a browser game that plays a clip of a song, 0.1 s at first and longer with every miss or skip (0.1, 0.5, 2, 8, 15 s), and asks the player to name the track from a search; five difficulty levels change the catalogue, filters narrow era, genre and region, a streak counts wins in a row, Spotify can be connected for full playback. Players are music fans, 16 to 40 (guess), on a phone more often than a laptop (guess), in sessions of 3 to 10 minutes with several rounds back to back.
2. Primary task of the screen: hear the clip and name the track. If two compete, playing the clip wins over everything else on the screen.
3. Success: a round is understood without reading (where am I in the clip, how many tries are left, what did I miss); the guess field is reachable in one tap from the play control; a win in fewer seconds feels like the point of the game.
4. Must not change: the game rules and stages, the Noot character and its rig (`NootRig.tsx`, `noot.css`), the five levels and their hues, the Spotify, filter, settings and streak features, the React and Vite stack.
5. References the client likes:
   - otherkind.design: one idea per project carried through every element; a live vector as the set piece; a single running-text size; nothing moves that is not the idea.
   - vacarize.com: the character is part of the interface's behaviour, not a sticker beside it; typography and controls are one system.
   - Apple iOS 26: concentric shapes, one material for the control layer, motion as one physical model.
6. Dislikes: "our users say we are a copy of Songless and Heardle"; a narrow column with the character in a bubble above a small player; every redesign so far has been "the same design, improved".
7. Tone: precise, warm, alive. Never: flashy.
8. Constraints: React 19 and Vite, CSS only (no animation library), self-hosted fonts already vendored (Instrument Serif, Open Runde, Geist), WCAG 2.2 AA, `prefers-reduced-motion` honoured, English only, no bundle growth over 10 kB gzipped.
9. Scope: rethink. The client rejected the last two "improved" versions as reskins; the structure of the round must change and one new mechanism must serve the primary task.
