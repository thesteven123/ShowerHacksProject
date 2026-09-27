import { CONFIG } from "../config.js";
import { DesktopWorld } from "../../simulation/world.js";
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

/** Timed hoop-scoring round. Reuses DesktopWorld ball/hoop physics with goals on. */
export class SoccerChallenge implements MiniGame {
  readonly id = "soccer";
  private context!: GameContext;
  private difficulty: GameStartOptions["difficulty"] = "normal";
  private elapsed = 0;
  private alive = false;
  private goals = 0;
  private kicks = 0;
  private scoredGoals = 0;
  private streak = 0;
  private bestStreak = 0;
  private startingAnger = 0;
  private completed: RoundResult | null = null;
  private world: DesktopWorld | null = null;
  private simTime = 0;
  private dummyTarget: Target = {
    x: 0,
    y: 0,
    scale: 1,
    phase: "hidden",
    clip: "idle",
    clipTimeMs: 0,
    taunting: false,
  };

  start(context: GameContext, options: GameStartOptions): void {
    this.context = context;
    this.difficulty = options.difficulty;
    this.elapsed = 0;
    this.goals = 0;
    this.kicks = 0;
    this.scoredGoals = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.completed = null;
    this.startingAnger = context.state.anger;
    this.alive = true;
    this.simTime = 0;

    // Competitive friends get a temporary bump so they hunt the hoop harder in-game.
    const competitive = Math.min(10, context.personality.competitive + (options.difficulty === "hard" ? 2 : options.difficulty === "normal" ? 1 : 0));
    const personality = {
      ...context.personality,
      competitive,
      chaos: Math.max(context.personality.chaos, options.difficulty === "hard" ? 6 : 3),
    };

    this.world = new DesktopWorld({
      friends: [context.character],
      bounds: { ...context.bounds },
      personalities: { [context.character.id]: personality },
      random: context.random,
      goalsEnabled: true,
    });
    this.world.subscribe((event) => {
      if (event.type === "goalScored") {
        this.goals = event.score;
        this.scoredGoals += 1;
        this.streak += 1;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        const bonus = 10 + Math.round(context.personality.competitive * 1.5);
        // goals already counts via world; expose points as goals * bonus factor in snapshot score
        this.context.emit({
          type: "behavior",
          characterId: this.context.character.id,
          behavior: "soccer-goal",
        });
        void bonus;
      }
      if (event.type === "ballKicked") {
        this.kicks += 1;
      }
    });
    this.world.addProp("ball", {
      x: context.bounds.width * 0.45,
      y: Math.min(140, context.bounds.height * 0.22),
    });
  }

  private points(): number {
    const perGoal = 10 + this.context.personality.competitive;
    return this.scoredGoals * perGoal + this.bestStreak * 2;
  }

  update(elapsedMs: number): void {
    if (!this.alive || !this.world) return;
    this.elapsed = Math.min(CONFIG.roundMs, this.elapsed + elapsedMs);
    this.simTime += elapsedMs;
    this.world.tick(this.simTime);
    const snap = this.world.snapshot();
    this.goals = snap.score;
    if (this.elapsed >= CONFIG.roundMs) {
      this.completed = {
        gameId: this.id,
        characterId: this.context.character.id,
        difficulty: this.difficulty,
        durationMs: CONFIG.roundMs,
        score: this.points(),
        shots: this.kicks,
        hits: this.scoredGoals,
        misses: Math.max(0, this.kicks - this.scoredGoals),
        accuracy: this.kicks ? this.scoredGoals / this.kicks : null,
        averageHitMs: null,
        bestStreak: this.bestStreak,
        startingAnger: this.startingAnger,
        personality: { ...this.context.personality },
      };
      this.alive = false;
    }
  }

  setPointer(_point: Point | null): void {
    /* Soccer uses drag hooks instead of flee-from-cursor. */
  }

  shoot(point: Point): boolean {
    if (!this.alive || !this.world || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    // Click empty space: nudge-drop a fresh ball if none, else soft kick toward click from nearest ball.
    const snap = this.world.snapshot();
    if (snap.props.length === 0) {
      return Boolean(this.world.addProp("ball", { x: point.x, y: Math.min(point.y, snap.bounds.height * 0.35) }));
    }
    const ball = snap.props[0];
    const actor = snap.actors[0];
    if (!ball || !actor) return false;
    // Tap near the friend to shove them toward the ball / hoop.
    if (Math.hypot(point.x - actor.position.x, point.y - actor.position.y) < 50) {
      this.world.startDrag(actor.id);
      this.world.dragTo(point);
      this.world.releaseDrag();
      return true;
    }
    return false;
  }

  arenaPointerDown(kind: "friend" | "ball", point: Point): boolean {
    if (!this.alive || !this.world) return false;
    const snap = this.world.snapshot();
    if (kind === "friend") {
      const ok = this.world.startDrag(snap.actors[0].id);
      if (ok) this.world.dragTo(point);
      return ok;
    }
    const ball = snap.props[0];
    if (!ball) return false;
    const ok = this.world.startBallDrag(ball.id);
    if (ok) this.world.dragBallTo(point);
    return ok;
  }

  arenaPointerMove(point: Point): void {
    if (!this.world) return;
    this.world.dragTo(point);
    this.world.dragBallTo(point);
  }

  arenaPointerUp(point: Point): void {
    if (!this.world) return;
    this.world.dragTo(point);
    this.world.dragBallTo(point);
    this.world.releaseDrag();
    this.world.releaseBallDrag();
  }

  resize(bounds: Bounds): void {
    this.world?.setBounds(bounds);
  }

  snapshot(): RoundSnapshot {
    const snap = this.world?.snapshot();
    const actor = snap?.actors[0];
    const ball = snap?.props[0];
    const hoop = snap?.hoop ?? { x: 0, y: 0, width: 52, height: 30 };
    return {
      gameId: this.id,
      difficulty: this.difficulty,
      remainingMs: Math.max(0, CONFIG.roundMs - this.elapsed),
      score: this.points(),
      shots: this.kicks,
      hits: this.scoredGoals,
      streak: this.streak,
      bestStreak: this.bestStreak,
      target: {
        ...this.dummyTarget,
        x: actor?.position.x ?? 0,
        y: actor?.position.y ?? 0,
      },
      soccer: {
        ball: ball
          ? { id: ball.id, x: ball.position.x, y: ball.position.y, spin: ball.spin }
          : null,
        hoop,
        friend: {
          id: actor?.id ?? this.context.character.id,
          x: actor?.position.x ?? 0,
          y: actor?.position.y ?? 0,
          activity: actor?.activity ?? "idle",
        },
        goals: this.goals,
      },
    };
  }

  result(): RoundResult | null {
    return this.completed;
  }

  stop(): void {
    this.alive = false;
    this.world = null;
  }
}
