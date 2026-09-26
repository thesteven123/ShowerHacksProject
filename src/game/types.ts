import type { FriendCharacter, GameEvent } from "../shared/types.js";

export type Personality = {
  chaos: number;
  brainrot: number;
  competitive: number;
  friendliness: number;
};
export type PetState = {
  friendship: number;
  anger: number;
  xp: number;
  level: number;
  unlocks: string[];
};
export type Point = { x: number; y: number };
export type Bounds = { width: number; height: number };
export type Difficulty = "easy" | "normal" | "hard";
export type Clip = "idle" | "walk" | "hit" | "respawn";
// An adapter for Person 2's supplied v0.1 geometry, not a replacement shared type.
export type SpriteLayout = {
  frameWidth: number;
  frameHeight: number;
  anchor: Point;
  hitbox: { x: number; y: number; width: number; height: number };
  clips: Record<Clip, { frames: number[]; fps: number; loop: boolean }>;
};
export type Target = Point & {
  scale: number;
  phase: "active" | "hit" | "hidden" | "respawning";
  clip: Clip;
  clipTimeMs: number;
  taunting: boolean;
};
export type RoundResult = {
  gameId: string;
  characterId: string;
  difficulty: Difficulty;
  durationMs: number;
  score: number;
  shots: number;
  hits: number;
  misses: number;
  accuracy: number | null;
  averageHitMs: number | null;
  bestStreak: number;
  startingAnger: number;
  personality: Personality;
};
export type RoundSnapshot = {
  gameId: string;
  difficulty: Difficulty;
  remainingMs: number;
  score: number;
  shots: number;
  hits: number;
  streak: number;
  bestStreak: number;
  target: Target;
};
export type GameSystemEvent =
  | GameEvent
  | { type: "miss"; characterId: string }
  | { type: "respawn"; characterId: string }
  | { type: "behavior"; characterId: string; behavior: string }
  | { type: "stateChanged"; characterId: string; state: PetState }
  | { type: "levelUp"; characterId: string; level: number; unlocked: string[] }
  | { type: "roundCompleted"; characterId: string; result: RoundResult }
  | { type: "roundAborted"; characterId: string; reason: string };
export type PetAction = "pet" | "bark" | "say67";
export type GameContext = {
  character: FriendCharacter;
  personality: Personality;
  state: PetState;
  bounds: Bounds;
  layout: SpriteLayout;
  random: () => number;
  emit: (event: GameSystemEvent) => void;
};
export type GameStartOptions = { difficulty: Difficulty };
/** A game owns its round; the system owns character state, time, and rewards. */
export interface MiniGame {
  readonly id: string;
  start(context: GameContext, options: GameStartOptions): void;
  update(elapsedMs: number): void;
  shoot(point: Point): boolean;
  resize(bounds: Bounds): void;
  snapshot(): RoundSnapshot;
  result(): RoundResult | null;
  stop(): void;
}
export type SavedPet = {
  version: 1;
  characterId: string;
  personality: Personality;
  friendship: number;
  anger: number;
  xp: number;
};
