import { parseNootColor, type NootColor } from "./noot-colors.ts";
export const NOOT_TAILORED = ["cardigan", "varsity", "overalls", "dress", "ballet", "suit", "hoodie", "tracksuit", "raincoat"] as const;
export const NOOT_FASHION_HATS = ["cap", "beret", "visor", "crown", "party-hat", "flower-crown"] as const;
export const NOOT_FASHION_EYES = ["round", "square", "cat-eye", "aviator", "heart", "star", "sport"] as const;
export const NOOT_FOOTWEAR = ["sneakers", "boots", "high-tops", "mary-janes", "loafers", "sandals", "slippers", "ballet-flats"] as const;
export interface NootAppearance {
  headgear: "headphones" | "cat-earphones" | "daisy" | "beanie" | "bucket" | "none" | (typeof NOOT_FASHION_HATS)[number];
  clothing: "none" | "scarf" | "bow" | "bandana" | "shirt" | (typeof NOOT_TAILORED)[number];
  eyewear: "none" | "sunny" | (typeof NOOT_FASHION_EYES)[number];
  pattern: "plain" | "stripes" | "dots" | "gingham" | "confetti";
  accessoryColor: NootColor;
  headColor?: NootColor;
  eyeColor?: NootColor;
  shoeColor?: NootColor;
  trimColor?: NootColor;
  footwear?: "none" | (typeof NOOT_FOOTWEAR)[number];
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
      ["headphones", "cat-earphones", "daisy", "beanie", "bucket", "none", ...NOOT_FASHION_HATS],
      "headphones",
    ),
    clothing: pick("clothing", ["none", "scarf", "bow", "bandana", "shirt", ...NOOT_TAILORED], "none"),
    eyewear: pick("eyewear", ["none", "sunny", ...NOOT_FASHION_EYES], "none"),
    accessoryColor: parseNootColor(v.accessoryColor),
    ...(v.eyeColor !== undefined ? { eyeColor: parseNootColor(v.eyeColor) } : {}),
    ...(v.headColor !== undefined ? { headColor: parseNootColor(v.headColor) } : {}),
    ...(v.trimColor !== undefined ? { trimColor: parseNootColor(v.trimColor) } : {}),
    ...(v.shoeColor !== undefined ? { shoeColor: parseNootColor(v.shoeColor) } : {}),
    ...(v.footwear !== undefined ? { footwear: pick<NonNullable<NootAppearance["footwear"]>>("footwear", ["none", ...NOOT_FOOTWEAR] as const, "none") } : {}),
  };
}
