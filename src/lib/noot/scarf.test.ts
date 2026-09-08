import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createScarf } from './scarf.ts'
import { frontSurface } from './geometry.ts'

test('Blender scarf is a compact solid mesh with connected top edges and bounded free-end flutter', () => {
  const mesh = createScarf(new THREE.MeshStandardMaterial())
  const p = mesh.geometry.getAttribute('position'), delta = mesh.geometry.morphAttributes.position[0]
  assert(mesh.geometry.index!.count / 3 < 3500)
  assert(p.count < 1800)
  let moving = 0, rear = 0
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    assert(Number.isFinite(x + y + z))
    if (z < 0) rear++
    const displacement = Math.hypot(delta.getX(i), delta.getY(i), delta.getZ(i))
    assert(displacement < .065)
    if (y > 1.51) assert.equal(displacement, 0, 'the wrap and attachment remain anchored')
    if (displacement > .001) {
      moving++
      for (const weight of [-.8, 0, .8]) {
        const px = x + delta.getX(i) * weight, py = y + delta.getY(i) * weight
        assert(z + delta.getZ(i) * weight > frontSurface(px, py) * .84 / .72, 'flutter remains outside the chest')
      }
    }
  }
  assert(moving > 100); assert(rear > 100, 'fabric wraps around Noot rather than stopping at the front')
  const second = createScarf(mesh.material)
  mesh.morphTargetInfluences![0] = .8
  assert.equal(second.morphTargetInfluences![0], 0, 'each player owns its cloth motion')
  mesh.geometry.dispose(); second.geometry.dispose(); (mesh.material as THREE.Material).dispose()
})
