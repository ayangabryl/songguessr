import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAppearance } from "./noot-profile.ts";
test('dress, formal and street outfits retain custom detailing on multiplayer round trips', () => {
  for (const clothing of ['dress','ballet','suit','hoodie','tracksuit','raincoat']) for (const footwear of ['high-tops','mary-janes']) {
    const saved = parseAppearance({clothing,footwear,trimColor:'#Ab9234',accessoryColor:'pink',shoeColor:'black'})
    assert.equal(saved.clothing,clothing); assert.equal(saved.footwear,footwear)
    assert.equal(saved.trimColor,'#ab9234')
    assert.deepEqual(parseAppearance(JSON.parse(JSON.stringify(saved))),saved)
  }
  assert.equal(parseAppearance({}).trimColor,undefined)
  assert.equal(parseAppearance({trimColor:'url(bad)'}).trimColor,'blue')
})
test("appearance accepts only supported wearables and ignores injected fields", () => {
  const p = parseAppearance({
    headgear: "daisy",
    clothing: "scarf",
    eyewear: "round",
    accessoryColor: "rose",
    scale: 99,
  });
  assert.deepEqual(p, {
    headgear: "daisy",
    clothing: "scarf",
    eyewear: "round",
    accessoryColor: "rose",
    pattern: "plain",
  });
  assert.equal(parseAppearance(null).clothing, "none");
  assert.equal(parseAppearance({ eyewear: "bad" }).eyewear, "none");
});

test("fabric patterns and extended colors survive profile validation", () => {
  for (const pattern of ["plain", "stripes", "dots", "gingham", "confetti"]) {
    assert.equal(
      parseAppearance({ pattern, accessoryColor: "coral" }).pattern,
      pattern,
    );
    assert.equal(
      parseAppearance({ pattern, accessoryColor: "coral" }).accessoryColor,
      "coral",
    );
  }
  assert.equal(
    parseAppearance({ accessoryColor: "navy" }).accessoryColor,
    "navy",
  );
  assert.equal(parseAppearance({ pattern: "invalid" }).pattern, "plain");
  assert.equal(parseAppearance({}).pattern, "plain");
});

test('Blender fashion and separate custom colors survive multiplayer validation', () => {
  const input = { headgear: 'bucket', clothing: 'varsity', footwear: 'sneakers', accessoryColor: '#ABC123', headColor: 'ivory', shoeColor: '#334455' }
  const first = parseAppearance(input), rejoined = parseAppearance(JSON.parse(JSON.stringify(first)))
  assert.deepEqual(first, rejoined)
  assert.equal(first.clothing, 'varsity'); assert.equal(first.footwear, 'sneakers')
  assert.equal(first.accessoryColor, '#abc123'); assert.equal(first.headColor, 'ivory'); assert.equal(first.shoeColor, '#334455')
  for (const clothing of ['cardigan','overalls']) assert.equal(parseAppearance({clothing}).clothing, clothing)
  for (const bad of ['#fff','#abcdefgh','url(https://example.com)',[],{},'__proto__']) {
    assert.equal(parseAppearance({accessoryColor:bad,headColor:bad,shoeColor:bad}).accessoryColor, 'blue')
    assert.equal(parseAppearance({headColor:bad}).headColor, 'blue')
  }
  assert.equal(parseAppearance({footwear:'flying-shoes'}).footwear, 'none')
  assert.equal(parseAppearance({}).headColor, undefined, 'old outfits retain linked hat color until edited')
})

test('expanded head, eye and foot choices and independent frame colors survive room serialization', () => {
  const slots = {
    headgear: ['cap','beret','visor','crown','party-hat','flower-crown'],
    eyewear: ['round','square','cat-eye','aviator','heart','star','sport'],
    footwear: ['sneakers','boots','high-tops','mary-janes','loafers','sandals','slippers','ballet-flats'],
  } as const
  for (const [slot, choices] of Object.entries(slots)) for (const choice of choices) {
    const parsed = parseAppearance({[slot]:choice,eyeColor:'#Af092B',headColor:'ivory',shoeColor:'cocoa'})
    assert.equal(parsed[slot as keyof typeof slots], choice)
    assert.equal(parsed.eyeColor, '#af092b')
    assert.deepEqual(parseAppearance(JSON.parse(JSON.stringify(parsed))), parsed)
  }
  assert.equal(parseAppearance({eyeColor:'url(bad)'}).eyeColor, 'blue')
  assert.equal(parseAppearance({}).eyeColor, undefined)
})
