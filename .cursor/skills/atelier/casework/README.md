# Casework

Worked examples of the run sheet applied to a real site. Read one before your first job; it shows what "an artefact per step" looks like in practice and how QA findings feed the next loop.

Each case is a folder with:

- `CASE.md`: one page. The intake card, what each desk decided and why, the kill list, what QA found, what was fixed, before and after captures.
- The run-sheet artefacts as files: `intake.md`, `brief.md`, `concept.md`, `tokens.css`, `motion-spec.md`, `qa-report.md`.
- The build the artefacts describe, small enough to open from disk or serve with `python3 -m http.server`.

Cases are also the regression suite for the skill itself: when a playbook changes, re-run a case with a smaller model and check that its QA report still passes the ship bar. A case that a smaller model cannot reproduce from the playbooks means a playbook is relying on taste where it should give a table.

| Case | Job type | Notes |
|---|---|---|
| `hacker-news/` | Redesign of a whole product (front page), before the rethink rules | Run by the book with a mid-size model; static HTML, CSS and vanilla JS over a saved `items.json`. Loop 1 passed every measurement and lost density; loops 2 and 3 met the baseline and shipped a reskin: the old structure with better type. Both failures became skill rules (brief pass J, then divergence, the ritual, the one new mechanism and the reskin test K). Keep as the negative example |
| `hacker-news-rethink/` | Rethink of the same page under the current rules | Same data, same model class, intake scope "rethink"; four structural options, one idea, one new mechanism, K scored. The case the skill is judged by |
| `songguessr/` | Rethink of a live React product (this repository's game) | Intake scope "rethink" after two rejected reskins; option 2 of four (the round as a timeline) built into the real app, not a mock; K scored blind by a second agent whose blunt line ("a good idea left half-empty") drove loop 2. The first case where the build lives in `src/`, so the artefacts point at it rather than carrying their own copy |
