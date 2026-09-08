import { parseNootColor, type NootColor } from "./noot-colors.ts";
export const NOOT_TAILORED = ["cardigan", "varsity", "overalls", "dress", "ballet", "suit", "hoodie", "tracksuit", "raincoat"] as const;
export interface NootAppearance {
  headgear: "headphones" | "cat-earphones" | "daisy" | "beanie" | "bucket" | "none";
  clothing: "none" | "scarf" | "bow" | "bandana" | "shirt" | (typeof NOOT_TAILORED)[number];
  eyewear: "none" | "round" | "sunny";
  pattern: "plain" | "stripes" | "dots" | "gingham" | "confetti";
  accessoryColor: NootColor;
  headColor?: NootColor;
  shoeColor?: NootColor;
  trimColor?: NootColor;
  footwear?: "none" | "sneakers" | "boots" | "high-tops" | "mary-janes";
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
      ["headphones", "cat-earphones", "daisy", "beanie", "bucket", "none"],
      "headphones",
    ),
    clothing: pick("clothing", ["none", "scarf", "bow", "bandana", "shirt", ...NOOT_TAILORED], "none"),
    eyewear: pick("eyewear", ["none", "round", "sunny"], "none"),
    accessoryColor: parseNootColor(v.accessoryColor),
    ...(v.headColor !== undefined ? { headColor: parseNootColor(v.headColor) } : {}),
    ...(v.trimColor !== undefined ? { trimColor: parseNootColor(v.trimColor) } : {}),
    ...(v.shoeColor !== undefined ? { shoeColor: parseNootColor(v.shoeColor) } : {}),
    ...(v.footwear !== undefined ? { footwear: pick<NonNullable<NootAppearance["footwear"]>>("footwear", ["none", "sneakers", "boots", "high-tops", "mary-janes"] as const, "none") } : {}),
  };
}
