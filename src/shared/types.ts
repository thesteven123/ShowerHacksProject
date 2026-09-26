export type Vibe = "chaotic" | "dramatic" | "supportive";
export type CharacterVibe = Vibe;

export type CharacterQuotes = {
  idle: string[];
  hit: string[];
  respawn: string[];
};

export type SpriteAnimationClip = {
  startFrame: number;
  endFrame: number;
  fps: number;
  loop: boolean;
};

export type CharacterAnimations = {
  idle: SpriteAnimationClip;
  walk: SpriteAnimationClip;
  hit: SpriteAnimationClip;
  respawn: SpriteAnimationClip;
};

/** Person 2/3 sprite-sheet contract. Optional so older mocks still typecheck. */
export type CharacterSpriteSpec = {
  spriteSheetUrl: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  anchor: { x: number; y: number };
  hitbox: { x: number; y: number; width: number; height: number };
  animations: CharacterAnimations;
};

/** Photo limb crops for the overlay CSS figure (Person 2 pipeline slots). */
export type CharacterLimbs = {
  head?: string;
  torso?: string;
  armLeft?: string;
  armRight?: string;
  legLeft?: string;
  legRight?: string;
};

export type FriendCharacter = {
  id: string;
  name: string;
  imageUrl: string;
  vibe: Vibe;
  quotes: CharacterQuotes;
  sprite?: CharacterSpriteSpec;
  limbs?: CharacterLimbs;
};

export type GameEventType = "idle" | "hit" | "respawn";

export type GameEvent =
  | { type: "idle"; characterId: string }
  | { type: "hit"; characterId: string }
  | { type: "respawn"; characterId: string }
  | { type: "roundEnded"; score: number };

export type ReactionEffect =
  | "shake"
  | "flash"
  | "sparkle"
  | "wobble"
  | "pop"
  | "dramatic-zoom"
  | "hearts"
  | "skull";

export type ReactionSound =
  | "oof"
  | "bonk"
  | "gasp"
  | "cheer"
  | "pop"
  | "dramatic"
  | "giggle";

export type ReactionSource = "character" | "vibe-fallback" | "moss" | "local-search";

export type AnticId =
  | "moonwalk"
  | "desk-surf"
  | "icon-shuffle"
  | "steal-cursor"
  | "keyboard-smash"
  | "spin-out"
  | "monologue"
  | "faint"
  | "curtain-call"
  | "slow-clap"
  | "spotlight"
  | "tragic-fall"
  | "hype-dance"
  | "water-break"
  | "pep-talk"
  | "victory-wiggle"
  | "snack-run"
  | "air-hug"
  | "rage-kick"
  | "dramatic-point"
  | "thumbs-up"
  | "six-seven";

export type Antic = {
  id: AnticId;
  label: string;
  vibe: Vibe;
  event: GameEventType;
  effect: ReactionEffect;
  sound: ReactionSound;
};

export type Reaction = {
  characterId: string;
  name: string;
  vibe: Vibe;
  event: GameEventType | "roundEnded";
  line: string;
  antic: Antic;
  effect: ReactionEffect;
  sound: ReactionSound;
  source: ReactionSource;
};

export type RoundEndReaction = {
  headline: string;
  score: number;
  reactions: Reaction[];
};
