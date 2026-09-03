# AI-slop catalogue

Patterns that make a design read as generated from a template. Zero hits in the core loop is the bar; each hit is a one-point deduction in the audit category it lands in. Numbers are stable so findings can cite them.

The list is grouped: labels and badges (1 to 10), colour and material (11 to 22), layout (23 to 32), typography (33 to 38), motion (39 to 45), copy (46 to 49), character and illustration (50 to 54), components (55 to 60).

| # | Pattern | Why it reads as slop | Studio alternative |
|---|---|---|---|
| 1 | Letter-spaced uppercase eyebrow labels on every section | One editorial device cargo-culted everywhere; caps cost legibility and flatten hierarchy | One eyebrow per page at most, or none; size and weight for section headers |
| 2 | Coloured left border or side stripe on list items and cards | Decorative common-region cue carrying no data; a second accent | Whitespace and alignment for grouping; colour only where it encodes state |
| 3 | "Active" dots and status dots as decoration | Dots imply live state; fake liveness erodes trust | Real status with a label; remove dots that mean nothing |
| 4 | Icon in a tinted rounded square before every heading | Icons that do not aid recognition are ornaments; the tinted square is a second accent | Drop the icon or use one unboxed meaningful glyph |
| 5 | Emoji as UI icons | Inconsistent rendering; tonal mismatch | One drawn icon set at one stroke weight, or none |
| 6 | Sparkle icons for AI features | Genericised signal, indistinguishable across products | Name the capability plainly; brand it with type or a custom glyph |
| 7 | Badge soup (New, Beta, Pro, AI, Popular on one screen) | Von Restorff broken; every badge dilutes the others | One badge type per screen, only when it changes a decision |
| 8 | Rotated stamp or sticker badges | Faux-print motif that ages instantly | Straight, aligned labels in the type system |
| 9 | "Trusted by 10,000+" with three overlapping avatar circles | Stock social proof; reads as fabricated | A real number with a real noun, or nothing |
| 10 | Pill tags in five pastel colours on every card | Colour as decoration; no meaning per hue | One neutral tag style; colour only for one semantic dimension |
| 11 | Purple-to-blue gradient | The default of every 2023 to 2025 AI landing page | One brand hue; if a gradient is needed, one hue family with subtle lightness travel |
| 12 | Glow, neon or blurred coloured halos behind elements | Depth without a light model; screensaver | Tonal surfaces plus one soft tinted shadow |
| 13 | Glassmorphism on cards and content | Blur on content hurts contrast and performance; glass is for a control layer over scroll | Solid surfaces; blur only on bars and sheets with a reduce-transparency fallback |
| 14 | Aurora or mesh-gradient background | Fills empty composition with noise; fights contrast | Structured whitespace, one image, or a flat tone |
| 15 | Gradient text fill | Kills legibility at the light stop | Solid text; colour in one word by weight or a single accent |
| 16 | Big blurred background blobs (two circles, blur 200 px) | The 2021 template artefact | Remove; compose with type and whitespace |
| 17 | Decorative noise or grain overlay | Mimics print without reason; muddies contrast | Remove; texture belongs in imagery, not on UI |
| 18 | Drop shadows on everything | If everything floats, nothing does | At most three elevation levels; hairlines first |
| 19 | Hairline gradient borders (rainbow border-image) | Trend artefact; contrast fails at the light stop | 1 px solid border at 3:1 |
| 20 | Pale coloured text on a pale coloured chip | Fails 4.5:1; reads as disabled | Container tone plus on-container tone tested to AA |
| 21 | Muted secondary text below AA (grey on grey) | Hierarchy by illegibility | Hierarchy by size and weight; secondary text at a lightness that passes |
| 22 | Dark mode as an inversion | Contrast and chroma wrong; pure black surfaces | A second tuned system: lower chroma, lighter accent, tonal surfaces |
| 23 | Three equal cards in a row (feature triptych) | Equal weight equals no hierarchy; copy forced to fit boxes | Asymmetric layout with one dominant item, or a real list |
| 24 | Bento grid of equal boxes | No focal point; the 2024 template | Size boxes by importance with strict spans; one hero cell |
| 25 | Dashboard of equal-sized boxes | The eye has nowhere to land | One hero metric; typographic hierarchy inside |
| 26 | Centred everything (headings, body, lists) | Ragged both sides hurts reading | Left-align by default; centre only short display lines |
| 27 | Uniform 24 px spacing everywhere | Proximity grouping collapses; no rhythm | Spacing scale: small inside, large between |
| 28 | Inconsistent radii and spacing (13 px here, 18 px there) | Reads as unfinished | Token scales; audit with the measure script |
| 29 | Mixed shape language (pill buttons on square cards, square inputs beside pill tags) | Assembled from parts | One shape language: a role-mapped scale or an all-capsule system |
| 30 | Cards inside cards | Nested common regions; padding stacks | Flatten; one container per group |
| 31 | Left icon, heading, body, "Learn more" repeated n times | Template rhythm; the arrow link is filler | Vary structure; one real CTA per section |
| 32 | Full-bleed dark section with neon accent line separators | Cinematic mood with no content reason | Section rhythm by spacing; one dark section only if content demands |
| 33 | Default Inter or Roboto with default metrics and no decisions | Absence of intent | Choose a family for a reason; set tracking, optical size, measure, numerals |
| 34 | Space Grotesk, Poppins, Montserrat or Playfair Display as the brand face | Overused to the point of reading as template output | Catalogue in the typography desk; pick for the direction |
| 35 | Huge hero text with tiny body (72 px over 14 px) | Ratio over 5:1 orphans the body | Tighter ratio, body at least 16 px, a mid-level lead |
| 36 | Letter-spaced lowercase body text | Never correct | Track caps only, 5 to 12 percent |
| 37 | Display face used at 14 px, or text face at 64 px | Wrong optical size | Text cuts under 20 px, display cuts above |
| 38 | Fake small caps and faux bold | Synthesised, uneven | Real small caps or none; a real weight file |
| 39 | Everything animates on scroll or hover (parallax, lift, tilt) | Constant motion is fatigue | A motion budget; hovers change colour only |
| 40 | Pulsing rings and radar ripples | Borrowed liveness with no meaning; motion-sickness risk | Static state with a label; determinate progress if progress |
| 41 | Number counters animating from zero on scroll | Delays information; fake drama | Show the number; animate only a live value |
| 42 | Infinite "trusted by" logo carousel | Motion for no reason | A static row of at most six logos, one tone |
| 43 | Bounce on every button | Playfulness as a default | Springs only where the direction calls for them |
| 44 | Blur on every transition | A library default, not a decision | Blur only in the soft-blur dialect for swaps |
| 45 | A loop that never rests (a flame, a spinner, a wave) in persistent UI | Steals attention from the primary task | Rest on a still frame; animate on events |
| 46 | Generic taglines ("Unlock your potential", "Supercharge your workflow") | Says nothing; interchangeable | A concrete claim with a noun and a number |
| 47 | Title Case Everywhere | Reads as a template | Sentence case |
| 48 | "Oops!" and exclamation marks in error copy | Tone over information | What happened, why, what to do |
| 49 | Chat-bubble mock-ups with fake conversations to show "AI" | Unreadable at thumbnail; generic | The real interface in one high-fidelity state |
| 50 | Stroke-drawn "happy arc" eyes on a mascot | A sticker face; cannot express anything else | Eyelids and brows over eye volumes; posture-first emotion |
| 51 | Mascot limbs cropped by a rectangular container edge | Reads as a clipping bug | Compose the character to the container or use an organic mask |
| 52 | Fake 3D (isometric blobs, glossy spheres, extruded icons) | Stock-looking, heavy | Flat authored illustration or real product imagery |
| 53 | Hand-typed bezier icons with no grid | Lumpy, asymmetric, off-centre | Construct on a 24 px grid from primitives; optical centring |
| 54 | Icons from three libraries | Mixed stroke weights and corner styles | One set; when drawing, match its grid |
| 55 | Toast pile-ups with icons, colours and progress bars | Over-communicates; every toast is a peak | One calm toast style; progress only for cancellable actions |
| 56 | Testimonial cards with five gold stars and avatar circles in a grid | Stock trust pattern | One strong quote in display type with real attribution |
| 57 | Disabled controls with no explanation | The user cannot proceed and does not know why | Enable with validation, or explain beside the control |
| 58 | Hover-only affordances | Invisible on touch | Visible affordance at rest |
| 59 | Placeholder text as the only label | Disappears on input | A label above the field |
| 60 | Focus ring removed | Keyboard users lose their place | A 2 px ring at 3:1, offset 2 px |

## Reading the catalogue

- A hit is recorded as "#n at <location>" in the QA report and the audit.
- Some entries are direction-dependent: 11 and 15 are never acceptable; 13 is acceptable only in the Vitrine control layer; 26 is acceptable for short display lines; 42 is never acceptable; 45 is acceptable only for a single character in Character-led.
- Sixty-second triage in `../PLAYBOOK.md` section 4.1 lists the ten most frequent hits by number.
