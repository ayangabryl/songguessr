/**
 * Author original SongGuessr mascot "Noot" as self-hosted Lottie JSON.
 * Not affiliated with Duolingo. Round music sprite with headphones and a note tuft.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'mascot')
const FR = 60
const OP = 560

const BODY = [0.345, 0.8, 0.008, 1]
const BELLY = [0.537, 0.886, 0.098, 1]
const OUTLINE = [0.239, 0.549, 0.008, 1]
const CHEEK = [1, 0.553, 0.667, 1]
const ACCENT = [0.345, 0.8, 0.008, 1]
const INK = [0.122, 0.145, 0.11, 1]
const WHITE = [1, 1, 1, 1]
const CUP = [0.145, 0.165, 0.145, 1]
const CUP_INNER = [0.22, 0.24, 0.22, 1]
const SHADOW = [0.05, 0.07, 0.05, 1]
const FLAG = [0.122, 0.145, 0.11, 1]
const SPARK = [1, 0.84, 0.2, 1]

function fill(nm, k) {
  return { ty: 'fl', nm, c: { a: 0, k }, o: { a: 0, k: 100 }, r: 1, bm: 0, hd: false }
}

function stroke(k, w, lc = 2) {
  return {
    ty: 'st',
    nm: 'Stroke',
    c: { a: 0, k },
    o: { a: 0, k: 100 },
    w: { a: 0, k: w },
    lc,
    lj: 2,
    ml: 4,
    bm: 0,
    hd: false,
  }
}

function ellipse(size, pos = [0, 0]) {
  return { ty: 'el', nm: 'Ellipse', p: { a: 0, k: pos }, s: { a: 0, k: size }, d: 1, hd: false }
}

function rect(size, pos = [0, 0], r = 0) {
  return { ty: 'rc', nm: 'Rect', p: { a: 0, k: pos }, s: { a: 0, k: size }, r: { a: 0, k: r }, hd: false }
}

function path(v, i, o, c = true) {
  return {
    ty: 'sh',
    nm: 'Path',
    ks: { a: 0, k: { i, o, v, c }, ix: 2 },
    hd: false,
  }
}

function tr(opts = {}) {
  return {
    ty: 'tr',
    p: { a: 0, k: opts.p ?? [0, 0] },
    a: { a: 0, k: opts.a ?? [0, 0] },
    s: { a: 0, k: opts.s ?? [100, 100] },
    r: { a: 0, k: opts.r ?? 0 },
    o: { a: 0, k: opts.o ?? 100 },
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 },
    nm: 'Transform',
  }
}

function group(nm, items, transform) {
  return {
    ty: 'gr',
    nm,
    it: [...items, transform],
    np: items.length,
    cix: 2,
    bm: 0,
    ix: 1,
    mn: 'ADBE Vector Group',
    hd: false,
  }
}

function ease1() {
  return { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } }
}

function ease2() {
  return {
    i: { x: [0.42, 0.42], y: [1, 1] },
    o: { x: [0.58, 0.58], y: [0, 0] },
  }
}

function ease3() {
  return {
    i: { x: [0.42, 0.42, 0.42], y: [1, 1, 1] },
    o: { x: [0.58, 0.58, 0.58], y: [0, 0, 0] },
  }
}

function keys(dim, frames) {
  return {
    a: 1,
    k: frames.map((frame, index) => {
      const item = { t: frame.t, s: frame.s }
      if (index < frames.length - 1) {
        Object.assign(item, dim === 1 ? ease1() : dim === 2 ? ease2() : ease3())
      }
      return item
    }),
    ix: 2,
  }
}

function staticKs(p = [120, 128, 0], s = [100, 100, 100], r = 0, o = 100) {
  return {
    o: { a: 0, k: o, ix: 11 },
    r: { a: 0, k: r, ix: 10 },
    p: { a: 0, k: p, ix: 2 },
    a: { a: 0, k: [0, 0, 0], ix: 1 },
    s: { a: 0, k: s, ix: 6 },
  }
}

function animatedKs({ p, s, r, o, a = [0, 0, 0] }) {
  return {
    o: o ? { ...o, ix: 11 } : { a: 0, k: 100, ix: 11 },
    r: r ? { ...r, ix: 10 } : { a: 0, k: 0, ix: 10 },
    p: p ? { ...p, ix: 2 } : { a: 0, k: [120, 128, 0], ix: 2 },
    a: { a: 0, k: a, ix: 1 },
    s: s ? { ...s, ix: 6 } : { a: 0, k: [100, 100, 100], ix: 6 },
  }
}

function layer(ind, nm, shapes, ks) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks,
    ao: 0,
    shapes,
    ip: 0,
    op: OP,
    st: 0,
    bm: 0,
  }
}

function opacityKeys(holds) {
  return keys(
    1,
    holds.map((hold) => ({ t: hold.t, s: [hold.v] })),
  )
}

function scaleYBlink(blinks, rest = 100) {
  const frames = [{ t: 0, s: [100, rest] }]
  for (const blink of blinks) {
    frames.push({ t: blink - 3, s: [100, rest] })
    frames.push({ t: blink, s: [100, 8] })
    frames.push({ t: blink + 3, s: [100, rest] })
  }
  frames.push({ t: OP, s: [100, rest] })
  return keys(2, frames)
}

const characterPos = keys(3, [
  ...sampleBounce(0, 90, 128, 7, 2),
  ...sampleBounce(90, 180, 126, 11, 4).slice(1),
  { t: 188, s: [120, 86, 0] },
  { t: 202, s: [120, 128, 0] },
  { t: 214, s: [120, 100, 0] },
  { t: 228, s: [120, 128, 0] },
  { t: 248, s: [120, 108, 0] },
  { t: 270, s: [120, 136, 0] },
  { t: 300, s: [120, 138, 0] },
  { t: 360, s: [120, 132, 0] },
  { t: 380, s: [128, 128, 0] },
  { t: 420, s: [120, 128, 0] },
  { t: 432, s: [120, 78, 0] },
  { t: 448, s: [120, 128, 0] },
  { t: 462, s: [120, 96, 0] },
  { t: 500, s: [120, 128, 0] },
  { t: 518, s: [120, 128, 0] },
  { t: 540, s: [120, 118, 0] },
  { t: 560, s: [120, 128, 0] },
])

function sampleBounce(start, end, base, amp, cycles) {
  const frames = []
  const span = end - start
  const steps = cycles * 2
  for (let i = 0; i <= steps; i += 1) {
    const t = start + (span * i) / steps
    const up = i % 2 === 1
    frames.push({ t, s: [120, up ? base - amp : base, 0] })
  }
  return frames
}

const characterScale = keys(3, [
  { t: 0, s: [100, 100, 100] },
  { t: 22, s: [98, 104, 100] },
  { t: 45, s: [101, 98, 100] },
  { t: 90, s: [100, 100, 100] },
  { t: 102, s: [96, 108, 100] },
  { t: 114, s: [104, 96, 100] },
  { t: 180, s: [100, 100, 100] },
  { t: 188, s: [88, 118, 100] },
  { t: 202, s: [112, 90, 100] },
  { t: 228, s: [100, 100, 100] },
  { t: 270, s: [100, 100, 100] },
  { t: 290, s: [110, 92, 100] },
  { t: 360, s: [108, 94, 100] },
  { t: 420, s: [100, 100, 100] },
  { t: 432, s: [86, 120, 100] },
  { t: 448, s: [114, 88, 100] },
  { t: 500, s: [100, 100, 100] },
  { t: 518, s: [72, 72, 100] },
  { t: 534, s: [118, 118, 100] },
  { t: 560, s: [100, 100, 100] },
])

const characterRot = keys(1, [
  { t: 0, s: [0] },
  { t: 22, s: [-3] },
  { t: 45, s: [3] },
  { t: 90, s: [0] },
  { t: 102, s: [-8] },
  { t: 126, s: [8] },
  { t: 150, s: [-7] },
  { t: 180, s: [0] },
  { t: 195, s: [-12] },
  { t: 210, s: [14] },
  { t: 230, s: [-6] },
  { t: 270, s: [0] },
  { t: 300, s: [-10] },
  { t: 360, s: [-8] },
  { t: 380, s: [16] },
  { t: 400, s: [12] },
  { t: 420, s: [0] },
  { t: 435, s: [-16] },
  { t: 450, s: [18] },
  { t: 470, s: [-10] },
  { t: 500, s: [0] },
  { t: 530, s: [360] },
  { t: 560, s: [360] },
])

const shadowScale = keys(3, [
  { t: 0, s: [100, 100, 100] },
  { t: 22, s: [82, 82, 100] },
  { t: 45, s: [100, 100, 100] },
  { t: 90, s: [100, 100, 100] },
  { t: 102, s: [74, 74, 100] },
  { t: 114, s: [100, 100, 100] },
  { t: 180, s: [100, 100, 100] },
  { t: 188, s: [55, 55, 100] },
  { t: 202, s: [120, 100, 100] },
  { t: 270, s: [100, 100, 100] },
  { t: 300, s: [118, 90, 100] },
  { t: 420, s: [100, 100, 100] },
  { t: 432, s: [50, 50, 100] },
  { t: 448, s: [122, 100, 100] },
  { t: 500, s: [100, 100, 100] },
  { t: 518, s: [70, 70, 100] },
  { t: 560, s: [100, 100, 100] },
])

const armL = keys(1, [
  { t: 0, s: [-12] },
  { t: 45, s: [10] },
  { t: 90, s: [-12] },
  { t: 110, s: [-38] },
  { t: 140, s: [22] },
  { t: 180, s: [-12] },
  { t: 195, s: [-50] },
  { t: 220, s: [40] },
  { t: 270, s: [-18] },
  { t: 320, s: [-28] },
  { t: 360, s: [-20] },
  { t: 380, s: [-48] },
  { t: 420, s: [-12] },
  { t: 440, s: [-60] },
  { t: 470, s: [28] },
  { t: 500, s: [-12] },
  { t: 530, s: [20] },
  { t: 560, s: [-12] },
])

const armR = keys(1, [
  { t: 0, s: [12] },
  { t: 45, s: [-10] },
  { t: 90, s: [12] },
  { t: 110, s: [38] },
  { t: 140, s: [-22] },
  { t: 180, s: [12] },
  { t: 195, s: [50] },
  { t: 220, s: [-40] },
  { t: 270, s: [18] },
  { t: 320, s: [8] },
  { t: 360, s: [12] },
  { t: 380, s: [36] },
  { t: 420, s: [12] },
  { t: 440, s: [60] },
  { t: 470, s: [-28] },
  { t: 500, s: [12] },
  { t: 530, s: [-20] },
  { t: 560, s: [12] },
])

const flagRot = keys(1, [
  { t: 0, s: [0] },
  { t: 30, s: [14] },
  { t: 60, s: [-10] },
  { t: 90, s: [0] },
  { t: 110, s: [22] },
  { t: 140, s: [-18] },
  { t: 180, s: [0] },
  { t: 210, s: [28] },
  { t: 240, s: [-16] },
  { t: 270, s: [-8] },
  { t: 360, s: [-6] },
  { t: 420, s: [0] },
  { t: 450, s: [32] },
  { t: 480, s: [-20] },
  { t: 500, s: [0] },
  { t: 530, s: [40] },
  { t: 560, s: [0] },
])

const smileOp = opacityKeys([
  { t: 0, v: 100 },
  { t: 179, v: 100 },
  { t: 180, v: 0 },
  { t: 269, v: 0 },
  { t: 270, v: 0 },
  { t: 419, v: 0 },
  { t: 420, v: 100 },
  { t: 560, v: 100 },
])

const grinOp = opacityKeys([
  { t: 0, v: 0 },
  { t: 180, v: 100 },
  { t: 269, v: 100 },
  { t: 270, v: 0 },
  { t: 419, v: 0 },
  { t: 420, v: 100 },
  { t: 499, v: 100 },
  { t: 500, v: 0 },
  { t: 560, v: 0 },
])

const sadOp = opacityKeys([
  { t: 0, v: 0 },
  { t: 269, v: 0 },
  { t: 270, v: 100 },
  { t: 419, v: 100 },
  { t: 420, v: 0 },
  { t: 560, v: 0 },
])

const sparkOp = opacityKeys([
  { t: 0, v: 0 },
  { t: 180, v: 100 },
  { t: 268, v: 100 },
  { t: 270, v: 0 },
  { t: 420, v: 100 },
  { t: 498, v: 100 },
  { t: 500, v: 0 },
  { t: 560, v: 0 },
])

const eyeScale = scaleYBlink([42, 128, 248, 390, 470], 100)
const loseLid = opacityKeys([
  { t: 0, v: 0 },
  { t: 269, v: 0 },
  { t: 270, v: 100 },
  { t: 419, v: 70 },
  { t: 420, v: 0 },
  { t: 560, v: 0 },
])

function animatedGroup(nm, items, extra) {
  const transform = {
    ty: 'tr',
    p: extra.p ?? { a: 0, k: extra.pos ?? [0, 0] },
    a: { a: 0, k: extra.anchor ?? [0, 0] },
    s: extra.s ?? { a: 0, k: [100, 100] },
    r: extra.r ?? { a: 0, k: extra.rot ?? 0 },
    o: extra.o ?? { a: 0, k: extra.opacity ?? 100 },
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 },
    nm: 'Transform',
  }
  return group(nm, items, transform)
}

const shadowLayer = layer(
  1,
  'shadow',
  [group('shadow', [ellipse([96, 22]), fill('shadowFill', [...SHADOW.slice(0, 3), 0.28])], tr({ p: [0, 0] }))],
  animatedKs({
    p: { a: 0, k: [120, 214, 0] },
    s: shadowScale,
    a: [0, 0, 0],
  }),
)

const sparkle = (nm, pos, size, delay) =>
  animatedGroup(
    nm,
    [ellipse(size), fill('accentFill', SPARK)],
    {
      pos,
      s: keys(2, [
        { t: 0, s: [0, 0] },
        { t: 180 + delay, s: [0, 0] },
        { t: 196 + delay, s: [120, 120] },
        { t: 230 + delay, s: [40, 40] },
        { t: 270, s: [0, 0] },
        { t: 420 + delay, s: [0, 0] },
        { t: 436 + delay, s: [130, 130] },
        { t: 470 + delay, s: [20, 20] },
        { t: 500, s: [0, 0] },
        { t: 560, s: [0, 0] },
      ]),
    },
  )

const sparkLayer = layer(
  2,
  'sparkles',
  [
    sparkle('s1', [46, 64], [14, 14], 0),
    sparkle('s2', [198, 58], [12, 12], 8),
    sparkle('s3', [40, 150], [10, 10], 14),
    sparkle('s4', [204, 148], [16, 16], 6),
    sparkle('s5', [120, 36], [11, 11], 10),
  ],
  animatedKs({ o: sparkOp, p: { a: 0, k: [0, 0, 0] } }),
)

const leftArm = animatedGroup(
  'leftArm',
  [ellipse([34, 22]), fill('outlineFill', OUTLINE), ellipse([28, 18]), fill('bodyFill', BODY)],
  { pos: [58, 148], anchor: [8, 0], r: armL },
)

const rightArm = animatedGroup(
  'rightArm',
  [ellipse([34, 22]), fill('outlineFill', OUTLINE), ellipse([28, 18]), fill('bodyFill', BODY)],
  { pos: [182, 148], anchor: [-8, 0], r: armR },
)

const leftFoot = group('leftFoot', [ellipse([28, 16]), fill('outlineFill', OUTLINE)], tr({ p: [94, 196] }))
const rightFoot = group('rightFoot', [ellipse([28, 16]), fill('outlineFill', OUTLINE)], tr({ p: [146, 196] }))

const body = group(
  'body',
  [
    ellipse([128, 146]),
    fill('outlineFill', OUTLINE),
    ellipse([116, 134]),
    fill('bodyFill', BODY),
    ellipse([58, 40], [0, 18]),
    fill('bellyFill', BELLY),
  ],
  tr({ p: [120, 132], a: [0, 8] }),
)

const leftCup = group(
  'leftCup',
  [
    ellipse([38, 42]),
    fill('outlineFill', OUTLINE),
    ellipse([32, 36]),
    fill('cup', CUP),
    ellipse([18, 20]),
    fill('cupInner', CUP_INNER),
  ],
  tr({ p: [58, 118] }),
)

const rightCup = group(
  'rightCup',
  [
    ellipse([38, 42]),
    fill('outlineFill', OUTLINE),
    ellipse([32, 36]),
    fill('cup', CUP),
    ellipse([18, 20]),
    fill('cupInner', CUP_INNER),
  ],
  tr({ p: [182, 118] }),
)

const band = group(
  'band',
  [
    path(
      [
        [-52, 8],
        [0, -28],
        [52, 8],
      ],
      [
        [0, 0],
        [-22, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [22, 0],
        [0, 0],
      ],
      false,
    ),
    stroke(INK, 10),
  ],
  tr({ p: [120, 86] }),
)

const stem = group('stem', [rect([12, 58], [0, 0], 6), fill('ink', INK)], tr({ p: [156, 58], r: 12 }))

const noteFlag = animatedGroup(
  'flag',
  [
    path(
      [
        [0, -8],
        [34, -18],
        [38, 6],
        [8, 10],
      ],
      [
        [0, 0],
        [-8, 10],
        [0, 0],
        [6, -8],
      ],
      [
        [12, -4],
        [8, 8],
        [-10, 4],
        [0, 0],
      ],
    ),
    fill('ink', FLAG),
  ],
  { pos: [164, 42], r: flagRot },
)

const leftEyeWhite = animatedGroup(
  'leftEye',
  [
    ellipse([36, 40]),
    stroke(INK, 3),
    fill('eye', WHITE),
    ellipse([18, 20], [1, 3]),
    fill('ink', INK),
    ellipse([7, 8], [-4, -6]),
    fill('eye', WHITE),
  ],
  { pos: [98, 118], s: eyeScale },
)

const rightEyeWhite = animatedGroup(
  'rightEye',
  [
    ellipse([36, 40]),
    stroke(INK, 3),
    fill('eye', WHITE),
    ellipse([18, 20], [1, 3]),
    fill('ink', INK),
    ellipse([7, 8], [-4, -6]),
    fill('eye', WHITE),
  ],
  { pos: [142, 118], s: eyeScale },
)

const lids = animatedGroup(
  'lids',
  [ellipse([30, 16], [-18, 0]), fill('bodyFill', BODY), ellipse([30, 16], [18, 0]), fill('bodyFill', BODY)],
  { pos: [120, 112], o: loseLid },
)

const leftCheek = group('leftCheek', [ellipse([20, 12]), fill('cheekFill', CHEEK)], tr({ p: [80, 144], o: 92 }))
const rightCheek = group('rightCheek', [ellipse([20, 12]), fill('cheekFill', CHEEK)], tr({ p: [160, 144], o: 92 }))

const smile = animatedGroup(
  'smile',
  [
    path(
      [
        [-16, 0],
        [0, 12],
        [16, 0],
      ],
      [
        [0, 0],
        [-8, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [8, 0],
        [0, 0],
      ],
      false,
    ),
    stroke(INK, 5),
  ],
  { pos: [120, 152], o: smileOp },
)

const grin = animatedGroup(
  'grin',
  [ellipse([28, 18]), fill('ink', INK), ellipse([22, 10]), fill('eye', WHITE)],
  { pos: [120, 156], o: grinOp },
)

const sad = animatedGroup(
  'sad',
  [
    path(
      [
        [-14, 8],
        [0, -4],
        [14, 8],
      ],
      [
        [0, 0],
        [-6, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [6, 0],
        [0, 0],
      ],
      false,
    ),
    stroke(INK, 5),
  ],
  { pos: [120, 156], o: sadOp },
)

const shine = group(
  'shine',
  [ellipse([28, 18]), fill('eye', [1, 1, 1, 0.22])],
  tr({ p: [96, 86], r: -28 }),
)

const characterLayer = layer(
  3,
  'noot',
  [
    sad,
    grin,
    smile,
    lids,
    leftEyeWhite,
    rightEyeWhite,
    leftCheek,
    rightCheek,
    noteFlag,
    stem,
    leftCup,
    rightCup,
    band,
    shine,
    body,
    leftArm,
    rightArm,
    leftFoot,
    rightFoot,
  ],
  animatedKs({
    p: characterPos,
    s: characterScale,
    r: characterRot,
    a: [120, 140, 0],
  }),
)

const animation = {
  v: '5.7.4',
  fr: FR,
  ip: 0,
  op: OP,
  w: 240,
  h: 240,
  nm: 'Noot',
  ddd: 0,
  assets: [],
  layers: [sparkLayer, characterLayer, shadowLayer],
  markers: [
    { tm: 0, cm: 'idle', dr: 90 },
    { tm: 90, cm: 'play', dr: 90 },
    { tm: 180, cm: 'win', dr: 90 },
    { tm: 270, cm: 'lose', dr: 90 },
    { tm: 360, cm: 'skip', dr: 60 },
    { tm: 420, cm: 'streak', dr: 80 },
    { tm: 500, cm: 'switch', dr: 60 },
  ],
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'noot.json'), JSON.stringify(animation))
writeFileSync(
  join(outDir, 'LICENSE.txt'),
  [
    'Noot mascot Lottie (public/mascot/noot.json)',
    'Original character and animation authored for SongGuessr.',
    'Not affiliated with Duolingo. Do not copy Duo the owl.',
    'License: CC0 1.0 Universal for this mascot JSON in this repository.',
    '',
    'Streak flame: public/streak-flame.json',
    'Flame - Streak by Noah Wise, LottieFiles animation 1027695.',
    'Lottie Simple License (free commercial use; attribution encouraged):',
    'https://lottiefiles.com/free-animation/flame-streak-Y3x3T9TqFh',
    '',
  ].join('\n'),
)
console.log('Wrote public/mascot/noot.json')
