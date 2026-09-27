import type { FriendCharacter, GameEvent } from "../shared/types.js";
import {
  CONFIG,
  DEFAULT_SPRITE_LAYOUT,
  DIFFICULTIES,
  clamp,
  randomPersonality,
  unlocksForLevel,
  validatePersonality,
} from "./config.js";
import {
  anchorRange,
  confine,
  fittingScale,
  validateBounds,
} from "./geometry.js";
import { AimChallenge } from "./games/aim-challenge.js";
import { SoccerChallenge } from "./games/soccer-challenge.js";
import type {
  Bounds,
  GameSystemEvent,
  MiniGame,
  Personality,
  PetAction,
  PetState,
  Point,
  RoundResult,
  SavedPet,
  SpriteLayout,
  Target,
  Difficulty,
} from "./types.js";

type Options = {
  character: FriendCharacter;
  /** When set, aim-challenge can hunt any of these friends. */
  roster?: FriendCharacter[];
  personality?: Personality;
  bounds: Bounds;
  random?: () => number;
  now?: () => number;
  layout?: SpriteLayout;
  onGameEvent?: (event: GameEvent) => void;
};

/** No DOM, Electron, storage, timers, audio, or AI dependencies. */
export class GameSystem {
  private character: FriendCharacter;
  private readonly roster: FriendCharacter[];
  private personality: Personality;
  private state: PetState = {
    friendship: 35,
    anger: 5,
    xp: 0,
    level: 1,
    unlocks: ["pet"],
  };
  private bounds: Bounds;
  readonly layout: SpriteLayout;
  private readonly random: () => number;
  private readonly now: () => number;
  private lastTime: number;
  private simulationTime = 0;
  private interactive = false;
  private active: MiniGame | null = null;
  private lastResult: RoundResult | null = null;
  private factories = new Map<string, () => MiniGame>();
  private listeners = new Set<(event: GameSystemEvent) => void>();
  private legacy?: (event: GameEvent) => void;
  private pet: Target;
  private pointer: Point | null = null;
  private heading = 0;
  private nextBehavior = 3000;
  private behaviorUntil = 0;
  private nextPet = 0;
  private nextAction = 0;
  private destroyed = false;

  constructor(options: Options) {
    this.character = structuredClone(options.character);
    this.roster = structuredClone(
      options.roster?.length ? options.roster : [options.character],
    );
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => performance.now());
    this.lastTime = this.now();
    this.personality = validatePersonality(
      options.personality ?? randomPersonality(this.random),
    );
    this.bounds = validateBounds(options.bounds);
    this.layout = structuredClone(options.layout ?? DEFAULT_SPRITE_LAYOUT);
    this.legacy = options.onGameEvent;
    this.pet = {
      x: this.bounds.width / 2,
      y: this.bounds.height * 0.65,
      scale: fittingScale(1.25, this.bounds, this.layout),
      phase: "active",
      clip: "walk",
      clipTimeMs: 0,
      taunting: false,
    };
    confine(this.pet, this.bounds, this.layout);
    this.registerGame("aim-challenge", () => new AimChallenge());
    this.registerGame("soccer", () => new SoccerChallenge());
  }

  registerGame(id: string, factory: () => MiniGame): void {
    if (this.factories.has(id))
      throw new Error(`Game already registered: ${id}`);
    this.factories.set(id, factory);
  }
  subscribe(listener: (event: GameSystemEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(event: GameSystemEvent): void {
    if (event.type === "hit") {
      this.state.anger = clamp(this.state.anger + CONFIG.angerPerHit, 0, 100);
    }
    // Dispatch detached payloads; external reaction/UI code cannot mutate engine state.
    if (event.type === "hit" || event.type === "roundEnded")
      this.legacy?.(structuredClone(event));
    for (const listener of this.listeners) listener(structuredClone(event));
  }
  private changed(): void {
    this.emit({
      type: "stateChanged",
      characterId: this.character.id,
      state: structuredClone(this.state),
    });
  }
  private gainXP(amount: number): void {
    const oldUnlocks = this.state.unlocks;
    const oldLevel = this.state.level;
    this.state.xp += amount;
    this.state.level = 1 + Math.floor(this.state.xp / CONFIG.xpPerLevel);
    this.state.unlocks = unlocksForLevel(this.state.level);
    if (this.state.level > oldLevel) {
      this.emit({
        type: "levelUp",
        characterId: this.character.id,
        level: this.state.level,
        unlocked: this.state.unlocks.filter(
          (item) => !oldUnlocks.includes(item),
        ),
      });
    }
  }

  /** Call from requestAnimationFrame AND before input. Hidden-tab time still counts. */
  tick(): void {
    if (this.destroyed) return;
    const current = this.now();
    if (!Number.isFinite(current) || current < this.lastTime) return;
    const elapsed = current - this.lastTime;
    this.lastTime = current;
    this.simulationTime += elapsed;
    const oldAnger = this.state.anger;
    if (this.active) {
      this.active.setPointer?.(this.pointer);
      // Small substeps keep motion deterministic. Long suspension expires the round
      // immediately without replaying minutes of sounds, animations, or rewards.
      if (elapsed >= this.active.snapshot().remainingMs)
        this.active.update(elapsed);
      else {
        let remaining = elapsed;
        while (remaining > 0) {
          const step = Math.min(remaining, 32);
          this.active.update(step);
          remaining -= step;
        }
      }
      const result = this.active.result();
      if (result) {
        this.active.stop();
        this.active = null;
        this.lastResult = result;
        this.state.friendship = clamp(
          this.state.friendship + CONFIG.friendshipPerRound,
          0,
          100,
        );
        this.gainXP(CONFIG.xpPerRound + result.hits * CONFIG.xpPerHit);
        this.changed();
        this.emit({ type: "roundEnded", score: result.score });
        this.emit({
          type: "roundCompleted",
          characterId: this.character.id,
          result,
        });
      }
    } else {
      this.state.anger = Math.max(
        0,
        this.state.anger - (elapsed * CONFIG.angerDecayPerSecond) / 1000,
      );
      this.updateCompanion(Math.min(elapsed, 100));
    }
    if (Math.floor(oldAnger) !== Math.floor(this.state.anger)) this.changed();
  }

  private updateCompanion(elapsed: number): void {
    if (this.simulationTime >= this.nextBehavior) {
      const chaos = this.personality.chaos / 10;
      this.nextBehavior =
        this.simulationTime +
        (60_000 - chaos * 48_000) * (0.8 + this.random() * 0.4);
      const roll = this.random();
      let behavior = "idle";
      if (roll < this.personality.brainrot / 20) {
        behavior = this.state.unlocks.includes("say67")
          ? "say67"
          : this.state.unlocks.includes("bark")
            ? "bark"
            : "dance";
      } else if (roll < 0.5 + this.personality.friendliness / 20)
        behavior = "greet";
      this.emit({ type: "behavior", characterId: this.character.id, behavior });
      this.heading = this.random() * Math.PI * 2;
      this.behaviorUntil = this.simulationTime + 1500;
    }
    const previousClip = this.pet.clip;
    this.pet.clip = this.simulationTime < this.behaviorUntil ? "idle" : "walk";
    this.pet.clipTimeMs =
      previousClip === this.pet.clip ? this.pet.clipTimeMs + elapsed : 0;
    if (this.pet.clip === "idle") return;
    if (this.pointer && this.state.friendship >= CONFIG.followFriendship) {
      const dx = this.pointer.x - this.pet.x;
      const dy = this.pointer.y - this.pet.y;
      if (Math.hypot(dx, dy) < 65) return;
      this.heading = Math.atan2(dy, dx);
    }
    const speed = 18 + this.personality.chaos * 3;
    this.pet.x += (Math.cos(this.heading) * speed * elapsed) / 1000;
    this.pet.y += (Math.sin(this.heading) * speed * elapsed) / 1000;
    const range = anchorRange(this.bounds, this.pet.scale, this.layout);
    if (this.pet.x < range.minX || this.pet.x > range.maxX)
      this.heading = Math.PI - this.heading;
    if (this.pet.y < range.minY || this.pet.y > range.maxY)
      this.heading = -this.heading;
    confine(this.pet, this.bounds, this.layout);
  }

  setInteractive(enabled: boolean): void {
    this.tick();
    this.interactive = enabled;
    if (!enabled) {
      this.abortRound("mode-disabled");
      this.pointer = null;
    }
  }
  setPointer(point: Point | null): void {
    if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y)))
      return;
    this.pointer = point ? { ...point } : null;
  }
  setBounds(bounds: Bounds): void {
    this.bounds = validateBounds(bounds);
    this.pet.scale = fittingScale(1.25, this.bounds, this.layout);
    confine(this.pet, this.bounds, this.layout);
    this.active?.resize(this.bounds);
  }
  setPersonality(personality: Personality): boolean {
    if (this.active || this.destroyed) return false;
    this.personality = validatePersonality(personality);
    this.changed();
    return true;
  }
  /** Swap the focused companion. Caller should export/import pet saves around this. */
  selectFriend(friendId: string): boolean {
    if (this.destroyed || this.active) return false;
    const next = this.roster.find((friend) => friend.id === friendId);
    if (!next) return false;
    if (next.id === this.character.id) return true;
    this.character = structuredClone(next);
    this.personality = randomPersonality(this.random);
    this.state = {
      friendship: 35,
      anger: 5,
      xp: 0,
      level: 1,
      unlocks: ["pet"],
    };
    this.lastResult = null;
    this.behaviorUntil = 0;
    this.nextBehavior = this.simulationTime + 3000;
    this.nextPet = 0;
    this.nextAction = 0;
    this.pet = {
      x: this.bounds.width / 2,
      y: this.bounds.height * 0.65,
      scale: fittingScale(1.25, this.bounds, this.layout),
      phase: "active",
      clip: "walk",
      clipTimeMs: 0,
      taunting: false,
    };
    confine(this.pet, this.bounds, this.layout);
    this.changed();
    return true;
  }
  startRound(
    gameId = "aim-challenge",
    difficulty: Difficulty = "normal",
  ): boolean {
    this.tick();
    if (this.destroyed || !this.interactive || this.active) return false;
    if (!DIFFICULTIES[difficulty]) throw new Error("Unknown difficulty");
    const factory = this.factories.get(gameId);
    if (!factory) throw new Error(`Unknown game: ${gameId}`);
    const game = factory();
    if (game.id !== gameId)
      throw new Error("Game factory ID does not match registration");
    game.start(
      {
        character: structuredClone(this.character),
        roster: structuredClone(this.roster),
        personality: { ...this.personality },
        state: this.state,
        bounds: { ...this.bounds },
        layout: this.layout,
        random: this.random,
        emit: (event) => this.emit(event),
      },
      { difficulty },
    );
    this.active = game;
    this.lastResult = null;
    return true;
  }
  abortRound(reason = "user-stopped"): void {
    if (!this.active) return;
    this.active.stop();
    this.active = null;
    this.lastResult = null;
    this.emit({ type: "roundAborted", characterId: this.character.id, reason });
  }
  shoot(point: Point): boolean {
    this.tick();
    if (!this.interactive || this.destroyed || !this.active) return false;
    const hit = this.active.shoot(point);
    if (hit) this.changed();
    return hit;
  }
  arenaPointerDown(kind: "friend" | "ball", point: Point): boolean {
    if (!this.interactive || this.destroyed || !this.active?.arenaPointerDown) return false;
    return this.active.arenaPointerDown(kind, point);
  }
  arenaPointerMove(point: Point): void {
    if (!this.active?.arenaPointerMove) return;
    this.active.arenaPointerMove(point);
  }
  arenaPointerUp(point: Point): void {
    if (!this.active?.arenaPointerUp) return;
    this.active.arenaPointerUp(point);
  }
  perform(action: PetAction): { accepted: boolean; reason?: string } {
    this.tick();
    if (!this.interactive || this.destroyed || this.active)
      return {
        accepted: false,
        reason: "Return to interactive companion mode first.",
      };
    if (!this.state.unlocks.includes(action))
      return { accepted: false, reason: "This behavior is not unlocked yet." };
    const readyAt = action === "pet" ? this.nextPet : this.nextAction;
    if (this.simulationTime < readyAt)
      return { accepted: false, reason: "Give your friend a moment." };
    if (action === "pet") {
      this.nextPet = this.simulationTime + CONFIG.petCooldownMs;
      this.state.friendship = clamp(
        this.state.friendship + CONFIG.friendshipPerPet,
        0,
        100,
      );
      this.state.anger = Math.max(0, this.state.anger - 5);
      this.gainXP(CONFIG.xpPerPet);
      this.changed();
    } else this.nextAction = this.simulationTime + CONFIG.actionCooldownMs;
    this.behaviorUntil = this.simulationTime + 1500;
    this.emit({
      type: "behavior",
      characterId: this.character.id,
      behavior: action,
    });
    return { accepted: true };
  }
  dismissResult(): void {
    this.lastResult = null;
  }
  snapshot() {
    return structuredClone({
      character: this.character,
      personality: this.personality,
      state: this.state,
      interactive: this.interactive,
      round: this.active?.snapshot() ?? null,
      result: this.lastResult,
      companion: this.pet,
      games: [...this.factories.keys()],
    });
  }
  exportSave(): SavedPet {
    return {
      version: 1,
      characterId: this.character.id,
      personality: { ...this.personality },
      friendship: this.state.friendship,
      anger: this.state.anger,
      xp: this.state.xp,
    };
  }
  importSave(input: unknown): boolean {
    if (this.active || !input || typeof input !== "object") return false;
    const saved = input as SavedPet;
    if (saved.version !== 1 || saved.characterId !== this.character.id)
      return false;
    if (![saved.friendship, saved.anger, saved.xp].every(Number.isFinite))
      return false;
    if (
      saved.friendship < 0 ||
      saved.friendship > 100 ||
      saved.anger < 0 ||
      saved.anger > 100 ||
      !Number.isInteger(saved.xp) ||
      saved.xp < 0 ||
      saved.xp > 1_000_000
    )
      return false;
    let personality: Personality;
    try {
      personality = validatePersonality(saved.personality);
    } catch {
      return false;
    }
    this.personality = personality;
    this.state = {
      friendship: saved.friendship,
      anger: saved.anger,
      xp: saved.xp,
      level: 1 + Math.floor(saved.xp / CONFIG.xpPerLevel),
      unlocks: unlocksForLevel(1 + Math.floor(saved.xp / CONFIG.xpPerLevel)),
    };
    this.changed();
    return true;
  }
  destroy(): void {
    this.abortRound("destroyed");
    this.destroyed = true;
    this.listeners.clear();
  }
}
