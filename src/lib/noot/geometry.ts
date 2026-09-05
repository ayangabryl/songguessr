import * as THREE from 'three'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'

export const HEAD_Y = 1.4
export const CROWN_Y = 2.80
// Front silhouette measured from the supplied Noot reference: rounded base,
// generous lower belly, nearly straight cheeks, then shoulders flowing into the note.
const PROFILE = [
  [.24, 0], [.28, .40], [.40, .69], [.60, .86], [.85, .97],
  [1.10, .99], [1.40, .94], [1.70, .90], [2.00, .845],
  [2.20, .81], [2.40, .74], [2.60, .58], [2.75, .35], [2.90, .12], [2.96, 0],
]
const DEPTH = .72
function bodyRadius(y: number) {
  if (y < PROFILE[0][0]) return -(PROFILE[0][0] - y)
  if (y > PROFILE.at(-1)![0]) return -(y - PROFILE.at(-1)![0])
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i], b = PROFILE[i + 1]
    if (y > b[0]) continue
    const prev = PROFILE[Math.max(0, i-1)], next = PROFILE[Math.min(PROFILE.length-1, i+2)]
    const t = (y-a[0])/(b[0]-a[0]), t2=t*t, t3=t2*t
    const m0=(b[1]-prev[1])/(b[0]-prev[0])*(b[0]-a[0])
    const m1=(next[1]-a[1])/(next[0]-a[0])*(b[0]-a[0])
    return (2*t3-3*t2+1)*a[1]+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b[1]+(t3-t2)*m1
  }
  return 0
}
/** Surface shared by the sculpt, eyes, mouth and belly, so nothing floats. */
export function frontSurface(x: number, y: number) {
  const radius = Math.max(0, bodyRadius(y))
  return DEPTH * Math.sqrt(Math.max(0, radius*radius-x*x))
}
function smoothUnion(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/** A single watertight sculpt joins the pear and the hooked music note. */
export function sculptBody() {
  const outline = new THREE.Shape()
  outline.moveTo(-0.18, 2.21)
  outline.bezierCurveTo(-0.06, 2.51, -0.04, 2.96, 0.035, 3.24)
  outline.bezierCurveTo(0.055, 3.37, 0.13, 3.38, 0.24, 3.30)
  outline.bezierCurveTo(0.34, 3.26, 0.50, 3.18, 0.50, 3.065)
  outline.bezierCurveTo(0.51, 2.97, 0.42, 2.985, 0.32, 3.055)
  outline.quadraticCurveTo(0.21, 3.14, 0.19, 3.045)
  outline.bezierCurveTo(0.15, 2.77, 0.11, 2.47, 0.28, 2.23)
  outline.closePath()
  const polygon = outline.getPoints(7).map(p => new THREE.Vector2(p.x * .92, p.y + .42))
  const segments = polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length]
    return { x: a.x, y: a.y, dx: b.x - a.x, dy: b.y - a.y, by: b.y, length: Math.max(1e-8, a.distanceToSquared(b)) }
  })
  const resolution = 112, extent = 2.1, offset = 2.0
  const material = new THREE.MeshBasicMaterial()
  const field = new MarchingCubes(resolution, material, false, false, 60000)
  field.isolation = 0
  for (let iz = 0; iz < resolution; iz++) for (let iy = 0; iy < resolution; iy++) {
    const z = (iz / resolution * 2 - 1) * extent
    const y = (iy / resolution * 2 - 1) * extent + offset
    const radius = bodyRadius(y)
    for (let ix = 0; ix < resolution; ix++) {
      const x = (ix / resolution * 2 - 1) * extent
      const body = (Math.hypot(x, z / DEPTH) - radius) * DEPTH
      let distance = body
      if (y > 2.45 && Math.abs(x) < 0.8 && Math.abs(z) < 0.55) {
        let d2 = Infinity, inside = false
        for (const s of segments) {
          const px = x - s.x, py = y - s.y
          const t = THREE.MathUtils.clamp((px * s.dx + py * s.dy) / s.length, 0, 1)
          d2 = Math.min(d2, (px - s.dx * t) ** 2 + (py - s.dy * t) ** 2)
          if ((s.y > y) !== (s.by > y) && x < s.x + s.dx * (y - s.y) / s.dy) inside = !inside
        }
        const xy = Math.sqrt(d2) * (inside ? -1 : 1)
        const dz = Math.abs(z) - 0.075
        const note = Math.hypot(Math.max(xy, 0), Math.max(dz, 0)) + Math.min(Math.max(xy, dz), 0) - 0.032
        distance = smoothUnion(body, note, 0.13)
      }
      field.field[ix + iy * resolution + iz * resolution * resolution] = -distance
    }
  }
  field.update()
  const geometry = new THREE.BufferGeometry()
  const count = field.geometry.drawRange.count
  for (const name of ['position', 'normal']) {
    const source = field.geometry.getAttribute(name)
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(source.array.slice(0, count * 3), 3))
  }
  geometry.scale(extent, extent, extent); geometry.translate(0, offset, 0)
  field.geometry.dispose(); material.dispose()
  return addSkinWeights(geometry)
}
export function addSkinWeights(geometry: THREE.BufferGeometry) {
  const p = geometry.getAttribute('position'), indices = [], weights = []
  for (let i = 0; i < p.count; i++) {
    const head = THREE.MathUtils.smoothstep(p.getY(i), 1.15, 1.62)
    const crown = THREE.MathUtils.smoothstep(p.getY(i), 2.73, 3.55)
    const tip = THREE.MathUtils.smoothstep(p.getY(i), 3.30, 3.72)
    indices.push(0, 1, 2, 3); weights.push(1 - head, head * (1 - crown), head * crown * (1-tip), head*crown*tip)
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
  return geometry
}
/** An oval mapped onto the sculpt, with a tiny optional corneal bulge. */
export function surfaceOval(cx: number, cy: number, rx: number, ry: number, bulge = 0, offset = 0.007) {
  const positions = [], uv = [], indices = []
  const rings = 16, sectors = 64
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= sectors; j++) {
    const r = i / rings, a = j / sectors * Math.PI * 2
    const u = Math.cos(a) * r, v = Math.sin(a) * r, x = cx + u * rx, y = cy + v * ry
    positions.push(x, y, frontSurface(x, y) + offset + bulge * (1 - r * r))
    uv.push((u + 1) / 2, (v + 1) / 2)
    if (i < rings && j < sectors) { const a = i * (sectors + 1) + j, b = a + sectors + 1; indices.push(a, b, a + 1, a + 1, b, b + 1) }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(indices); geo.computeVertexNormals()
  return geo
}

/** Blended volumes keep palms and ankles continuous instead of stacking primitives. */
export function sculptLimb(kind: 'hand' | 'foot', side = 1) {
  const field = new MarchingCubes(72, new THREE.MeshBasicMaterial(), false, false, 32000)
  field.isolation = 0
  const volumes = kind === 'hand'
    ? [[side*.075,-.24,0,.125,.30,.12],[side*.16,-.54,.015,.14,.24,.125],[side*.065,-.59,.07,.07,.105,.08]]
    : [[0,.015,.045,.30,.16,.28],[0,.13,-.055,.235,.225,.21]]
  for(let z=0;z<72;z++)for(let y=0;y<72;y++)for(let x=0;x<72;x++) {
    const px=x/36-1, py=y/36-1, pz=z/36-1
    let d=10
    for(const [cx,cy,cz,rx,ry,rz] of volumes) {
      const q=Math.hypot((px-cx)/rx,(py-cy)/ry,(pz-cz)/rz)-1
      d=smoothUnion(d,q*Math.min(rx,ry,rz),.055)
    }
    field.field[x+y*72+z*72*72]=-d
  }
  field.update()
  const geometry=new THREE.BufferGeometry(), count=field.geometry.drawRange.count
  for(const name of ['position','normal']) geometry.setAttribute(name,new THREE.Float32BufferAttribute(field.geometry.getAttribute(name).array.slice(0,count*3),3))
  field.geometry.dispose(); (field.material as THREE.Material).dispose()
  return geometry
}
