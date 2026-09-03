# Atelier

A design studio written down. One skill (`SKILL.md`, the front desk) routes work to fourteen departments, each with its own playbook, references and scripts. Load the front desk; it tells you which desks to open, in what order, and what each must hand to the next.

```
atelier/
├── SKILL.md                  Front desk: intake, routing, run sheet, hand-offs, done gate
├── README.md                 This map, plus the house style for writing playbooks
├── departments/
│   ├── strategy/             Intake, project archaeology, users, HCI, the brief
│   ├── direction/            The one idea, references, kill list, direction catalogue, slop catalogue, audit, studio practice
│   ├── brand/                Positioning, mark system, design language, decks, social, print, email, guidelines, asset kit
│   ├── layout/               Spacing, radius, alignment, grids, responsive, layers, section library
│   ├── typography/           Pairing, scale, micro-typography, typeface catalogue
│   ├── colour/               OKLCH palettes, light and dark systems, contrast maths
│   ├── motion/               Tokens, dialects, choreography, pattern catalogue, reduced motion
│   ├── interaction/          States, feedback, forms, gestures, micro-interactions
│   ├── creative-web/         Scroll-driven scenes, set pieces, canvas, when creative is right
│   ├── illustration/         SVG craft, icons, marks, mascots and character animation
│   ├── imagery/              Photography and generated-image direction, image specs, shot lists, prompts, formats
│   ├── words/                Voice, headlines, microcopy, forms, case studies, letters, the copy deck
│   ├── engineering/          CSS architecture, font loading, performance budgets, accessibility
│   └── qa/                   Verification protocol on the rendered build, scoring, report
├── scripts/                  Shared tooling: headless Chrome, capture, measure, contrast, motion audit
├── templates/                Brief, concept, token sheet, motion spec, QA report
└── casework/                 Worked examples: the full run sheet applied to a real site
```

Each department folder holds `PLAYBOOK.md` (the desk's rules, decision tables, defaults, hand-off template and checklist) and, when needed, `references/` for long catalogues loaded on demand. Department playbooks are deliberately not named `SKILL.md`: Cursor discovers every `SKILL.md` under `.cursor/skills` recursively, and the atelier is meant to surface as one skill with the front desk as its only entry.

## Why this shape

- Progressive disclosure. The front desk is short and read once. A playbook is read only when its desk is on the run sheet. A reference is read only when a table in the playbook points at it. This is how the Agent Skills format expects skills to be built (metadata, then instructions, then resources).
- One entry, many specialists. A studio is not one person with taste; it is people who hand each other specific artefacts in a fixed order, and a director who says no. The routing table and run sheet in `SKILL.md` encode that order.
- Same output from any model. Every desk states a default and an escape hatch rather than a list of options, puts numbers where a stronger model would rely on instinct, ships scripts that measure instead of asking the agent to judge, and gates progress on artefacts existing. A smaller model following the tables lands in the same place a larger one lands by intuition.

## Using the atelier

1. Read `SKILL.md`.
2. Run intake (or project archaeology if no client is available). Write the intake card.
3. Follow the routing table for the job type; open only the playbooks it lists.
4. Produce every hand-off artefact on the run sheet. Do not skip a step to save time; the artefacts are what keep a redesign from regressing into a template.
5. Run QA with the scripts, score with the audit, ship or loop.

## House style for playbooks

Playbooks are read by agents under time pressure. Write them accordingly.

Structure (in this order, numbered):
1. When the front desk calls this desk
2. Inputs required (which upstream artefacts must exist)
3. Decisions this desk owns (decision tables: situation, default, escape hatch)
4. Rules (numbered, each with a number and a source or `[house]`)
5. Defaults (copy-paste tokens or snippets)
6. Anti-patterns (what slop looks like at this desk)
7. Hand-off artefact (the exact template)
8. Checklist (yes/no, five minutes)
9. Sources

Rules of writing:
- Frontmatter with `name` (matches the folder) and `description` (what the desk decides and when the front desk calls it).
- Under 350 lines per playbook; long catalogues go to `references/` and stay under 400 lines each. One level of reference only.
- Defaults first: "Use X. If Y, use Z." Never a list of equal options.
- Numbers, not adjectives: durations in ms, sizes in px, ratios to two decimals, angles in degrees.
- Tag every claim: `[source: author or spec, year]` or `[house]`. Sources are listed at the end with URLs.
- Sentence case for headings and labels. British spelling (colour, centre, behaviour).
- No emojis, no marketing prose, no "premium" or "beautiful" as an adjective without a measurable next to it.
- Snippets must run as written (CSS, JS in the browser, Python 3, bash).
- Anti-patterns name the failure and the fix, not just the failure.

## Validating

- Frontmatter: `name` is lowercase, hyphens only, matches the folder; `description` is under 1024 characters and says both what and when.
- Only one `SKILL.md` exists under `atelier/`.
- Every relative path mentioned in a playbook resolves (`scripts/check-links.sh`).
- Scripts run from a clean shell with Node 20+, Python 3 and Chrome installed (`scripts/chrome.sh` starts the browser).

## Extending

Add a desk by creating `departments/<name>/PLAYBOOK.md` in the house style, then add one row to the roster table and, if it changes the order of work, one line to the run sheet in `SKILL.md`. Add a worked example by creating `casework/<name>/CASE.md` that shows every artefact of the run sheet for one real project.
