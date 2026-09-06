import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAppearance } from './noot-profile.ts'
test('appearance accepts only supported wearables and ignores injected fields', () => {
  const p = parseAppearance({
    headgear: 'daisy',
    clothing: 'scarf',
    eyewear: 'round',
    accessoryColor: 'rose',
    scale: 99,
  })
  assert.deepEqual(p, {
    headgear: 'daisy',
    clothing: 'scarf',
    eyewear: 'round',
    accessoryColor: 'rose',
  })
  assert.equal(parseAppearance(null).clothing, 'none')
  assert.equal(parseAppearance({ eyewear: 'bad' }).eyewear, 'none')
})
