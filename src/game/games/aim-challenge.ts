import type { FriendCharacter } from "../../shared/types.js";
import { CONFIG, DIFFICULTIES } from "../config.js";
import {
  anchorRange,
  confine,
  contains,
  fittingScale,
  hitboxFor,
} from "../geometry.js";
import type {
  Bounds,
  GameContext,
  GameStartOptions,
  MiniGame,
  Point,
  RoundResult,
  RoundSnapshot,
  Target,
} from "../types.js";

export class AimChallenge implements MiniGame {
  readonly id = "aim-challenge";
  private context!: GameContext;
  private difficulty: GameStartOptions["difficulty"] = "normal";
  private elapsed = 0;
  private alive = false;
  private score = 0;
  private shots = 0;
  private hits = 0;
  private streak = 0;
  private bestStreak = 0;
  private hitTimes: number[] = [];
  private activatedAt = 0;
  private hitAt = -Infinity;
  private nextTurn = 0;
  private nextTaunt = 4000;
  private tauntUntil = 0;
  private velocity: Point = { x: 0, y: 0 };
  private cursor: Point | null = null;
  private startingAnger = 0;
  private completed: RoundResult | null = null;
  private target!: Target;
  private prey!: FriendCharacter;

  start(context: GameContext, options: GameStartOptions): void {
    this.context = context;
    this.difficulty = options.difficulty;
    this.elapsed =
      this.score =
      this.shots =
      this.hits =
      this.streak =
      this.bestStreak =
        0;
    this.hitTimes = [];
    this.completed = null;
    this.startingAnger = context.state.anger;
    this.hitAt = -Infinity;
    this.cursor = null;
    this.tauntUntil = 0;
    this.nextTaunt = 4000;
    this.alive = true;
    this.prey = context.character;
    this.target = {
      x: 0,
      y: 0,
      scale: fittingScale(
        DIFFICULTIES[this.difficulty].scale,
        context.bounds,
        context.layout,
      ),
      phase: "active",
      clip: "walk",
      clipTimeMs: 0,
      taunting: false,
    };
    this.spawn();
  }

  private roster(): FriendCharacter[] {
    return this.context.roster?.length
      ? this.context.roster
      : [this.context.character];
  }

  private pickPrey(): void {
    const friends = this.roster();
    const others = friends.filter((friend) => friend.id !== this.prey?.id);
    const pool = others.length > 0 ? others : friends;
    this.prey = pool[Math.floor(this.context.random() * pool.length)]!;
  }

  private direction(): void {
    const angle = this.context.random() * Math.PI * 2;
    this.velocity = { x: Math.cos(angle), y: Math.sin(angle) };
    this.nextTurn = this.elapsed + DIFFICULTIES[this.difficulty].turnMs;
  }

  setPointer(point: Point | null): void {
    if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y)))
      return;
    this.cursor = point ? { x: point.x, y: point.y } : null;
  }

  /** Steer away from the cursor. Returns a speed boost, or 1 when the cursor is far. */
  private flee(): number {
    if (!this.cursor) return 1;
    const dx = this.target.x - this.cursor.x;
    const dy = this.target.y - this.cursor.y;
    const dist = Math.hypot(dx, dy);
    const radius = DIFFICULTIES[this.difficulty].avoidRadius;
    if (dist >= radius) return 1;
    const urgency = 1 - dist / Math.max(radius, 1);
    let awayX = dist < 1 ? this.velocity.x || 1 : dx / dist;
    let awayY = dist < 1 ? this.velocity.y || 0 : dy / dist;
    const range = anchorRange(
      this.context.bounds,
      this.target.scale,
      this.context.layout,
    );
    const edge = 14;
    const blockedX =
      (this.target.x <= range.minX + edge && awayX < 0) ||
      (this.target.x >= range.maxX - edge && awayX > 0);
    const blockedY =
      (this.target.y <= range.minY + edge && awayY < 0) ||
      (this.target.y >= range.maxY - edge && awayY > 0);
    if (blockedX) awayX = 0;
    if (blockedY) awayY = 0;
    if (awayX === 0 && awayY === 0) {
      if (blockedX) awayY = this.cursor.y >= this.target.y ? -1 : 1;
      else awayX = this.cursor.x >= this.target.x ? -1 : 1;
    }
    const mag = Math.hypot(awayX, awayY) || 1;
    const blend = 0.55 + urgency * 0.45;
    this.velocity.x = this.velocity.x * (1 - blend) + (awayX / mag) * blend;
    this.velocity.y = this.velocity.y * (1 - blend) + (awayY / mag) * blend;
    const velocityMag = Math.hypot(this.velocity.x, this.velocity.y) || 1;
    this.velocity.x /= velocityMag;
    this.velocity.y /= velocityMag;
    this.nextTurn = this.elapsed + 320;
    return 1 + urgency * 0.9;
  }

  private spawn(): void {
    this.pickPrey();
    const range = anchorRange(
      this.context.bounds,
      this.target.scale,
      this.context.layout,
    );
    this.target.x =
      range.minX + this.context.random() * (range.maxX - range.minX);
    this.target.y =
      range.minY + this.context.random() * (range.maxY - range.minY);
    this.target.phase = "active";
    this.target.clip = "walk";
    this.target.clipTimeMs = 0;
    this.target.taunting = false;
    this.activatedAt = this.elapsed;
    this.direction();
  }

  update(elapsedMs: number): void {
    if (!this.alive) return;
    this.elapsed = Math.min(CONFIG.roundMs, this.elapsed + elapsedMs);
    if (this.elapsed >= CONFIG.roundMs) {
      this.completed = {
        gameId: this.id,
        characterId: this.context.character.id,
        difficulty: this.difficulty,
        durationMs: CONFIG.roundMs,
        score: this.score,
        shots: this.shots,
        hits: this.hits,
        misses: this.shots - this.hits,
        accuracy: this.shots ? this.hits / this.shots : null,
        averageHitMs: this.hits
          ? this.hitTimes.reduce((a, b) => a + b, 0) / this.hits
          : null,
        bestStreak: this.bestStreak,
        startingAnger: this.startingAnger,
        personality: { ...this.context.personality },
      };
      this.alive = false;
      return;
    }
    if (this.target.phase !== "active") {
      const sinceHit = this.elapsed - this.hitAt;
      if (sinceHit >= CONFIG.respawnMs) {
        if (this.target.phase !== "respawning") this.spawn();
        this.target.phase = "active";
        this.target.clip = "walk";
        this.target.clipTimeMs = 0;
        this.activatedAt = this.elapsed;
        this.context.emit({
          type: "respawn",
          characterId: this.prey.id,
        });
      } else if (sinceHit >= 500) {
        if (this.target.phase !== "respawning") this.spawn();
        this.target.phase = "respawning";
        this.target.clip = "respawn";
        this.target.clipTimeMs = sinceHit - 500;
      } else {
        this.target.phase = sinceHit < 250 ? "hit" : "hidden";
        this.target.clip = "hit";
        this.target.clipTimeMs = sinceHit;
      }
      return;
    }
    if (this.elapsed >= this.nextTaunt) {
      this.tauntUntil = this.elapsed + DIFFICULTIES[this.difficulty].tauntMs;
      this.nextTaunt =
        this.elapsed + 6500 - this.context.personality.competitive * 150;
      this.context.emit({
        type: "behavior",
        characterId: this.prey.id,
        behavior: "taunt",
      });
    }
    this.target.taunting = this.elapsed < this.tauntUntil;
    const clip = this.target.taunting ? "idle" : "walk";
    if (clip !== this.target.clip) this.target.clipTimeMs = 0;
    this.target.clip = clip;
    this.target.clipTimeMs += elapsedMs;
    if (this.target.taunting) return;
    const fleeBoost = this.flee();
    if (fleeBoost === 1 && this.elapsed >= this.nextTurn) this.direction();
    const angerMultiplier =
      this.context.state.anger >= 80
        ? 2
        : this.context.state.anger >= 50
          ? 1.4
          : 1;
    const distance =
      (DIFFICULTIES[this.difficulty].speed *
        angerMultiplier *
        fleeBoost *
        elapsedMs) /
      1000;
    this.target.x += this.velocity.x * distance;
    this.target.y += this.velocity.y * distance;
    const range = anchorRange(
      this.context.bounds,
      this.target.scale,
      this.context.layout,
    );
    if (this.target.x < range.minX || this.target.x > range.maxX)
      this.velocity.x *= -1;
    if (this.target.y < range.minY || this.target.y > range.maxY)
      this.velocity.y *= -1;
    confine(this.target, this.context.bounds, this.context.layout);
  }

  shoot(point: Point): boolean {
    if (!this.alive || !Number.isFinite(point.x) || !Number.isFinite(point.y))
      return false;
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x >= this.context.bounds.width ||
      point.y >= this.context.bounds.height
    )
      return false;
    this.shots++;
    if (
      this.target.phase !== "active" ||
      !contains(point, hitboxFor(this.target, this.context.layout))
    ) {
      this.streak = 0;
      this.context.emit({
        type: "miss",
        characterId: this.prey.id,
      });
      return false;
    }
    this.hits++;
    this.streak++;
    this.bestStreak = Math.max(this.streak, this.bestStreak);
    this.score +=
      CONFIG.pointsPerHit + (this.target.taunting ? CONFIG.tauntBonus : 0);
    this.hitTimes.push(Math.max(0, this.elapsed - this.activatedAt));
    this.hitAt = this.elapsed;
    this.target.phase = "hit";
    this.target.clip = "hit";
    this.target.clipTimeMs = 0;
    this.target.taunting = false;
    this.tauntUntil = 0;
    this.context.emit({ type: "hit", characterId: this.prey.id });
    return true;
  }

  resize(bounds: Bounds): void {
    this.context.bounds = bounds;
    this.target.scale = fittingScale(
      DIFFICULTIES[this.difficulty].scale,
      bounds,
      this.context.layout,
    );
    confine(this.target, bounds, this.context.layout);
  }
  snapshot(): RoundSnapshot {
    return {
      gameId: this.id,
      difficulty: this.difficulty,
      remainingMs: Math.max(0, CONFIG.roundMs - this.elapsed),
      score: this.score,
      shots: this.shots,
      hits: this.hits,
      streak: this.streak,
      bestStreak: this.bestStreak,
      target: { ...this.target },
      preyId: this.prey.id,
    };
  }
  result(): RoundResult | null {
    return this.completed
      ? { ...this.completed, personality: { ...this.completed.personality } }
      : null;
  }
  stop(): void {
    this.alive = false;
  }
}
