/** Personality tag from hackathon spec; Person 4 may use for reaction tone. */
export type CharacterVibe = "chaotic" | "dramatic" | "supportive";

export type CharacterQuotes = {
  idle: string[];
  hit: string[];
  respawn: string[];
};

/** One animation clip on a horizontal sprite sheet (left-to-right frames). */
export type SpriteAnimationClip = {
  /** Inclusive frame index on the sheet. */
  startFrame: number;
  endFrame: number;
  /** Frames per second when this clip loops (or plays once if `loop` is false). */
  fps: number;
  loop: boolean;
};

export type CharacterAnimations = {
  idle: SpriteAnimationClip;
  walk: SpriteAnimationClip;
  hit: SpriteAnimationClip;
  respawn: SpriteAnimationClip;
};

/**
 * Rendering contract for Person 3 (game). Origin for position (x, y) is the
 * sprite anchor — bottom-center of the character, in frame pixels.
 */
export type CharacterSpriteSpec = {
  /** URL or app-relative path to a horizontal sprite sheet (PNG, transparency OK). */
  spriteSheetUrl: string;
  frameWidth: number;
  frameHeight: number;
  /** Total frames on the sheet (left to right). */
  frameCount: number;
  /** Anchor within each frame: offset from top-left to feet center. */
  anchor: { x: number; y: number };
  /** Axis-aligned hitbox in frame-local pixels (for click detection). */
  hitbox: { x: number; y: number; width: number; height: number };
  animations: CharacterAnimations;
};

/** Shared handoff shape — Person 2 out, Person 3/4/5 consume. */
export type FriendCharacter = {
  id: string;
  name: string;
  /** Portrait / roster thumbnail (face crop). */
  imageUrl: string;
  vibe: CharacterVibe;
  quotes: CharacterQuotes;
  sprite: CharacterSpriteSpec;
};
