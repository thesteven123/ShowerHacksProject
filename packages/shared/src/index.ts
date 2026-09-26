export type {
  CharacterAnimations,
  CharacterQuotes,
  CharacterSpriteSpec,
  CharacterVibe,
  FriendCharacter,
  SpriteAnimationClip,
} from "./types.js";

import type { CharacterSpriteSpec } from "./types.js";

/** Default sprite layout agreed for Tiny Menaces v0 (see docs/sprite-handoff-person3.md). */
export const DEFAULT_SPRITE_LAYOUT: Omit<CharacterSpriteSpec, "spriteSheetUrl"> & {
  frameCount: number;
} = {
  /** Fits 72×72 head; body stack ~107px tall with neck/hip overlap (see handoff doc). */
  frameWidth: 72,
  frameHeight: 108,
  frameCount: 14,
  anchor: { x: 36, y: 107 },
  hitbox: { x: 4, y: 4, width: 64, height: 99 },
  animations: {
    idle: { startFrame: 0, endFrame: 3, fps: 6, loop: true },
    walk: { startFrame: 4, endFrame: 7, fps: 8, loop: true },
    hit: { startFrame: 8, endFrame: 10, fps: 12, loop: false },
    respawn: { startFrame: 11, endFrame: 13, fps: 10, loop: false },
  },
};
