/*
 * Regenerates `src/components/NootRig.tsx` from the flat-vector artwork.
 *
 *   node scripts/build-mascot-rig.mjs
 *
 * The emitted component is committed, so this is not part of the build — run
 * it only when the source artwork changes. The shape indices below (background
 * fills to drop, which ovals are cheeks, which shapes are limbs) are tied to
 * THIS source file; re-derive them if the artwork is re-exported.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync(process.argv[2] || 'public/mascot/noot-vector-source.svg', 'utf8')
const inner = src.slice(src.indexOf('<g clip-path="url(#artboard-clip)">') + 35, src.lastIndexOf('</g></svg>'))

const tokens = [...inner.matchAll(/<g\b([^>]*)>|<\/g>|<(path|ellipse|rect|circle)\b([^>]*?)\/?>/g)]
const stack = []
const items = []
for (const t of tokens) {
  if (t[0].startsWith('</g')) {
    stack.pop()
    continue
  }
  if (t[0].startsWith('<g')) {
    const m = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(t[1] || '')
    const p = stack.at(-1) || { x: 0, y: 0 }
    stack.push(m ? { x: p.x + +m[1], y: p.y + +m[2] } : { ...p })
    continue
  }
  const attrs = t[3] || ''
  items.push({
    i: items.length,
    tag: t[2],
    fill: /fill="([^"]+)"/.exec(attrs)?.[1] || '',
    geom: attrs.replace(/\s*fill="[^"]*"/, '').trim(),
    off: stack.at(-1) || { x: 0, y: 0 },
  })
}

/** Shapes 3 and 4 are white background fills in the gaps under the headband. */
const DROP = new Set([3, 4])
/** The tracer sampled the blush ovals as warm grey; they are cheeks. */
const CHEEKS = new Set([32, 33])

const CLASS_BY_FILL = {
  '#86c217': 'noot-body',
  '#c1e384': 'noot-belly',
  '#629f08': 'noot-shade',
  '#41483f': 'noot-slate',
  '#6c7174': 'noot-grey',
  '#bab3ae': 'noot-silver',
  '#fdfefd': 'noot-white',
  '#0f0802': 'noot-pupil',
  'url(#fill-gradient-layer_mtke5kpd_1cp7)': 'noot-sheen',
}

/** Rebuilt face stacking: brows, mouth, then one group per eye so it can blink. */
const EYE_L = [28, 39, 40, 42]
const EYE_R = [29, 37, 41, 43, 44]
const FACE = new Set([35, 36, 38, ...EYE_L, ...EYE_R])

/** The lit highlight of each limb. */
const LIMBS = { armL: 7, armR: 5, footL: 13, footR: 30 }
const LIMB_SET = new Set(Object.values(LIMBS))

/** The contour-shading path — far more than shading, see below. */
const SHADE = 2

/**
 * Limb regions punched out of the shading.
 *
 * Every limb is drawn twice in the source: the shading path lays down the dark
 * base — which for the arms and feet IS most of the limb — and shapes 5/7/13/30
 * add the lit highlight on top. Rotating only the highlight slides it off its
 * own base and the limb reads as cut off.
 *
 * So each limb's slice of the shading is clipped out and handed to that limb's
 * group, while the torso keeps the remainder through an even-odd punch. At rest
 * the pieces reassemble exactly; in motion the whole limb travels together.
 *
 * Inner edges sit where the limb meets the body, so the straight cut slides
 * into same-coloured body and stays invisible. (An earlier attempt clipped the
 * shading to one torso column instead, which cut away the body's outer flanks
 * and detached every limb — hence the narrow per-limb rects.)
 */
const LIMB_CLIP = {
  armL: { x: 196, y: 686, w: 114, h: 254 },
  armR: { x: 860, y: 690, w: 118, h: 242 },
  footL: { x: 352, y: 1038, w: 136, h: 130 },
  footR: { x: 694, y: 1038, w: 126, h: 130 },
}
/*
 * The limb slice is grown by BLEED while the torso punch uses the exact rect,
 * so the two overlap by a hair instead of meeting edge to edge. Complementary
 * antialiased edges do not sum back to opaque, and the seam showed as a faint
 * rectangle across the feet. The overlap is the same colour, so it is free.
 */
const BLEED = 2
const grow = (r) => ({ x: r.x - BLEED, y: r.y - BLEED, w: r.w + BLEED * 2, h: r.h + BLEED * 2 })
const punch = (r) => `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`
const TORSO_CLIP_D = `M0 0h1200v1200H0Z${Object.values(LIMB_CLIP).map(punch).join('')}`

/**
 * Joint pivots, in the artwork's own coordinates.
 *
 * Each limb is wrapped so its group's local origin IS the joint. That matters:
 * `transform-box: fill-box` on a group reports the union of its children's
 * boxes, and a limb group contains a clipped copy of the whole shading path —
 * so the pivot resolved into the torso and limbs visibly flew off. With the
 * origin baked into the markup, a plain `rotate()` in CSS pivots correctly.
 */
const PIVOT = {
  armL: [306.5, 707.5],
  armR: [876.0, 711.0],
  footL: [485, 1042],
  footR: [697, 1042],
}

// Character bbox in source units, fitted to y 12..228 of a 240 box.
const BBOX = { x0: 188, x1: 976, y0: 20, y1: 1159 }
const S = 216 / (BBOX.y1 - BBOX.y0)
const TX = (240 - (BBOX.x1 - BBOX.x0) * S) / 2 - BBOX.x0 * S
const TY = 12 - BBOX.y0 * S

const round = (n) => +n.toFixed(2)

/*
 * A clip-path resolves in the coordinate system the element's own transform
 * establishes. Putting one on the same <g> that carries translate(...) shifted
 * every clip rect by that translate and lopped off half the artwork — the arms
 * thinned to slivers and a foot vanished. Clips therefore always go on a
 * transform-free wrapper, which keeps them in artwork coordinates.
 */
function clipped(clipId, indent, shape) {
  return `${indent}<g clipPath="url(#${clipId})">${shape}</g>`
}

function emit(item, extraClass = '', indent = '        ') {
  const cls = CHEEKS.has(item.i) ? 'noot-cheek' : CLASS_BY_FILL[item.fill] || 'noot-body'
  const className = extraClass ? `${cls} ${extraClass}` : cls
  const geom = item.geom.replace(/\s+/g, ' ')
  const shape = `<g transform="translate(${round(item.off.x)} ${round(item.off.y)})"><${item.tag} className="${className}" ${geom} /></g>`
  return item.i === SHADE ? clipped('noot-torso-clip', indent, shape) : indent + shape
}

const body = items
  .filter((it) => !DROP.has(it.i) && !FACE.has(it.i) && !LIMB_SET.has(it.i))
  .map((it) => emit(it))
const limb = (key) => emit(items[LIMBS[key]], '', '            ')

/** The shading, re-cut to one limb so that limb can move as a whole. */
function limbShade(key) {
  const it = items[SHADE]
  const geom = it.geom.replace(/\s+/g, ' ')
  const shape = `<g transform="translate(${round(it.off.x)} ${round(it.off.y)})"><path className="noot-shade" ${geom} /></g>`
  return clipped(`noot-clip-${key}`, '            ', shape)
}

/** Wraps a limb so its group rotates about the joint, not a stray box centre. */
function joint(key, cls) {
  const [px, py] = PIVOT[key]
  return [
    `          <g transform="translate(${px} ${py})">`,
    `            <g className="${cls}">`,
    `              <g transform="translate(${-px} ${-py})">`,
    limbShade(key),
    limb(key),
    `              </g>`,
    `            </g>`,
    `          </g>`,
  ].join('\n')
}

const brows = [emit(items[38], 'noot-brow noot-brow-l'), emit(items[36], 'noot-brow noot-brow-r')]
const mouth = emit(items[35], 'noot-mouth noot-mouth-smile')
const eyeL = EYE_L.map((i) => emit(items[i]))
const eyeR = EYE_R.map((i) => emit(items[i]))

const gradient = /<linearGradient[\s\S]*?<\/linearGradient>/
  .exec(src)[0]
  .replace(/stop-color/g, 'stopColor')
  .replace(/stop-opacity/g, 'stopOpacity')

const clipDefs = Object.entries(LIMB_CLIP)
  .map(([k, r]) => {
    const g = grow(r)
    return (
      `        <clipPath id="noot-clip-${k}">\n` +
      `          <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" />\n` +
      `        </clipPath>`
    )
  })
  .join('\n')

const out = `/**
 * Noot — the mascot rig.
 *
 * GENERATED by \`scripts/build-mascot-rig.mjs\` from the flat-vector artwork,
 * then hand-annotated. The geometry is the artwork's own paths, not a
 * re-drawing, so the silhouette, the crown and the headphones are on-model.
 *
 * What the generator changes, and why:
 *
 * 1. **Drops the white background.** The source painted a 1200x1200 white
 *    canvas rect plus two white shapes filling the gaps under the headband.
 *    Those showed as white patches around the shadow and the headphones.
 *    Nothing is white here now except the eyes and the metal highlights, so
 *    the rig is transparent on any background.
 * 2. **Fills become CSS custom properties**, so a difficulty switch is a
 *    colour transition rather than a separate asset. There is no outline
 *    colour — the art is flat.
 * 3. **Normalises into one 240x240 box**, character on y 12..228. Every pose
 *    shares this frame, so Noot cannot change size between states.
 * 4. **Regroups the face** so each eye can blink and the brows and mouth are
 *    addressable for expression swaps.
 * 5. **Splits out the four limbs** so Noot can walk and wave. Each limb group
 *    carries both its lit highlight AND its slice of the shading path (which
 *    is most of the limb's mass), with the joint baked in as the group origin.
 *
 * All motion lives in \`noot.css\`.
 */
export function NootRig() {
  return (
    <svg
      className="noot"
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        ${gradient}
        <clipPath id="noot-torso-clip">
          <path d="${TORSO_CLIP_D}" clipRule="evenodd" />
        </clipPath>
${clipDefs}
      </defs>
      <g className="noot-root">
        {/*
          Everything in this group is in the artwork's own 1200-unit space, so
          a limb translation here is ~5.3x the equivalent in the 240 viewBox.
          Rotations are scale-free either way.
        */}
        <g transform="translate(${round(TX)} ${round(TY)}) scale(${round(S)})">
${body.map((l) => '  ' + l).join('\n')}

          {/* --- face --- */}
${brows.map((l) => '  ' + l).join('\n')}
${'  ' + mouth}
          <g className="noot-eye noot-eye-l">
${eyeL.map((l) => '  ' + l).join('\n')}
          </g>
          <g className="noot-eye noot-eye-r">
${eyeR.map((l) => '  ' + l).join('\n')}
          </g>

          {/* --- limbs: highlight + shading slice, pivoting at the joint --- */}
${joint('armL', 'noot-arm noot-arm-l')}
${joint('armR', 'noot-arm noot-arm-r')}
${joint('footL', 'noot-foot noot-foot-l')}
${joint('footR', 'noot-foot noot-foot-r')}
        </g>

        {/* Alternate expressions, on the traced feature centres. */}
        <g className="noot-eye-happy">
          <path d="M85 118C90 107 106 107 111 118" />
          <path d="M132 119C137 108 153 108 158 119" />
        </g>
        <path className="noot-mouth noot-mouth-flat" d="M115 130H129" />
        <path className="noot-mouth noot-mouth-sad" d="M115 133C118 126 126 126 129 133" />
        <path className="noot-mouth-open" d="M113 127C113 142 131 142 131 127Z" />

        {/* --- beat notes, only visible while listening --- */}
        <g className="noot-notes">
          <path className="noot-note noot-note-1" d="M14 134a5 5 0 105 5V122l11-3v12a5 5 0 105 5V114l-21 6Z" />
          <path className="noot-note noot-note-2" d="M206 116a4 4 0 104 4V108l9-2v9a4 4 0 104 4V101l-17 5Z" />
        </g>

        {/* --- sparkles, only visible on streak / win / switch --- */}
        <g className="noot-sparks">
          <path className="noot-spark noot-spark-1" d="M32 80l3.5 8.5L44 92l-8.5 3.5L32 104l-3.5-8.5L20 92l8.5-3.5Z" />
          <path className="noot-spark noot-spark-2" d="M204 66l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
          <path className="noot-spark noot-spark-3" d="M200 190l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" />
        </g>
      </g>
    </svg>
  )
}
`

writeFileSync('src/components/NootRig.tsx', out)
console.log('wrote src/components/NootRig.tsx', `${Math.round(out.length / 1024)}kb`)
console.log('scale', round(S), 'translate', round(TX), round(TY))
