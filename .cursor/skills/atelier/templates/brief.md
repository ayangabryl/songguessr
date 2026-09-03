# Brief: <screen or product>

Owner: strategy desk. Consumed by: direction, layout, typography, colour, motion, interaction, qa.

## Problem
<One paragraph, five lines at most. What is wrong or missing today, stated as an observed behaviour or measurement, not an opinion.>

## User
<Primary user in two lines: who, context, device, frequency, skill level. Secondary user in one line if any.>

## Return ritual
<When the user comes back, what they look for first, what makes the visit worth it. One line. If the product is not returned to, write "none" and the scope is a refresh.>

## Competitor map (rethink and brand jobs)
Axes: <x, e.g. dense to airy> by <y, e.g. expert to beginner>.
| Product | Position | Mechanism it owns |
|---|---|---|
| <one of six> | <x, y in words> | <one line> |
Client today: <position>. Empty quadrant: <position, and whether the brief wants it>.

## Job to be done
When <situation>, I want to <motivation>, so I can <outcome>.

## Primary task of this screen
<One sentence. This is the thing the layout must make fastest and clearest. Everything else is secondary.>

## Secondary tasks (ranked)
1. <task>
2. <task>
3. <task>

## Success metric
<Two numbers QA can read off the rendered build with `scripts/measure.mjs` or a capture, each with its viewport. One measures the primary task; one is a floor read from the current build so the redesign cannot regress it. Examples: "at least 24 stories fully above the fold at 1440x900 and 12 at 390x844 (current build: 25 and 15)", "primary action reachable in one tap from load", "time to first play under 3 s". Not acceptable: "legible", "cleaner", "structural".>
Baseline: <the same numbers measured on the current build, with the command used>

## States that must be designed
- First run: <what the user sees with no history>
- Returning: <what changes>
- Empty: <no data>
- Loading: <what is shown, for how long before a skeleton or message>
- Error: <the message and the recovery action>
- Success or end state: <what confirms completion>

## Constraints
<Stack, brand, deadlines, accessibility target, performance budget, reduced motion, locales, anything the client said must not change.>

## HCI notes
<Which laws bind this screen and the numeric consequence: e.g. Hick's law, five difficulty options, one segmented control; Fitts' law, primary action 56 px at thumb reach on mobile; Doherty, feedback under 400 ms.>

## The one idea (proposed, for the direction desk to confirm or replace)
<One line.>
