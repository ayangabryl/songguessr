import type { NootAppearance } from "../../../shared/noot-profile.ts";
import type { Difficulty } from "../api";
import type { MascotPose } from "../mascot";

export type NootAction =
  | MascotPose
  | "groove" | "body-roll" | "charleston" | "hip-sway" | "victory-dance" | "friendly-wave"
  | "dance"
  | "happy-song"
  | "sad-song"
  | "walk"
  | "run"
  | "sleepy"
  | "listen-close"
  | "shrug"
  | "cheer"
  | "look-around" | "stretch" | "yawn" | "wave-small" | "high-five"
  | "boop" | "laugh" | "angry" | "startled" | "tumble" | "sit" | "get-up" | "catch" | "samba" | "outfit" | "jump";
export type NootHeadgear = "headphones" | "cat-earphones" | "daisy" | "beanie" | "bucket" | "none";
export type NootMood = "chill" | "happy" | "sad" | "dance";
export interface NootState extends Partial<NootAppearance> {
  pose: NootAction;
  difficulty: Difficulty;
  variant?: string;
  mood?: NootMood;
  theme?: "light" | "dark";
  viewYaw?: number;
  comparison?: boolean;
  eventId?: number;
  speed?: number;
  paused?: boolean;
  direction?: number;
  /** The game's ruler moves the entire canvas; the studio uses world-space travel. */
  onRuler?: boolean;
  /** Measured ruler translation, converted to model units per second. */
  travelSpeed?: number;
  /** Shared-space director supplies world motion and intent when true. */
  directed?: boolean;
  /** Shared elapsed dance time, in seconds, for beat-aligned group playback. */
  danceTime?: number;
  interactionHand?: "L" | "R";
  /** Attention target in the character's own face plane, normalized to -1..1. */
  lookAt?: { x: number; y: number };
}
export const HEADGEAR: {
  id: NootHeadgear;
  label: string;
  description: string;
}[] = [
  {
    id: "headphones",
    label: "Studio",
    description: "Soft charcoal headphones",
  },
  {
    id: "cat-earphones",
    label: "Kitten",
    description: "Peach headphones with little ears",
  },
  {
    id: "daisy",
    label: "Daisy",
    description: "A little flower, just for Noot",
  },
  { id: "beanie", label: "Beanie", description: "A soft ribbed knit cap" },
  { id: "bucket", label: "Bucket", description: "A curved canvas sun hat" },
  { id: "none", label: "Just Noot", description: "No accessories" },
];
