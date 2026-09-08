import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPreferenceStore, parsePreferences } from './preference-store.ts'
test('editing a dress ribbon retains fabric and shoe colors after reopening', () => {
  let raw: string | null = null
  const store=createPreferenceStore(()=>raw,value=>{raw=value})
  store.update({clothing:'dress',footwear:'mary-janes',accessoryColor:'pink',shoeColor:'rose'})
  store.update({trimColor:'#438c91'})
  const restored=parsePreferences(createPreferenceStore(()=>raw,()=>{}).snapshot())
  assert.equal(restored.clothing,'dress'); assert.equal(restored.footwear,'mary-janes')
  assert.equal(restored.trimColor,'#438c91'); assert.equal(restored.accessoryColor,'pink'); assert.equal(restored.shoeColor,'rose')
})

test('partial outfit edits merge with the latest stored choices and survive remounts', () => {
  let raw: string | null = null
  const read = () => raw, write = (value: string) => { raw = value }
  const a = createPreferenceStore(read, write), b = createPreferenceStore(read, write)
  a.update({ clothing: 'scarf', pattern: 'gingham' })
  b.update({ headgear: 'cat-earphones', accessoryColor: 'rose' })
  a.update({ eyewear: 'round' })
  const saved = parsePreferences(createPreferenceStore(read, write).snapshot())
  assert.deepEqual(saved, { clothing: 'scarf', pattern: 'gingham', headgear: 'cat-earphones', accessoryColor: 'rose', eyewear: 'round', mood: 'chill' })
})
test('a failed storage write never restores an older outfit, and later edits retry saving', () => {
  let raw = JSON.stringify({ clothing: 'shirt' }), blocked = true
  const store = createPreferenceStore(() => raw, value => { if (blocked) throw new Error('quota'); raw = value })
  store.update({ clothing: 'scarf' })
  store.update({ accessoryColor: 'coral' })
  assert.equal(store.persisted, false)
  assert.equal(parsePreferences(store.snapshot()).clothing, 'scarf')
  assert.equal(parsePreferences(raw).clothing, 'shirt')
  blocked = false
  store.update({ pattern: 'dots' })
  assert.equal(store.persisted, true)
  assert.deepEqual(parsePreferences(raw), parsePreferences(store.snapshot()))
  assert.equal(parsePreferences(raw).clothing, 'scarf')
})
test('unavailable reads keep the session choice; clearing or receiving storage refreshes it', () => {
  let raw: string | null = JSON.stringify({ clothing: 'scarf' }), blocked = false
  const store = createPreferenceStore(() => { if (blocked) throw new Error('blocked'); return raw }, value => { raw = value })
  store.snapshot(); blocked = true
  assert.equal(parsePreferences(store.snapshot()).clothing, 'scarf')
  blocked = false; raw = null; store.received(null)
  assert.equal(parsePreferences(store.snapshot()).clothing, 'none')
  raw = JSON.stringify({ headgear: 'beanie' }); store.received(raw)
  assert.equal(parsePreferences(store.snapshot()).headgear, 'beanie')
})
test('damaged storage and unknown wardrobe values normalize to valid defaults', () => {
  for (const raw of ['{bad', 'null', '42', '"scarf"', '{"clothing":"cloak","mood":[]}']) {
    const parsed = parsePreferences(raw)
    assert.equal(parsed.clothing, 'none'); assert.equal(parsed.mood, 'chill')
  }
})

test('new fashion and independent colors persist across stores and partial edits', () => {
  let raw: string | null = null
  const store = createPreferenceStore(() => raw, value => { raw = value })
  store.update({clothing:'overalls',footwear:'boots',accessoryColor:'#1278ab',headColor:'yellow',shoeColor:'cocoa'})
  store.update({eyewear:'sunny'})
  const restored = parsePreferences(createPreferenceStore(() => raw, () => {}).snapshot())
  assert.equal(restored.clothing, 'overalls'); assert.equal(restored.footwear, 'boots')
  assert.equal(restored.accessoryColor, '#1278ab'); assert.equal(restored.headColor, 'yellow'); assert.equal(restored.shoeColor, 'cocoa')
})
