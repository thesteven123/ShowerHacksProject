import type { Difficulty, Personality, SpriteLayout } from "./types.js";

export const PERSONALITY_KEYS = [
  "chaos",
  "brainrot",
  "competitive",
  "friendliness",
] as const;
export const CONFIG = {
  roundMs: 30_000,
  respawnMs: 800,
  pointsPerHit: 10,
  tauntBonus: 5,
  angerPerHit: 15,
  angerDecayPerSecond: 1,
  friendshipPerPet: 5,
  friendshipPerRound: 5,
  petCooldownMs: 2_000,
  actionCooldownMs: 4_000,
  xpPerPet: 2,
  xpPerRound: 20,
  xpPerHit: 2,
  xpPerLevel: 50,
  followFriendship: 50,
} as const;
export const DIFFICULTIES: Record<
  Difficulty,
  {
    scale: number;
    speed: number;
    turnMs: number;
    tauntMs: number;
    /** How close the cursor has to get before they bolt. */
    avoidRadius: number;
  }
> = {
  easy: { scale: 1.4, speed: 90, turnMs: 2200, tauntMs: 1200, avoidRadius: 160 },
  normal: { scale: 1.1, speed: 150, turnMs: 1400, tauntMs: 850, avoidRadius: 230 },
  hard: { scale: 0.8, speed: 220, turnMs: 850, tauntMs: 550, avoidRadius: 310 },
};
export const DEFAULT_SPRITE_LAYOUT: SpriteLayout = {
  frameWidth: 72,
  frameHeight: 108,
  anchor: { x: 36, y: 107 },
  hitbox: { x: 4, y: 4, width: 64, height: 99 },
  clips: {
    idle: { frames: [0, 1, 2, 3], fps: 6, loop: true },
    walk: { frames: [4, 5, 6, 7], fps: 8, loop: true },
    hit: { frames: [8, 9, 10], fps: 12, loop: false },
    respawn: { frames: [11, 12, 13], fps: 10, loop: false },
  },
};
export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));
export function validatePersonality(input: Personality): Personality {
  const result = { ...input };
  for (const key of PERSONALITY_KEYS) {
    const value = input[key];
    if (!Number.isInteger(value) || value < 0 || value > 10)
      throw new Error(`${key} must be an integer from 0 to 10`);
    result[key] = value;
  }
  return result;
}
export function randomPersonality(
  random: () => number = Math.random,
): Personality {
  return Object.fromEntries(
    PERSONALITY_KEYS.map((key) => [
      key,
      Math.floor(clamp(random(), 0, 0.999999) * 11),
    ]),
  ) as Personality;
}
export function unlocksForLevel(level: number): string[] {
  return [
    "pet",
    ...(level >= 2 ? ["bark"] : []),
    ...(level >= 3 ? ["say67"] : []),
  ];
}
