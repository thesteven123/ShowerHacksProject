export type Vibe = "chaotic" | "dramatic" | "supportive";

export type FriendCharacter = {
  id: string;
  name: string;
  imageUrl: string;
  vibe: Vibe;
  quotes: {
    idle: string[];
    hit: string[];
    respawn: string[];
  };
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
