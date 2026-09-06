import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAppearance } from "./noot-profile.ts";
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
