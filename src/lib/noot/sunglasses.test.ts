import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createSunglasses } from './sunglasses.ts'
import { frontSurface } from './geometry.ts'

test('Blender sunglasses have solid fitted lenses and stay within a three-draw budget', () => {
  const sunglasses = createSunglasses()
  assert.equal(sunglasses.root.children.length, 3)
  let triangles = 0
  for (const object of sunglasses.root.children) {
    const mesh = object as THREE.Mesh, positions = mesh.geometry.getAttribute('position')
    triangles += mesh.geometry.index!.count / 3
    for (let i = 0; i < positions.count; i++) assert(Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i)))
  }
  assert(triangles < 5000)
  const lenses = sunglasses.root.getObjectByName('Noot_Sunglasses_lenses') as THREE.Mesh
  const p = lenses.geometry.getAttribute('position')
  let front = 0, rear = 0
  for (let i = 0; i < p.count; i++) {
    const clearance = p.getZ(i) - frontSurface(p.getX(i), p.getY(i)) * .84 / .72
    assert(clearance > .05, 'lens stays ahead of eyes and blinking lids')
    if (lenses.geometry.getAttribute('normal').getZ(i) > .5) front++
    if (lenses.geometry.getAttribute('normal').getZ(i) < -.5) rear++
  }
  assert(front > 50 && rear > 50, 'closed lenses have front and rear surfaces')
  const material = lenses.material as THREE.MeshPhysicalMaterial
  assert.equal(material.transparent, false)
  assert.equal(material.transmission, 0, 'no second scene render for lens transmission')
})

test('headphone fit tucks the side arms forward without changing other players or stretching the rims', () => {
  const a = createSunglasses(), b = createSunglasses()
  const temples = a.root.getObjectByName('Noot_Sunglasses_temples') as THREE.Mesh
  const other = b.root.getObjectByName('Noot_Sunglasses_temples') as THREE.Mesh
  for (const headgear of ['headphones', 'cat-earphones'] as const) {
    a.fit(headgear)
    assert.equal(temples.morphTargetInfluences![0], 1)
    assert.equal(other.morphTargetInfluences![0], 0)
    const p = temples.geometry.getAttribute('position'), fit = temples.geometry.morphAttributes.position[0]
    for (let i = 0; i < p.count; i++) assert(p.getZ(i) + fit.getZ(i) > .36, 'temple remains ahead of the earcup surface')
  }
  for (const headgear of ['none', 'bucket', 'beanie', 'daisy'] as const) {
    a.fit(headgear); assert.equal(temples.morphTargetInfluences![0], 0)
  }
  const rims = a.root.getObjectByName('Noot_Sunglasses_frame') as THREE.Mesh
  assert.equal(rims.geometry.morphAttributes.position, undefined)
})
