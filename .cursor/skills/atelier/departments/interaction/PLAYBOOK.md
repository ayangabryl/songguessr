---
name: interaction
description: Owns the designed states of every control (default, hover, focus-visible, pressed, disabled, loading, selected, invalid, read-only), feedback timing, forms, gestures and touch, keyboard and focus, affordance and signifiers, micro-interactions, and the empty, loading and error states of every screen. The front desk calls this desk at run-sheet step 4 (build) on every redesign, new page, new feature or component, and on any motion or interaction pass; it hands a state sheet and a copy sheet to the motion and QA desks.
---

# Interaction: states, feedback, forms, gestures, micro-interactions

This desk decides how every control looks in every state, how fast the product answers, how forms behave, what touch and keyboard users get, and which small motions confirm an action. HCI laws with their numbers (Fitts, Hick, Doherty, Miller) live in `../strategy/PLAYBOOK.md` section 4; motion tokens and dialects live in `../motion/PLAYBOOK.md`. This desk references both and duplicates neither. Tokens named below come from `../../templates/tokens.css`.

## 1. When the front desk calls this desk

- Run-sheet step 4 (build), after `tokens.css` exists, for redesigns, new pages, new features and components. `[house]`
- Any "motion or interaction pass only" job, alongside the motion desk. `[house]`
- Whenever a screen has a form, a list that can be empty, an async action, a gesture, or a control that is not a native element. `[house]`
- Whenever QA reports a state that was never designed (a hover with no focus twin, a spinner under 300 ms, a disabled button with no reason). `[house]`

## 2. Inputs required

| Artefact | From | Must contain |
|---|---|---|
| `brief.md` | strategy | Primary task in one sentence; device and context; first-run and returning states |
| `tokens.css` | layout, typography, colour, motion | `--space-*`, `--r-*`, `--focus`, `--line`, `--surface-2`, `--accent`, `--dur-1` to `--dur-4`, `--ease-out`, `--ease-in-out`, `--ease-land`, `--z-toast` |
| `concept.md` | direction | Kill list (interaction items on it are not redesigned, they are removed); on a rethink, the one new mechanism this desk must specify |
| Motion dialect | motion | The one dialect chosen in `../motion/PLAYBOOK.md` section 3 |

Stop condition: no state is designed until `tokens.css` carries `--focus` and the four duration tokens. If `--danger` is missing, add it (section 5) with its reason and hand the pair to the colour desk for measurement. `[house]`

## 3. Decisions this desk owns

### 3.1 State matrix

`y` means the state must be designed and appear on the state sheet; `-` means the control does not have that state. Hover applies to pointer devices only, under `(hover: hover)`. `[house]`

| Control | default | hover | focus-visible | pressed | disabled | loading | selected or checked | invalid | read-only |
|---|---|---|---|---|---|---|---|---|---|
| Button | y | y | y | y | y | y | - | - | - |
| Link | y | y | y | y | - | - | y (current page) | - | - |
| Input | y | y | y | - | y | y (async check) | - | y | y |
| Select | y | y | y | y (open) | y | y | y (has value) | y | y |
| Checkbox | y | y | y | y | y | - | y (+ indeterminate) | y | y |
| Switch | y | y | y | y | y | y (async) | y | - | y |
| Segmented control | y | y | y | y | y (whole group) | - | y | - | - |
| Tab | y | y | y | y | y | y (panel) | y | - | - |
| Card as link | y | y | y | y | - | y (skeleton) | - | - | - |
| List row | y | y | y | y | y | y (skeleton) | y | - | - |
| Icon button | y | y | y | y | y | y | y (aria-pressed) | - | - |
| Slider | y | y (thumb) | y | y (dragging) | y | - | - | y (out of range) | y |

Default visual change per state. Numbers are the default; a dialect in the motion playbook may change the token, never the intent.

| State | Visual change | Token | Motion |
|---|---|---|---|
| Hover | Surface lightness shifts 0.03 in OKLCH (light theme minus, dark theme plus) or the 1 px `--line` steps to `--text-3` | `--hover-shift`, `--line` | `--dur-1` `--ease-out` |
| Focus-visible | 2 px solid ring, 2 px offset, on every focusable element; 3:1 against both neighbours `[source: WCAG 2.4.13, 2023]` | `--focus` | none |
| Pressed | Scale 0.98 for 120 ms, surface shifts a further 0.03 | `--dur-1` | `--ease-out` |
| Disabled | Opacity 0.45, no pointer cursor, no hover change; text on surface stays at or above 3:1 after the opacity is applied | - | none |
| Loading | Label replaced by an indicator only after 300 ms; width held; repeat presses ignored via `aria-busy` | `--dur-2` | `--ease-out` |
| Selected or checked | `--accent` fill with `--on-accent` plus a shape change (tick, dot, 2 px indicator bar); never colour alone `[source: WCAG 1.4.1, 2023]` | `--accent`, `--on-accent` | `--dur-2` |
| Invalid | 1 px `--danger` line, message below with an icon, `aria-invalid="true"` | `--danger` | none |
| Read-only | No line, `--surface-2` background, text stays `--text` (not greyed; read-only is not disabled) | `--surface-2` | none |

### 3.2 Feedback timing

| Situation | Default | Escape hatch |
|---|---|---|
| Response under 100 ms | Show the result; no indicator `[source: Nielsen, 1993]` | - |
| 100 to 400 ms | The control's own state change (pressed, tick) is the feedback; no spinner `[source: Doherty, 1982 via Laws of UX]` | - |
| 400 ms to 1 s | Hold the pressed or busy state; still no spinner `[source: Nielsen, 1993]` | Skeleton after 300 ms if the region is a full list or page |
| Over 1 s, content shape known | Skeleton shaped like the final layout, shown after a 300 ms delay, held at least 300 ms once shown `[source: Wroblewski, 2013; NN/g skeleton screens, 2023]` | Spinner only when the shape is unknown |
| Over 1 s, shape unknown | Indeterminate indicator after 1 s with a one-line label `[source: NN/g progress indicators, 2023]` | - |
| Over 10 s | Percent-done indicator plus a cancel `[source: Nielsen, 1993]` | Step list ("2 of 5") when percent is unknowable |
| Low-risk, reversible action (like, rename, reorder, toggle) | Optimistic update; on failure roll back within 2 s and say why `[source: Mishunov, 2016]` | Pessimistic when the action costs money or sends a message |
| Destructive and irreversible | Confirm dialog naming the object and the consequence; type-to-confirm only for the rarest cases `[source: NN/g confirmation dialogs, 2018]` | - |
| Destructive but reversible | Do it; toast with Undo for 5 to 10 s at `--z-toast` `[source: NN/g user control, 2020; Material 3 snackbar]` | Trash with restore when the object is large |

### 3.3 Choosing a control

| Situation | Default | Escape hatch |
|---|---|---|
| 2 to 5 mutually exclusive options | Segmented control with radio-group semantics `[source: APG radio group]` | Vertical radio list when a label exceeds 20 characters |
| 6 or more options | Native `<select>` | Listbox or combobox with filter above 15 options |
| On or off, immediate effect | Switch `[source: APG switch]` | - |
| On or off, saved with a form | Checkbox | - |
| A quantity in a range | Slider plus a numeric input `[source: APG slider]` | Numeric input alone when precision matters more than exploration |
| A date | Native `<input type="date">` first | Custom calendar only for range selection or blocked dates |
| Several from a short list | Checkbox group | Removable chips when space is scarce |
| An action | `<button>` | - |
| A destination | `<a href>` | - |

### 3.4 Micro-interactions

Purpose first (confirm, orient, reward, prevent); one per action; under 400 ms in product UI; every one appears in `motion-spec.md` with a token. Recipes live in `../motion/references/patterns.md`. `[house]`

| Interaction | Purpose | Default | Recipe |
|---|---|---|---|
| Press | confirm | scale 0.98, `--dur-1` `--ease-out`, release with `--ease-land` | patterns.md: press |
| Toggle | confirm | knob translate 16 px `--dur-2` `--ease-out`; track colour `--dur-1` | patterns.md: toggle |
| Add to list | orient | new row opacity 0 to 1 and translate 8 px, `--dur-2`; siblings move `--dur-3` | patterns.md: list-add |
| Remove with undo | prevent | row collapses `--dur-3` `--ease-in-out`; toast enters `--dur-2`; undo window 5 to 10 s | patterns.md: list-remove |
| Copy to clipboard | confirm | icon swaps to a tick `--dur-1`; label "Copied" for 1.5 s | patterns.md: copy |
| Save state | confirm | label "Saving" then "Saved" with tick, held 1.5 s; no indicator under 300 ms | patterns.md: save |
| Error shake | prevent | translate 4 px, 3 cycles, `--dur-3` total; reduced motion: colour only | patterns.md: shake |
| Success check | reward | tick draws via stroke-dashoffset `--dur-3` `--ease-out` | patterns.md: check |
| Expand | orient | grid-template-rows 0fr to 1fr `--dur-3` `--ease-in-out`; chevron rotates 90 degrees `--dur-2` | patterns.md: expand |
| Drag | orient | lift scale 1.02 with shadow on pick-up `--dur-1`; drop settles `--dur-3` `--ease-land` | patterns.md: drag |

### 3.5 The one new mechanism (rethink jobs)

A rethink adds one interaction or state that did not exist before and serves the primary task or the return ritual from `brief.md`. This desk specifies it fully (trigger, states, timing, keyboard and touch path, reduced motion, what persists and where) before the build, and nothing else new is added; the rest of the screen stays on the state matrix defaults. Pick from the table by what the ritual says; write the choice and its reason into the hand-off. `[house]`

| Ritual says | Mechanism | Specification defaults |
|---|---|---|
| "I come back several times a day to see what is new" | Since-last-visit marker: a rule or band at the first item already seen; items above it are new | Store last-visit timestamp and top seen id in `localStorage`; marker fades in `--dur-2` after content; label "Since your last visit, 3h ago"; reachable as a link target `#new`; reduced motion: no fade |
| "I check whether a thread or item is alive" | Velocity signal: the number that moves gets weight; a small delta ("+41 in 1h") next to it | Delta computed from a cached previous snapshot; tabular numerals; tertiary tone; no colour meaning; hidden when there is no snapshot |
| "I lose my place in the list" | Read-state dimming: visited rows drop to `--text-2`; a Return-to-where-I-was affordance | `:visited` where the URL allows; otherwise seen ids in storage; dim over `--dur-3` on return, never live |
| "I skim, then decide what to open" | Peek: expand a row inline to show the first paragraph or top comment without leaving | Expand recipe (3.4); Enter or click on the row's meta, not the title link; Escape collapses; one open at a time |
| "I want to get through it faster" | Keyboard rail: j/k to move, o to open, c for comments, with a visible focus row | Focus row `--surface-2` and a 2 px `--focus` left rule; help on `?`; never intercepts typing in inputs |
| "I compare items before choosing" | Pin or shortlist: a per-item toggle collecting into a tray | Toggle recipe (3.4); tray at `--z-toast` bottom, count in the label; persists in storage; Undo on remove |
| "I want to pick up where I left off" | Resume: the last state restored on load, with a one-line note that it was | Restore before first paint when possible; note "Resumed from 12 Sep" for 4 s; a Reset link beside it |

Rules for the mechanism: it works with keyboard alone and with touch alone; it degrades to nothing harmful without storage or JS; it is off the critical path for first render; the words desk writes its labels; QA lists it under K (reskin test) and checks it is reachable in the capture matrix. `[house]`

## 4. Rules

Forms
1. Label above the field, 8 px gap (`--space-2`), left aligned; helper text below the field at `--fs-1` in `--text-2`. `[source: NN/g placeholders, 2014; house]`
2. Never a placeholder as the label; a placeholder is an example and disappears on input. `[source: NN/g placeholders, 2014]`
3. Validate format on blur and completeness on submit; never on the first keystroke. Once a field is in error, re-validate on every keystroke and clear the error the moment it passes. `[source: Baymard, 2025; Smashing, 2022]`
4. Error copy says what happened and how to fix it, sits below the field in `--danger` with an icon, never colour alone; set `aria-invalid` and `aria-describedby`; keep the user's input. `[source: NN/g error messages, 2024; WCAG 1.4.1]`
5. Input height 44 px under `(pointer: coarse)`, 36 to 40 px on desktop; one column; 16 px (`--space-4`) between fields, 24 px (`--space-5`) between groups. `[source: Apple HIG; house]`
6. Autofocus only the first field, and only on a page whose sole task is the form. `[house]`
7. Every text input carries `inputmode` and `autocomplete` (email, tel, numeric, decimal, url; name, email, postal-code, cc-number, one-time-code). `[source: MDN inputmode, autocomplete]`
8. On a failed submit, move focus to the first invalid field and announce the error count in a live region. `[source: WCAG 4.1.3; house]`

Gestures and touch
9. Targets are 44 by 44 px minimum; WCAG 2.2 accepts 24 by 24 px as the floor, the studio does not. `[source: Apple HIG; WCAG 2.5.8, 2023; house]`
10. 8 px minimum gap between adjacent targets. `[source: Material 3 accessibility]`
11. Every swipe (path gesture) and every drag has a visible single-tap alternative. `[source: WCAG 2.5.1; WCAG 2.5.7, 2023]`
12. Long press is never the only path to a function. `[source: WCAG 2.5.7, 2023; house]`
13. On mobile the primary action sits in the bottom 40 percent of the screen: 49 percent of users hold one-handed and thumbs drive 75 percent of interactions. `[source: Hoober, 2013; house for the 40 percent]`
14. Hover-revealed content is off under `(hover: none)`; the base state already carries the affordance. `[source: Media Queries Level 4; house]`
15. No tooltips on touch; use a visible label or a tap-to-open popover. `[source: NN/g tooltips, 2019]`

Keyboard and focus
16. Every focusable element shows a 2 px ring in `--focus` with 2 px offset at 3:1 against its neighbours; `outline: none` without a replacement fails review. `[source: WCAG 2.4.7; WCAG 2.4.13, 2023]`
17. Tab order follows reading order; no positive `tabindex`. `[source: WCAG 2.4.3; APG keyboard interface]`
18. Escape closes the topmost dialog, menu or popover; Enter submits a form from any text input; Space activates buttons. `[source: APG dialog; HTML implicit submission]`
19. Inside composite widgets (tabs, radio group, listbox, menu, toolbar, slider) arrow keys move and Tab leaves; one tab stop per widget via roving `tabindex` or `aria-activedescendant`. `[source: APG keyboard interface]`
20. When a dialog or menu closes, focus returns to the element that opened it. `[source: APG dialog]`
21. A skip link is the first focusable element on every page with a header. `[source: WCAG 2.4.1; WebAIM]`

Affordance and signifiers
22. Screens have no affordances, only signifiers; every interactive element carries at least one in its default state (fill, 1 px line, underline, handle, cursor change). `[source: Norman, 2008 and 2013]`
23. Primary buttons are filled with `--accent`; secondary carry a 1 px `--line`; text-only buttons are tertiary and only inside a group that already reads as controls. `[house]`
24. Links in running text are underlined; navigation links may drop the underline only when their container reads as navigation. `[house]`
25. Disabled looks disabled (opacity 0.45) and says why within 8 px; read-only looks like text on `--surface-2`. `[house]`
26. Draggable items show a six-dot handle; scrollable regions show a partial item (last visible row cut at 50 percent) or an edge fade of 24 px. `[house]`
27. Selection uses a shape change plus colour, never colour alone. `[source: WCAG 1.4.1]`

Empty, loading and error states
28. Every list, panel and page designs three states beyond content: empty, loading, error. Copy says what is here, why it is empty, what to do; exactly one action. `[source: NN/g heuristics 1 and 9; house]`
29. Loading uses a skeleton shaped like the final layout (same heights, same radii); the region's layout shift on arrival is 0. `[source: Wroblewski, 2013; NN/g skeleton screens, 2023]`
30. Error states keep the user's input and offer a retry; an error toast never covers the thing it describes. `[source: NN/g error messages, 2024; house]`

## 5. Defaults

```css
/* Interaction states. Components read tokens only. --danger and --hover-shift are added here with reasons. */
:root {
  --danger: oklch(0.55 0.19 25);     /* interaction desk: invalid line and error text; on --bg <ratio>, must reach 4.5:1 */
  --hover-shift: -0.03;              /* light theme: hover darkens the surface by 0.03 L */
  --control-h: 40px;                 /* desktop control height; 44 px under coarse pointers below */
}
[data-theme="dark"] {
  --danger: oklch(0.72 0.16 25);     /* on --bg <ratio> */
  --hover-shift: 0.03;               /* dark theme: hover lightens */
}
@media (pointer: coarse) { :root { --control-h: 44px; } }

.control {
  min-height: var(--control-h);
  border-radius: var(--r-2);
  background: var(--surface);
  transition: background-color var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
}
@media (hover: hover) {
  .control:hover:not(:disabled) { background: oklch(from var(--surface) calc(l + var(--hover-shift)) c h); }
}
.control:active:not(:disabled) { transform: scale(0.98); }
.control:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.control:disabled, .control[aria-disabled="true"] { opacity: 0.45; cursor: default; }
.control[aria-busy="true"] { pointer-events: none; }
.field:has([aria-invalid="true"]) { --line: var(--danger); }
.field-error { color: var(--danger); font-size: var(--fs-1); margin-top: var(--space-2); }
input[readonly] { background: var(--surface-2); border-color: transparent; }
```

```html
<!-- Form field: label above (8 px), helper and error below, never a placeholder as label. -->
<div class="field">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" inputmode="email" autocomplete="email"
         aria-describedby="email-hint email-error" aria-invalid="true">
  <p id="email-hint" class="field-hint">We send the receipt here.</p>
  <p id="email-error" class="field-error"><svg aria-hidden="true" width="16" height="16"><use href="#icon-alert"></use></svg> Enter an address with an @, like name@example.com.</p>
</div>
```

```js
// Show a skeleton only if the response has not arrived within 300 ms; once shown, hold it at least 300 ms.
async function withSkeleton(region, promise) {
  let shownAt = 0;
  const timer = setTimeout(() => { region.setAttribute('aria-busy', 'true'); shownAt = performance.now(); }, 300);
  try { return await promise; }
  finally {
    clearTimeout(timer);
    const hold = shownAt ? Math.max(0, 300 - (performance.now() - shownAt)) : 0;
    setTimeout(() => region.removeAttribute('aria-busy'), hold);
  }
}
```

## 6. Anti-patterns

| Slop | Fix |
|---|---|
| Hover-only affordances (the action appears on hover) | Show the action at 60 percent opacity by default and 100 percent on hover or focus-within; always visible under `(hover: none)` |
| Colour-only states | Add a shape, icon or text change; verify the pair with `../../scripts/contrast.py` |
| Disabled buttons with no explanation | Keep the button enabled and validate on submit, or state the reason within 8 px of the button |
| Spinners for under 300 ms | Delay every indicator by 300 ms; use a skeleton when the shape is known |
| Confirm dialogs for reversible actions | Perform the action; toast with Undo for 5 to 10 s |
| Toasts that hide the thing they describe | Toast at `--z-toast` anchored bottom-centre, 24 px clear of the affected region; inline status beside the object |
| Focus rings removed | `:focus-visible` ring 2 px `--focus`; it already hides on pointer clicks, so there is nothing left to remove |
| Placeholders as labels | Label above; placeholder is an example or empty |
| Validation on first keystroke | Blur for format, submit for completeness, live only after the first error |
| Tap targets under 44 px | Pad to 44 px with `padding` or a `::before` hit area; measure with `../../scripts/measure.mjs` |
| Gestures without visible alternatives | A button for every swipe or drag action, visible without the gesture |
| Tooltips on touch | Visible label, or a tap-to-open popover that also opens on focus |

## 7. Hand-off artefact

Two tables, written as files beside the screens. QA reads the state sheet into its capture matrix (states column) and the copy sheet into its copy pass.

```markdown
# State sheet: <screen or component>
Owner: interaction. Consumed by: build, motion, qa. Every row becomes a captured state.

| Control | State | Visual change | Token | Motion token | A11y note |
|---|---|---|---|---|---|
| .btn-primary | hover | surface L shifts 0.03 | --accent, --hover-shift | --dur-1 --ease-out | (hover: hover) only |
| .btn-primary | focus-visible | 2 px ring, 2 px offset | --focus | none | 3:1 against --bg and --accent |
| .btn-primary | pressed | scale 0.98 | - | --dur-1 --ease-out | - |
| .btn-primary | disabled | opacity 0.45 | - | none | reason text within 8 px |
| .btn-primary | loading | label to indicator after 300 ms | --dur-2 | --ease-out | aria-busy="true" |
```

```markdown
# Copy sheet: <screen>
Owner: interaction. Consumed by: build, qa (copy pass). One action per state.

| Screen | State | Heading (what is here) | Body (why) | Action | Live region |
|---|---|---|---|---|---|
| Projects | empty, first run | No projects yet | A project holds your files and their history. | Create a project | none |
| Projects | empty, filtered | No projects match "<query>" | Try a shorter word or clear the filter. | Clear filter | role="status" |
| Projects | loading | (skeleton, 3 rows) | - | - | aria-busy on the list |
| Projects | error | Could not load projects | The connection dropped. Your work is saved. | Retry | role="status" |
```

## 8. Checklist

- [ ] Every control on the screen has a row per `y` cell in the state matrix, on the state sheet.
- [ ] Hover changes are wrapped in `(hover: hover)` and have a focus-visible twin.
- [ ] Focus ring is 2 px `--focus`, 2 px offset, on every focusable element; none removed.
- [ ] No indicator appears under 300 ms; skeletons match the final layout; percent-done over 10 s.
- [ ] Optimistic actions roll back within 2 s with a message; confirms exist only for irreversible actions; Undo toasts last 5 to 10 s.
- [ ] Labels above fields; no placeholder labels; validation on blur then submit; error copy says what and how, with an icon.
- [ ] Inputs 44 px on touch, 36 to 40 px on desktop; `inputmode` and `autocomplete` set.
- [ ] Smallest target 44 by 44 px, 8 px gaps (`../../scripts/measure.mjs`); primary action in the bottom 40 percent on mobile.
- [ ] Every gesture has a visible tap alternative; nothing needs a long press.
- [ ] Escape closes, Enter submits, arrows move inside composites, focus returns to the trigger.
- [ ] Empty, loading and error states exist for every list and panel with one action each (copy sheet).
- [ ] Every micro-interaction is in `motion-spec.md` with a token and a reduced-motion behaviour.

## 9. Sources

- Nielsen, J. (1993). Response Times: The 3 Important Limits. https://www.nngroup.com/articles/response-times-3-important-limits/
- Laws of UX. Doherty Threshold (Doherty and Thadani, 1982). https://lawsofux.com/doherty-threshold/
- Norman, D. (2008). Signifiers, not affordances. https://jnd.org/signifiers-not-affordances/
- Norman, D. (2013). Preface, The Design of Everyday Things, revised edition. https://jnd.org/preface-design-of-everyday-things-revised-edition/
- W3C. ARIA Authoring Practices Guide: Developing a keyboard interface. https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- W3C APG patterns: tabs https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ ; dialog (modal) https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ ; listbox https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ ; menu button https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ ; menubar https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ ; switch https://www.w3.org/WAI/ARIA/apg/patterns/switch/ ; disclosure https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ ; radio group https://www.w3.org/WAI/ARIA/apg/patterns/radio/ ; slider https://www.w3.org/WAI/ARIA/apg/patterns/slider/
- W3C (2023). WCAG 2.2 Understanding 2.5.8 Target Size (Minimum). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- W3C (2023). WCAG 2.2 Understanding 2.5.1 Pointer Gestures https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html ; 2.5.7 Dragging Movements https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- W3C (2023). WCAG 2.2 Understanding 2.4.7 Focus Visible https://www.w3.org/WAI/WCAG22/Understanding/focus-visible ; 2.4.13 Focus Appearance https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance ; 2.4.3 Focus Order https://www.w3.org/WAI/WCAG22/Understanding/focus-order ; 2.4.1 Bypass Blocks https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks
- W3C (2023). WCAG 2.2 Understanding 1.4.1 Use of Color https://www.w3.org/WAI/WCAG22/Understanding/use-of-color ; 4.1.3 Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages
- Apple. Human Interface Guidelines: Accessibility (44 by 44 pt). https://developer.apple.com/design/human-interface-guidelines/accessibility
- Google. Material Design 3: Accessibility, touch targets 48 dp and 8 dp spacing. https://m3.material.io/foundations/designing/structure
- Baymard Institute. Inline form validation. https://baymard.com/blog/inline-form-validation
- Smashing Magazine (2022). A Complete Guide To Live Validation UX. https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/
- NN/g (2014). Placeholders in Form Fields Are Harmful. https://www.nngroup.com/articles/form-design-placeholders/
- NN/g. Error Message Guidelines. https://www.nngroup.com/articles/error-message-guidelines/
- NN/g (2018). Confirmation Dialogs Can Prevent User Errors. https://www.nngroup.com/articles/confirmation-dialog/
- NN/g (2020). User Control and Freedom (Usability Heuristic 3). https://www.nngroup.com/articles/user-control-and-freedom/
- NN/g. Progress Indicators Make a Slow System Less Insufferable. https://www.nngroup.com/articles/progress-indicators/
- NN/g. Skeleton Screens 101. https://www.nngroup.com/articles/skeleton-screens/
- NN/g (2019). Tooltip Guidelines. https://www.nngroup.com/articles/tooltip-guidelines/
- Wroblewski, L. (2013). Mobile Design Details: Avoid The Spinner. https://www.lukew.com/ff/entry.asp?1797=
- Mishunov, D. (2016). True Lies Of Optimistic User Interfaces. https://www.smashingmagazine.com/2016/11/true-lies-of-optimistic-user-interfaces/
- Google. Material 3 snackbar guidelines (auto-dismiss 4 to 10 s). https://m3.material.io/components/snackbar/guidelines
- Hoober, S. (2013). How Do Users Really Hold Mobile Devices? https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php/
- W3C. Media Queries Level 4: hover and pointer features. https://www.w3.org/TR/mediaqueries/
- MDN. hover https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/hover ; pointer https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/pointer ; :focus-visible https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:focus-visible
- MDN. inputmode https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode ; autocomplete https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
- WebAIM. Skip navigation links. https://webaim.org/techniques/skipnav/
