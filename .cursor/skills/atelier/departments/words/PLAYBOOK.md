---
name: words
description: The words desk. Owns every word the user reads - voice, reading level, headlines, decks, microcopy (buttons, labels, errors, empty and loading states, confirmations, notifications, consent), forms, numbers and dates, navigation labels, marketing sections, case studies, letters and newsletters, about pages, alt text, inclusive and localisable language - and the copy deck that QA checks in its copy pass. The front desk calls it at run-sheet step 4 (Build) for every job that ships text, before typography sets it, and at step 7 beside QA.
---

# Words

The copywriter on the studio team. Typography decides how text is set (`../typography/PLAYBOOK.md`); this desk decides what it says. Strategy hands over the vocabulary and the message formula (`../strategy/PLAYBOOK.md`, sections 3.4 and 6); this desk turns them into every string on the screen and every paragraph on the site. Numbers here are defaults; a rule in this file is the only thing that overrides them. `[source: ...]` is traceable to section 9; `[house]` is a studio rule.

The playbook is written in British English. Copy is not: every string matches the product's locale (intake line 8), and a product with several locales gets one deck per locale. `[house]`

## 1. When the front desk calls this desk

- Run-sheet step 4 (Build): write the copy deck (section 7) before typography sets the type; a headline group cannot be sized until the headline exists.
- Run-sheet step 7 (Verify): QA runs the copy pass (`../qa/PLAYBOOK.md`, section 4.7) against the deck; this desk fixes findings.
- Routing rows "Marketing, brand or portfolio site" and "Redesign" always; "New page" and "New feature" when the page or component introduces any string not already in the product.
- "Make it premium" and audit jobs: copy slop (section 6) is scored with the direction desk's catalogue items 46 to 48.
- Not called for: type setting, numerals as glyphs, measure (typography); state timing and which states exist (`../interaction/PLAYBOOK.md`); who the user is (strategy).

## 2. Inputs required

| Artefact | From | What this desk reads from it |
|---|---|---|
| Intake card, lines 1, 7 and 8 | front desk | Who reads (decides grade level), the three tone words and the forbidden word (decide voice), locales |
| `brief.md` | strategy | Primary task (the verb of the primary CTA), the user's own words from tickets and search logs, first-run and returning states |
| `concept.md` | direction | The one idea (the headline is its claim), the kill list (often names current copy) |
| State list | interaction | Every state that needs a string: empty, loading, error, success, disabled, offline |
| Type spec | typography | Character limits per role (headline lines, deck measure, button width) |

Stop condition: no string is written until the voice card (section 3.1) exists and the primary task is on the brief. `[house]`

## 3. Decisions this desk owns

### 3.1 Voice

Derive the voice from intake line 7, never from the brand deck. Take the three tone words; for each, write the word it is often confused with; the pairs become the "this, not that" table. The forbidden word from the card is the fourth row and is also a grep target on the finished build. `[house]`

| Situation | Default | Escape hatch |
|---|---|---|
| Tone words exist | Three-word voice, one adjective each, verified against three existing strings the client likes | Tone words are style words ("premium"); strategy converts them to mechanisms first (`../strategy/PLAYBOOK.md`, 3.1) |
| No client (archaeology) | Voice read from the product's most repeated verbs and its error copy; mark as a guess | Two voice cards; direction picks with the direction |
| Tool or dashboard | Plain, direct, brief | Warm only in empty states and onboarding |
| Consumer app | Plain, warm, specific | Playful only where the mascot or the reveal already is; never in errors |

Worked example (this repo's game): voice "quick, warm, exact".

| This | Not that |
|---|---|
| Quick: "Play" | Chatty: "Ready to test your music knowledge?" |
| Warm: "Nice, 12 in a row." | Gushing: "Amazing!!! You're on fire!" |
| Exact: "No songs match 'nirvna'." | Vague: "Something went wrong." |
| Never: "gamified" | The forbidden word from the card; grep the build for it |

### 3.2 Reading level and sentence length

| Situation | Default | Escape hatch |
|---|---|---|
| Consumer product | Flesch-Kincaid grade 6 to 8; average sentence under 20 words; one idea per paragraph, 1 to 3 sentences | Legal and medical text may reach grade 10 with a plain summary above it |
| Tool, developer or B2B product | Grade 8 to 10; average sentence under 20 words; domain nouns kept, everything around them plain | Never above grade 12 anywhere the user must act |
| Microcopy | Under 12 words per string; one clause | Errors: up to 3 sentences, one each for what, why, next |

Measure with a readability tool (section 9) on the whole deck, not on one paragraph. `[source: GOV.UK, reading age 9 for a general audience; plainlanguage.gov; Flesch 1948; house numbers]`

### 3.3 Headlines and decks

| Situation | Default | Escape hatch |
|---|---|---|
| Any headline | 8 words max; a claim (what changes for the reader), not a category ("Features"); passes the "so what" test: a reader can answer "so what?" from the headline alone | A headline over 8 words is a deck; cut it and write the deck |
| Verb-led or noun-led | Verb-led when the direction is active or the product is a tool ("Ship the fix before the ticket lands"); noun-led when the direction is calm or editorial ("A calmer inbox") | Direction states which in `concept.md`; the desk does not mix on one page |
| Method | Write 3 candidates per headline, read each aloud, pick the one with the concrete noun; the other two go in the deck notes column | One candidate only for section headings inside product UI |
| Deck (subline) | 25 words max, one sentence, adds the mechanism or the proof the headline left out; never restates it | No deck when the headline has a number in it |
| Section headings in UI | Nouns, sentence case, 1 to 3 words | Verb-led when the section is a task ("Invite your team") |

Headline tests, in order: so what; would a competitor write this word for word (if yes, cut); is there a noun you can picture. `[source: NN/g, F-pattern and first two words; house]`

### 3.4 Format by surface

| Surface | Length | Structure | Model |
|---|---|---|---|
| Feature blurb (marketing) | 20 words max | Benefit first, then mechanism | Section 4.4 |
| Case study | 120 to 250 words before the images | One line, problem, what we did, how, outcome, credits | otherkind.design project blurb (section 4.5) |
| Letter or newsletter | 300 to 600 words | Thesis in line one, one idea, plain text first | letters.otherkind.design (section 4.6) |
| About page or manifesto | 5 to 9 declaratives, 60 to 150 words | What we believe, one sentence each | Section 4.7 |
| Empty state | Under 20 words plus one button | What this is, one action | Section 4.1 |

### 3.5 Numbers, dates, units and locale

| Situation | Default | Escape hatch |
|---|---|---|
| Time under 7 days old | Relative: "3 min ago", "yesterday", "Tuesday"; hand the element to typography as tabular (`../typography/PLAYBOOK.md`, rule 19) | Audit logs and receipts: always absolute |
| Time 7 days or older | Absolute in the locale's format with `Intl.DateTimeFormat`; year only when not the current year | Add the relative form in a tooltip only if the UI already has tooltips |
| Units | Number, thin space (U+2009), unit symbol: "12 MB", "3 km"; percent as "12 percent" in prose and "12%" in tables and labels | Currency follows `Intl.NumberFormat` with the locale's symbol position |
| Large numbers | Group per locale (`Intl.NumberFormat`); round to 2 significant figures in prose ("4.3M visits"), exact in tables | Legal and financial: never round |
| Ranges | En dash without spaces in tables ("9–17"), "to" in prose | Locale rules win |

## 4. Rules

### 4.1 Microcopy

1. Buttons: verb plus object, 1 to 3 words, sentence case; the label answers "what happens when I press this". Never "Submit", "Click here", "OK", "Yes" or "No" alone. `[source: NN/g microcopy; Material Design writing; house]`
2. Labels: nouns, sentence case, no trailing colon, no articles. `[source: GOV.UK content design; Polaris]`
3. Placeholders: an example, never an instruction, and never the only label ("name@example.com", not "Enter your email"). `[source: NN/g placeholders; slop catalogue 59]`
4. Empty states: what this is (one sentence) plus one action, and the action is the primary task's verb. No illustration-only empties. `[house]`
5. Errors: three sentences at most, in order: what happened, why (only if the user can act on it), what to do now. No blame ("you entered"), no codes in the sentence, no "Oops", no exclamation marks. Formula and examples: `../strategy/PLAYBOOK.md`, section 6. `[source: NN/g error message guidelines; Nielsen heuristic 9; house]`
6. Loading: appears only after 1 s; says what is happening with the object ("Loading your 12 playlists"), not "Please wait". Timing is the interaction desk's. `[source: NN/g response times; house]`
7. Success: confirm the object and the change ("Playlist saved"), never "Success!" or "Done!". One line; disappears with the toast. `[house]`
8. Confirmations: only for destructive or irreversible actions (strategy's hierarchy prefers undo). Name the object and the consequence in the question; the confirm button repeats the verb ("Delete 3 photos?" with Delete and Keep). Never "Are you sure?". `[source: Nielsen heuristic 5; Apple HIG alerts; house]`
9. Tooltips: only on icon-only controls, 1 to 4 words, the same text as the accessible name. Anything that needs a tooltip to be understood needs a label instead. `[source: Nielsen heuristic 6; house]`
10. Notifications: event, object, time, in that order ("Ana commented on Q3 plan, 2 min ago"); no marketing in system notifications. `[source: Material Design notifications; house]`
11. Permissions and consent: the plain reason first, then the ask ("To save photos, the app needs access to your library."); the decline path is a real verb, not "Not now" in grey. `[source: Apple HIG privacy; house]`
12. Disabled controls carry a one-line reason beside them, never only a tooltip. `[source: slop catalogue 57]`

### 4.2 Forms

13. Label above the field, help text under the label (before the input), error inline under the input with the field name in the sentence. Never placeholder-as-label. `[source: GOV.UK form design; NN/g form guidelines]`
14. Label as a noun for known data ("Email"), as a question when the field needs thought ("What should we call this project?"). One form uses one convention. `[source: GOV.UK question pages; house]`
15. Optional fields are marked "(optional)"; required ones carry no asterisk. If more than a third of fields are optional, cut fields. `[source: GOV.UK; house threshold]`
16. Error summaries at the top of long forms repeat each inline error as a link to the field. `[source: GOV.UK error summary]`

### 4.3 Navigation labels

17. The user's words from tickets, search logs and the repo's own copy; 1 to 2 words; nouns; no clever, no brand verbs ("Explore" for a list is "Songs"). Consistency with the platform beats brand voice (Jakob). `[source: Nielsen heuristic 2; strategy 3.4; house]`
18. The same destination has the same label everywhere: nav, breadcrumb, page title, browser tab. `[source: Nielsen heuristic 4]`

### 4.4 Marketing sections

19. Feature blurb: 20 words max; benefit before mechanism ("Find any file in under a second. Search runs on your device."). `[house]`
20. Proof with a number and a noun: "4.3M visits in the first week", never "trusted by thousands". `[source: slop catalogue 9, 46; otherkind.design]`
21. One CTA per section, one verb, one object; "Learn more" appears at most once per page and never as the only CTA. `[house]`
22. Testimonials: one quote, one name, one role; the quote names a mechanism or a number. `[source: slop catalogue 56]`

### 4.5 Case studies

23. Structure, in order: one-line what (client, thing, year); the problem in the client's terms (1 to 2 sentences); what we did in 3 sentences; how, with 2 to 3 named mechanisms; outcome with a number and a timeframe; credits to partners by name and role; then the images. `[house; model: otherkind.design]`
24. 120 to 250 words before the first image. The reader decides to scroll from the text, not from the hero. `[house]`
25. The model blurb (otherkind.design, Cloudflare Workers, read 2026): 4 sentences, about 70 words. Sentence 1 what we did ("helped Cloudflare reimagine their Workers presence"), sentence 2 how ("refreshed the brand, rebuilt the site ..., unified the narrative across compute, storage, and AI"), sentence 3 the outcome with a number and a timeframe ("4.26M+ visits in its first week"), sentence 4 the credit ("Development by Off-brand Studio"). Copy that shape; change the nouns. `[source: otherkind.design]`
26. No "we're passionate about", no adjectives about our own work; the number is the adjective. `[house]`

### 4.6 Letters and newsletters

27. First person, one idea, 300 to 600 words. The opening line is the thesis; a reader who stops after line one knows what you think. `[house; model: letters.otherkind.design]`
28. Café-table voice, not stage voice: write as if across a table to one person; no "In this issue", no "Hey everyone", no emoji in subject lines, no section headers inside the letter. Subject line is the thesis in 8 words or fewer. `[source: letters.otherkind.design; Mailchimp style guide]`
29. Short paragraphs: 1 to 3 sentences, 25 to 50 words; average sentence 10 to 16 words. Measured on the model: 9 letters, 100 to 460 words, average sentence 9 to 16 words, paragraphs averaging 11 to 57 words, each letter one idea with the first line as thesis (API read 2026). `[source: letters.otherkind.design, measured]`
30. Plain-text-first layout: one column, no hero image, one link per idea, sign-off with a name and a place. Typography sets it (`../typography/PLAYBOOK.md`, 3.1 editorial row). `[house]`

### 4.7 About pages and manifestos

31. Say what you believe in 5 to 9 short declaratives, one sentence each, each one falsifiable ("We ship one idea per screen", not "We care deeply"). No "passionate", no "mission", no "journey". `[house]`
32. Team sections list names and what each person decides, not bios. `[house]`

### 4.8 Alt text and accessibility copy

33. Alt text describes what the image shows in the context of the page, 125 characters or fewer, no "image of"; decorative images get `alt=""`. Charts: alt states the conclusion ("Visits rose from 1.2M to 4.3M in week one") and a table or caption carries the data. Icon-only buttons take the button's verb as the accessible name. Live regions announce the result, not each tick. The imagery desk's rules for image description (`../imagery/PLAYBOOK.md`, rule 19) win where they differ. `[source: WCAG 2.2 1.1.1, 4.1.2; W3C alt decision tree; house]`
34. Link text says the destination ("Read the Cloudflare case study"), never "here" or "this". `[source: WCAG 2.4.4; GOV.UK]`

### 4.9 Inclusive, plain and localisable

35. Plain words: use, not utilise; start, not commence; help, not facilitate. Pick the shorter word when both are exact. `[source: plainlanguage.gov word list; GOV.UK A to Z]`
36. Inclusive by default: "they" for an unknown person; no gendered role nouns; no ability metaphors as insults ("blind spot", "crippled") or as praise ("insanely fast"). `[source: Material Design inclusive writing; Polaris]`
37. Localisable: no idioms, no puns, no culture-bound metaphors; no sentences built from fragments and variables ("You have " + n + " items"); ICU plurals; leave 30 percent width headroom on buttons for German and Finnish. `[source: Material Design; Polaris internationalisation; house]`
38. Match the product's locale in spelling, date order, decimal separator and quotation marks; never mix within a screen. `[house]`

### 4.10 Copy review method

39. Read every string aloud; anything you would not say to a person across a table is rewritten. `[house]`
40. Cut 20 percent of the words from the first draft of every paragraph. Then check the grade level (3.2). `[source: Butterick; GOV.UK]`
41. One idea per screen and per paragraph: if a screen's copy has two verbs competing for the primary CTA, the brief's primary task wins and the other becomes secondary. `[house]`
42. Count verbs: every CTA, button and headline has one; a section with no verb has no ask. `[house]`
43. Find the number: every proof claim, outcome and testimonial carries a number or is cut. `[house]`

## 5. Defaults

Copy-paste strings; replace the bracketed nouns. Sentence case, locale spelling.

```text
Buttons        Save changes · Create project · Send invite · Delete [n] [items] · Try again · Keep editing
Empty          No [items] yet. [Create your first item]     |  No [items] match "[query]". Try [alternative].
Loading        Loading your [items]…                          (show after 1 s; interaction desk owns the timing)
Success        [Item] saved. · Invite sent to [name]. · [n] [items] deleted. Undo
Error network  Couldn't load [items]. Check your connection and try again.        [Try again]
Error input    Enter an email address with an @, like name@example.com.
Error server   Couldn't save [item]. Your changes are still here; try again in a minute.
Confirm        Delete [item]? This removes it for everyone on the team.            [Delete] [Keep]
Notification   [Name] [verb-ed] [object] · [relative time]
Permission     To [benefit], [product] needs [access]. You can change this in Settings.   [Allow] [Don't allow]
Tooltip        [Verb object]  (same text as the accessible name)
Nav            Home · Songs · Playlists · Settings   (nouns from the user's own words)
Deck           One sentence, 25 words max, the mechanism or the proof the headline left out.
Case study     [Client], [thing], [year]. / Problem in their words. / What we did (3 sentences). / How (2 to 3 mechanisms). / [Number] in [timeframe]. / [Role] by [partner].
Letter         Line 1 is the thesis. 300 to 600 words. Sign-off: [name], [place].
```

## 6. Anti-patterns

Each hit is recorded as a copy finding with the location; three hits in the core loop fail the copy pass. `[house]`

| Slop | Why it fails | Fix |
|---|---|---|
| "Elevate", "Unleash", "Empower", "Revolutionise", "Supercharge" | Verbs with no object a reader can picture | Name the action and the object: "Find the file", "Ship the fix" |
| "Seamless", "Effortless", "Delightful", "Blazing fast", "Next-gen" | Adjectives with no measurement | A number or a mechanism: "under 200 ms", "runs on your device" |
| Em-dash chains (two or more per paragraph) | Hides a second idea in the sentence | Split into two sentences; one idea each |
| Triads of adjectives ("fast, simple, powerful") | Rhythm in place of a claim | One concrete claim with a noun |
| Rhetorical questions as headlines ("Tired of slow builds?") | Delays the claim; reader answers "no" | State the claim: "Builds finish in 40 s" |
| "Welcome to the future of", "In today's fast-paced world" | Interchangeable openers | Delete the sentence; start with the thesis |
| Exclamation marks in UI | Tone over information | Full stop, or no punctuation on a label |
| "Oops!", "Uh oh", "Something went wrong" | No what, why or next step | Rule 5: what happened, why, what to do (slop catalogue 48) |
| Title Case On Every Label | Reads as a template; slows reading | Sentence case (slop catalogue 47) |
| "Learn more" as the only CTA | No verb, no object, no ask | One verb plus object per section (rule 21) |
| Hedging: "simply", "just", "easily", "quickly" | Blames the reader when it is not simple | Delete the adverb; if the step is hard, say how long it takes |
| Emoji bullets and emoji in subject lines | Inconsistent rendering; tonal mismatch | Plain list; the subject is the thesis |
| "Submit", "Click here", "OK" | Says nothing about the outcome | Rule 1: verb plus object |
| Placeholder as the only label | Vanishes on input | Rule 13: label above (slop catalogue 59) |
| "Are you sure?" | Names neither object nor consequence | Rule 8 |
| "Please wait…" | Says nothing about what or how long | Rule 6: the object being loaded |
| Generic taglines ("Unlock your potential") | Says nothing; interchangeable | A concrete claim with a noun and a number (slop catalogue 46) |
| Marketing voice inside product errors | Two voices on one screen | The voice card applies everywhere; warmth only where 3.1 allows |
| Idioms and puns in nav or buttons | Do not localise; slow non-native readers | Rule 17 and 37 |

## 7. Hand-off artefact

Two tables in `copy-deck.md`. Typography reads the character limits; interaction reads the states; QA greps the build against the strings column. Every string on the screen is a row; a string that is not in the deck is a finding.

```markdown
## Voice card: <project>
Voice: <word 1>, <word 2>, <word 3>   ·   Never: <forbidden word from intake line 7>
Locale(s): <en-GB>   ·   Grade level: <6 to 8 | 8 to 10>   ·   Headlines: <verb-led | noun-led>

| This | Not that |
|---|---|
| <word 1>: "<example string>" | <confusable>: "<counter-example>" |
| <word 2>: "<example string>" | <confusable>: "<counter-example>" |
| <word 3>: "<example string>" | <confusable>: "<counter-example>" |

## Copy deck: <project>

| Location | String | State | Character limit | Notes |
|---|---|---|---|---|
| Home / hero h1 | Guess the song in five tries | default | 40 (2 lines at --fs-6) | Candidates rejected: "Test your ear", "Five tries. One song." |
| Home / hero deck | Hear a clip, type a title, pick from the list. Your streak carries over. | default | 140 | 14 words |
| Play / primary button | Play | idle, paused | 12 | verb; the only accented control |
| Play / input placeholder | Smells Like Teen Spirit | empty | 40 | example, not instruction |
| Play / suggestions empty | No songs match "nirvna". Try the artist name. | empty | 60 | rule 4 |
| Play / network error | Couldn't load the next song. Check your connection and try again. | error | 90 | button: Try again |
| Play / skip confirm | Skip this song? Your streak stays at 12. | confirm | 60 | buttons: Skip, Keep guessing; number tabular |
| Result / success | Nice, 12 in a row. | success | 30 | numeral tabular |
| Nav / playlists | Playlists | default | 14 | user's word from tickets |
```

## 8. Checklist

Run on the deck plus one grep of the rendered DOM. Any "no" is a fail.

- [ ] Voice card exists with three words, a this-not-that row each, and the forbidden word; the build has zero hits for the forbidden word?
- [ ] Deck reads at grade 6 to 8 (consumer) or 8 to 10 (tool); average sentence under 20 words?
- [ ] Every headline 8 words or fewer, passes "so what", and had 3 candidates?
- [ ] Every deck 25 words or fewer and adds a mechanism or a proof?
- [ ] Every button is verb plus object; zero "Submit", "OK", "Click here", "Learn more"-only?
- [ ] Every error has what, why, next; zero "Oops", zero exclamation marks in UI?
- [ ] Empty, loading and success strings exist for every state on the interaction desk's list?
- [ ] Destructive confirmations name the object and the consequence, and the button repeats the verb?
- [ ] Labels above fields, help under labels, errors inline; no placeholder-as-label?
- [ ] Dates relative under 7 days and absolute after; units with a thin space; locale formats via `Intl`?
- [ ] Zero hits from the section 6 table in the core loop; at most three anywhere?
- [ ] Every proof claim carries a number and a noun?
- [ ] Alt text under 125 characters, decorative images `alt=""`, link text names the destination?
- [ ] Copy deck complete: every rendered string is a row with a state and a character limit?

## 9. Sources

- Butterick, Practical Typography (writing shorter, punctuation, numerals): https://practicaltypography.com/
- NN/g, microcopy: https://www.nngroup.com/articles/microcontent-how-to-write-headlines-page-titles-and-subject-lines/ ; error message guidelines: https://www.nngroup.com/articles/error-message-guidelines/ ; plain language for everyone: https://www.nngroup.com/articles/plain-language-experts/ ; F-shaped reading pattern: https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/ ; placeholders in form fields: https://www.nngroup.com/articles/form-design-placeholders/ ; response time limits: https://www.nngroup.com/articles/response-times-3-important-limits/
- GOV.UK, content design: https://www.gov.uk/guidance/content-design ; writing for GOV.UK (reading age, sentence length): https://www.gov.uk/guidance/content-design/writing-for-gov-uk ; style guide A to Z: https://www.gov.uk/guidance/style-guide/a-to-z-of-gov-uk-style ; Design System, question pages and error summary: https://design-system.service.gov.uk/patterns/question-pages/ https://design-system.service.gov.uk/components/error-summary/
- Mailchimp Content Style Guide (voice and tone, email): https://styleguide.mailchimp.com/
- Apple Human Interface Guidelines, Writing: https://developer.apple.com/design/human-interface-guidelines/writing ; Alerts: https://developer.apple.com/design/human-interface-guidelines/alerts ; Privacy: https://developer.apple.com/design/human-interface-guidelines/privacy
- Material Design, writing guidelines (UX writing best practices, inclusive, global): https://m3.material.io/foundations/content-design/overview ; notifications: https://m3.material.io/foundations/content-design/notifications
- Shopify Polaris, content guidelines (actionable language, grammar, internationalisation): https://polaris.shopify.com/content
- Flesch, R. A new readability yardstick (1948): https://doi.org/10.1037/h0057532 ; Hemingway Editor (grade level and sentence checks): https://hemingwayapp.com/ ; Flesch-Kincaid reference: https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests
- plainlanguage.gov, federal plain language guidelines and word list: https://www.plainlanguage.gov/guidelines/ https://www.plainlanguage.gov/guidelines/words/use-simple-words-phrases/
- WCAG 2.2, 1.1.1 non-text content, 2.4.4 link purpose, 4.1.2 name role value: https://www.w3.org/TR/WCAG22/ ; W3C alt text decision tree: https://www.w3.org/WAI/tutorials/images/decision-tree/
- letters.otherkind.design, "Dear Designer" letters (first person, café-table voice, thesis in line one; 9 letters measured via `/api/letters`, 2026): https://letters.otherkind.design/
- otherkind.design, project blurbs (what, how, outcome with a number, credit; Cloudflare Workers, read 2026): https://www.otherkind.design/projects?project=cloudflare
- Upstream and downstream desks: `../strategy/PLAYBOOK.md` (message formula, user vocabulary), `../typography/PLAYBOOK.md` (setting, numerals), `../interaction/PLAYBOOK.md` (states and timing), `../qa/PLAYBOOK.md` (copy pass 4.7), `../direction/references/slop-catalogue.md` (items 46 to 49).
