# Brief: SongGuessr, the round

Owner: strategy desk. Consumed by: direction, layout, typography, colour, motion, interaction, illustration, words, qa.

## Problem
The current build puts the game in a 460 px column on a 1440 px viewport (32 percent of the width), with the character in a 560 x 320 bubble above a headline, above a 76 px transport capsule, above the guess field. The clip, which is the game, is a 6 px bar inside the transport. Players read four regions top to bottom before finding what to do, and the page is structurally Songless and Heardle: mascot, headline, player, field. Two redesigns changed type, colour and material and were rejected as "the same design, improved".

## User
Music fans on a phone, standing or on a sofa, playing three to ten rounds in a sitting, sound on; a smaller group on a laptop with the game beside other work. Both know the rules after one round; neither reads instructions.

## Return ritual
They come back once or twice a day to keep the streak alive and to beat their own time on a harder level; the first thing they look for is the play button and the streak; the visit was worth it when a track was named from a short clip.

## Competitor map (rethink)
Axes: game-forward to music-forward, by playful to austere.
| Product | Position | Mechanism it owns |
|---|---|---|
| Heardle (Spotify, retired) | game-forward, austere | Six stacked skip bars, one per try; the original |
| Songless | game-forward, playful | Heardle rules plus difficulty tiers and filters; the layout this app copied |
| Bandle | game-forward, playful | Instruments added one per try instead of seconds |
| Lyricle | music-forward, austere | Lyrics revealed line by line; typographic |
| SongTrivia | game-forward, playful | Multiplayer rooms, timers, leaderboards |
| Shazam | music-forward, austere | One giant button; the listening state is the whole screen |
Client today: game-forward, playful, and structurally identical to Songless. Empty quadrant: music-forward and playful, where the clip itself, not the form, is the object on screen. The brief wants it.

## Job to be done
When I have a few minutes and want to test my ear, I want to hear the least possible of a song and name it, so I can feel that I know music and keep my streak.

## Primary task of this screen
Play the clip and name the track.

## Secondary tasks (ranked)
1. Skip to a longer clip.
2. See where I am in the round (which try, how long the clip is, what I already guessed).
3. Change the level; then filters, reroll, theme, settings.
4. Review the session (what I got, how fast).

## Success metric
At 1440x900 and 390x844: the play control and the guess field are both fully above the fold and within one region (measured: both bounding boxes inside the main stage region, no scroll); the main stage region uses at least 60 percent of the viewport width at 1440 (current build: 32 percent); the first-try clip length is readable as a number at 3 m (numeral at or above 40 px at 1440, 32 px at 390).
Baseline: current build at 1440x900: play control and field above the fold (yes), stage width 460 of 1440 (32 percent), numeral 24 px. At 390x844: both above the fold (yes), numeral 20 px. Measured with `scripts/measure.mjs` and the captures under `/opt/cursor/artifacts/vitrine_*.png`.

## States that must be designed
- First run: one sentence of purpose beside the play control; no modal.
- Returning: no sentence; the streak and the play control read first; last level restored.
- Loading catalogue: the ruler is drawn with no marks and the control disabled with a "Finding songs" label after 300 ms.
- Empty (filters exclude everything): one line and a "Clear filters" action in the stage.
- Playing: the playhead moves along the unlocked span; the character listens.
- Miss and skip: a mark appears on the ruler where it happened; the character reacts; the next stop unlocks.
- Won: the answer appears at the mark where it was named; the time is the headline number.
- Lost: the answer appears at the end of the ruler; every mark stays visible.
- Reduced motion: marks and moves appear without transition; the character keeps blink and gaze only.

## Constraints
See intake line 8. The five level hues stay; the streak flame stays; `NootRig.tsx` is not redrawn.

## HCI notes
Fitts: play control 56 px on desktop and 48 px on mobile, at the left end of the ruler where the thumb rests; the guess field beside it in the same row. Hick: the level switch stays five options in one segmented control in the bar. Miller and Zeigarnik: the ruler shows tries as stops, so "Try 2 of 5" is a readout, not the model. Doherty: the mark for a miss appears within 200 ms of the guess. Peak-end: the win state names the time first ("Named at 0.5 s") and the track second.

## The one idea (proposed, for the direction desk to confirm or replace)
The clip is the instrument: one time ruler the width of the room, with the stops at 0.1, 0.5, 2, 8 and 15 s, and every event of a round marked on it where it happened.
