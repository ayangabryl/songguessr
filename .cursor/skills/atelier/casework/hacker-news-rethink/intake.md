# Intake card: Hacker News, front page (rethink)

Date: 2026-09-03. Source: client conversation. Lines marked (guess) were not confirmed by a client.

1. Product and users: a ranked list of 30 tech/culture links with discussion threads, read by working developers and founders at a desk or on a phone, several times a day, in short (60 to 120 s) sessions between other work.
2. Primary task of the screen: scan the list and decide which one or two threads are worth opening right now. Secondary, competing task: see what changed since the last visit. When the two compete, seeing-what's-new wins, because that is the reason for a repeat visit rather than a first one.
3. Success: at least as many stories readable above the fold as the current build (24 at 1440x900, 12 at 390x844), and a returning visitor can name what is new within one glance, measured by `scripts/measure.mjs --count` and the reskin/idea checks in `qa-report.md`.
4. Must not change: the orange as the brand's own accent hue; static HTML/CSS/vanilla JS with no framework, no build step and no network request beyond the local `items.json`; the 30-story dataset and its seven fields (title, url, domain, points, by, age, comments).
5. References the client likes: none named directly; the client's own words ("dense", "honest", "keep it fast") are read as three mechanisms, not looks (see `concept.md` references).
6. Dislikes (current state or a previous studio's pass): (guess, from the brief) a prior redesign kept the exact ranked-list structure and only reset the type, which the client explicitly rejects as "not what we asked for"; the current live page gives no visible signal for what changed since the last visit; a flat, undifferentiated list treats a five-times-a-day reader the same as a first-time visitor.
7. Tone: dense, honest, alive. Never: flashy.
8. Constraints: framework none (static HTML, CSS, vanilla JS, no build step); performance budget LCP under 2.5 s, JS under 40 kB gzipped, fonts under 60 kB (one variable file); accessibility WCAG 2.2 AA; reduced motion honoured (split policy); locales English only.
9. Scope: rethink. The client used "redesign" and explicitly rejected a prior rethink that shipped the old structure with better type ("that is not what we asked for"); per SKILL.md section 1, redesign defaults to rethink, and this client has already burned the refresh/reskin option once.
