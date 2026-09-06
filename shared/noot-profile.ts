export interface NootAppearance {
  headgear: "headphones" | "cat-earphones" | "daisy" | "none";
  clothing: "none" | "scarf" | "bow" | "bandana";
  eyewear: "none" | "round" | "sunny";
  pattern: "plain" | "stripes" | "dots" | "gingham" | "confetti";
  accessoryColor:
    "blue" | "rose" | "gold" | "mint" | "lavender" | "coral" | "navy";
}
export function parseAppearance(value: unknown): NootAppearance {
  const v = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const pick = <T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
  ): T => (allowed.includes(v[key] as T) ? (v[key] as T) : fallback);
  return {
    pattern: pick(
      "pattern",
      ["plain", "stripes", "dots", "gingham", "confetti"],
      "plain",
    ),
    headgear: pick(
      "headgear",
      ["headphones", "cat-earphones", "daisy", "none"],
      "headphones",
    ),
    clothing: pick("clothing", ["none", "scarf", "bow", "bandana"], "none"),
    eyewear: pick("eyewear", ["none", "round", "sunny"], "none"),
    accessoryColor: pick(
      "accessoryColor",
      ["blue", "rose", "gold", "mint", "lavender", "coral", "navy"],
      "blue",
    ),
  };
}
