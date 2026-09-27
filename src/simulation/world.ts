import type { FriendCharacter } from "../shared/types.js";
import type { Bounds, Personality, Point } from "../game/types.js";
import { clamp, validatePersonality } from "../game/config.js";
import { SceneDirector, offlineScene } from "./director.js";
import type { Actor, Activity, Prop, Relationship, SceneInput, SceneOutput, WorldEvent, WorldSave, WorldSnapshot } from "./types.js";

const STEP_MS = 100;
const MAX_PROPS = 12;
const ENTER_DISTANCE = 105;
const LEAVE_DISTANCE = 155;
const ENCOUNTER_COOLDOWN = 60_000;
const SCENE_COOLDOWN = 12_000;
const BODY_MARGIN = 42;
const ACTOR_RADIUS = 34;
const BALL_RADIUS = 12;
const GRAVITY = 920;
const FLOOR_FRICTION = 0.86;
const WALL_BOUNCE = 0.62;
const FLOOR_BOUNCE = 0.55;
const KICK_SPEED = 280;
const SETTLE_SPEED = 55;
const KICK_COOLDOWN_MS = 480;
const BUMP_EVENT_COOLDOWN_MS = 900;
const THROW_MIN_SPEED = 55;
const HOOP_WIDTH = 52;
const HOOP_HEIGHT = 30;
const GOAL_COOLDOWN_MS = 900;

type WorldOptions = {
  friends: FriendCharacter[];
  bounds: Bounds;
  personalities?: Record<string, Personality>;
  random?: () => number;
  director?: SceneDirector;
  /** When true, hoop scoring and competitive aim-at-hoop behavior are active. */
  goalsEnabled?: boolean;
};

function defaultPersonality(friend: FriendCharacter): Personality {
  if (friend.vibe === "chaotic") return { chaos: 8, brainrot: 8, competitive: 7, friendliness: 5 };
  if (friend.vibe === "dramatic") return { chaos: 4, brainrot: 5, competitive: 8, friendliness: 6 };
  return { chaos: 2, brainrot: 3, competitive: 4, friendliness: 9 };
}
function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
function pairKey(a: string, b: string): string { return [a, b].sort().join("::"); }
function validBounds(bounds: Bounds): Bounds {
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) throw new Error("Invalid world bounds");
  return { ...bounds };
}

/** Fixed-step, local-only simulation. Never reads files, screenshots, or other apps. */
export class DesktopWorld {
  private actors: Actor[];
  private props: Prop[] = [];
  private relationships = new Map<string, Relationship>();
  private bounds: Bounds;
  private random: () => number;
  private director: SceneDirector;
  private listeners = new Set<(event: WorldEvent) => void>();
  private elapsedMs = 0;
  private lastTickMs: number | null = null;
  private remainderMs = 0;
  private decisionAt = new Map<string, number>();
  private activityEndsAt = new Map<string, number>();
  private headings = new Map<string, number>();
  private insidePairs = new Set<string>();
  private nextSceneId = 1;
  private nextPropId = 1;
  private scene: WorldSnapshot["scene"] = null;
  private sceneParticipants: string[] = [];
  private sceneEndsAt = 0;
  private lastSceneAt = -Infinity;
  private dragging: string | null = null;
  private draggingBall: string | null = null;
  private dragSample: { x: number; y: number; at: number } | null = null;
  private dragVelocity: Point = { x: 0, y: 0 };
  private actorMotion = new Map<string, Point>();
  private kickReadyAt = new Map<string, number>();
  private bumpReadyAt = new Map<string, number>();
  private lastToucher = new Map<string, string>();
  private ballInHoop = new Set<string>();
  private goalReadyAt = new Map<string, number>();
  private score = 0;
  private goalsEnabled: boolean;
  private paused = false;

  constructor(options: WorldOptions) {
    if (options.friends.length < 1) throw new Error("At least one friend is required");
    if (new Set(options.friends.map(friend => friend.id)).size !== options.friends.length) throw new Error("Friend IDs must be unique");
    this.bounds = validBounds(options.bounds);
    this.random = options.random ?? Math.random;
    this.director = options.director ?? new SceneDirector();
    this.goalsEnabled = Boolean(options.goalsEnabled);
    this.actors = options.friends.map((friend, index) => ({
      id: friend.id, name: friend.name, vibe: friend.vibe,
      personality: validatePersonality(options.personalities?.[friend.id] ?? defaultPersonality(friend)),
      needs: { energy: 75, boredom: 45, hygiene: 80, social: 55 },
      mood: { joy: 55, irritation: 5 },
      activity: "idle", activityVersion: 0, reservations: [],
      position: this.confined({ x: this.bounds.width * (index + 1) / (options.friends.length + 1), y: this.bounds.height * (0.55 + (index % 2) * 0.15) }),
    }));
    for (const actor of this.actors) {
      this.decisionAt.set(actor.id, 1200 + this.random() * 1800);
      this.headings.set(actor.id, this.random() * Math.PI * 2);
    }
    for (const from of this.actors) for (const to of this.actors) if (from.id !== to.id) {
      this.relationships.set(`${from.id}->${to.id}`, { fromId: from.id, toId: to.id, affinity: 50, familiarity: 0, lastEncounterAt: -Infinity });
    }
  }

  subscribe(listener: (event: WorldEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(event: WorldEvent): void { for (const listener of this.listeners) listener(structuredClone(event)); }
  private confined(point: Point): Point {
    const minX = Math.min(BODY_MARGIN, this.bounds.width / 2), maxX = Math.max(minX, this.bounds.width - BODY_MARGIN);
    const minY = Math.min(108, this.bounds.height / 2), maxY = Math.max(minY, this.bounds.height - 4);
    return { x: clamp(point.x, minX, maxX), y: clamp(point.y, minY, maxY) };
  }
  private ballBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const minX = BALL_RADIUS + 4;
    const maxX = Math.max(minX, this.bounds.width - BALL_RADIUS - 4);
    const minY = BALL_RADIUS + 8;
    const maxY = Math.max(minY, this.bounds.height - BALL_RADIUS - 6);
    return { minX, maxX, minY, maxY };
  }
  private hoopRect(): { x: number; y: number; width: number; height: number } {
    const width = Math.min(HOOP_WIDTH, Math.max(36, this.bounds.width * 0.08));
    const height = Math.min(HOOP_HEIGHT, Math.max(22, this.bounds.height * 0.05));
    return {
      x: Math.max(8, this.bounds.width - width - 18),
      y: Math.max(18, Math.min(96, this.bounds.height * 0.12)),
      width,
      height,
    };
  }
  private hoopCenter(): Point {
    const hoop = this.hoopRect();
    return { x: hoop.x + hoop.width / 2, y: hoop.y + hoop.height / 2 };
  }
  private confineBall(point: Point): Point {
    const box = this.ballBounds();
    return { x: clamp(point.x, box.minX, box.maxX), y: clamp(point.y, box.minY, box.maxY) };
  }
  setBounds(bounds: Bounds): void {
    const next = validBounds(bounds), previous = this.bounds;
    this.bounds = next;
    for (const actor of this.actors) actor.position = this.confined({ x: actor.position.x / previous.width * next.width, y: actor.position.y / previous.height * next.height });
    for (const prop of this.props) prop.position = this.confineBall({ x: prop.position.x / previous.width * next.width, y: prop.position.y / previous.height * next.height });
  }
  setGoalsEnabled(enabled: boolean): void {
    this.goalsEnabled = enabled;
    if (!enabled) {
      this.score = 0;
      this.ballInHoop.clear();
      this.goalReadyAt.clear();
    }
  }
  goalsAreEnabled(): boolean {
    return this.goalsEnabled;
  }
  setPaused(paused: boolean): void {
    this.paused = paused; this.lastTickMs = null; this.remainderMs = 0;
    if (paused) this.finishScene();
  }
  setPersonality(actorId: string, personality: Personality): boolean {
    const actor = this.actors.find(item => item.id === actorId);
    if (!actor) return false;
    const previous = actor.personality;
    const next = validatePersonality(personality);
    actor.personality = next;
    if (this.brainrotOutbreak()) {
      this.parkForSixSeven();
      return true;
    }
    if (previous.brainrot >= 10) {
      this.decisionAt.set(actor.id, this.elapsedMs);
      this.activityEndsAt.set(actor.id, this.elapsedMs);
    }
    if (actor.activity === "dragged" || actor.activity === "talk") return true;
    if (next.competitive > previous.competitive) {
      const ball = this.props.find(prop => prop.type === "ball" && !this.actors.some(other => other.id !== actor.id && other.reservations.includes(prop.id)));
      if (ball) {
        if (actor.activity !== "play") {
          actor.activity = "play";
          actor.activityVersion++;
        }
        actor.reservations = [ball.id];
        this.activityEndsAt.set(actor.id, this.elapsedMs + 4500);
        this.decisionAt.set(actor.id, this.elapsedMs + 4500);
        return true;
      }
    }
    if (next.chaos > previous.chaos || next.friendliness > previous.friendliness) {
      if (actor.activity !== "walk") {
        actor.activity = "walk";
        actor.activityVersion++;
        actor.reservations = [];
      }
      if (next.friendliness >= 10) this.headings.set(actor.id, this.headingToward(actor));
      else if (next.chaos > previous.chaos) this.headings.set(actor.id, this.random() * Math.PI * 2);
      this.activityEndsAt.set(actor.id, this.elapsedMs + 2800);
      this.decisionAt.set(actor.id, this.elapsedMs + 2800);
    }
    return true;
  }
  tick(nowMs: number): void {
    if (!Number.isFinite(nowMs)) return;
    if (this.lastTickMs === null) { this.lastTickMs = nowMs; return; }
    const delta = clamp(nowMs - this.lastTickMs, 0, 500);
    this.lastTickMs = nowMs;
    if (this.paused) return;
    this.remainderMs += delta;
    while (this.remainderMs >= STEP_MS) { this.step(STEP_MS); this.remainderMs -= STEP_MS; }
  }
  private step(delta: number): void {
    this.elapsedMs += delta;
    if (this.scene && this.elapsedMs >= this.sceneEndsAt) this.finishScene();
    const outbreak = this.brainrotOutbreak();
    if (outbreak && this.scene) this.finishScene();
    for (const actor of this.actors) {
      actor.needs.energy = clamp(actor.needs.energy + (actor.activity === "rest" ? 0.8 : -0.09), 0, 100);
      actor.needs.boredom = clamp(actor.needs.boredom + (actor.activity === "read" || actor.activity === "play" ? -0.6 : 0.14), 0, 100);
      actor.needs.social = clamp(actor.needs.social + (actor.activity === "talk" ? -0.5 : 0.08), 0, 100);
      actor.needs.hygiene = clamp(actor.needs.hygiene - 0.012, 0, 100);
      actor.mood.irritation = clamp(actor.mood.irritation - 0.02, 0, 100);
      actor.mood.joy = clamp(actor.mood.joy + (actor.activity === "play" ? 0.08 : actor.needs.boredom > 80 ? -0.03 : 0), 0, 100);
      if (outbreak) {
        if (actor.activity !== "dragged" && actor.activity !== "idle") {
          actor.activity = "idle";
          actor.activityVersion++;
          actor.reservations = [];
        }
        continue;
      }
      if (actor.activity === "walk") this.moveActor(actor, delta);
      if (actor.activity === "play") this.playWithBall(actor, delta);
      if (actor.activity !== "dragged" && actor.activity !== "talk" && this.elapsedMs >= (this.decisionAt.get(actor.id) ?? 0) && this.elapsedMs >= (this.activityEndsAt.get(actor.id) ?? 0)) this.chooseActivity(actor);
      this.holdExtremes(actor);
    }
    if (!outbreak) this.resolveActorCollisions();
    this.stepBalls(delta);
    if (!outbreak) this.resolveActorBallCollisions();
    if (!outbreak) this.checkEncounters();
  }
  private brainrotOutbreak(): boolean {
    return this.actors.some(actor => actor.personality.brainrot >= 10);
  }
  private nearestActor(actor: Actor): Actor | null {
    let nearest: Actor | null = null;
    let best = Infinity;
    for (const other of this.actors) {
      if (other.id === actor.id) continue;
      const gap = distance(actor.position, other.position);
      if (gap < best) {
        best = gap;
        nearest = other;
      }
    }
    return nearest;
  }
  private headingToward(actor: Actor): number {
    const nearest = this.nearestActor(actor);
    if (!nearest) return this.headings.get(actor.id) ?? 0;
    return Math.atan2(nearest.position.y - actor.position.y, nearest.position.x - actor.position.x);
  }
  private headingAway(actor: Actor): number {
    const nearest = this.nearestActor(actor);
    const current = this.headings.get(actor.id) ?? 0;
    if (!nearest || distance(actor.position, nearest.position) > 220) return current;
    return Math.atan2(actor.position.y - nearest.position.y, actor.position.x - nearest.position.x);
  }
  private extremeActivity(actor: Actor): Activity | null {
    if (actor.personality.competitive >= 10 && this.props.some(prop => prop.type === "ball")) return "play";
    if (actor.personality.friendliness >= 10 || actor.personality.friendliness <= 0 || actor.personality.chaos >= 10) return "walk";
    return null;
  }
  private holdExtremes(actor: Actor): void {
    if (actor.activity === "dragged" || actor.activity === "talk") return;
    const forced = this.extremeActivity(actor);
    if (!forced) return;
    if (forced === "walk") {
      if (actor.personality.friendliness >= 10) this.headings.set(actor.id, this.headingToward(actor));
      else if (actor.personality.friendliness <= 0) this.headings.set(actor.id, this.headingAway(actor));
    }
    if (actor.activity === forced) {
      if (forced === "play") {
        const ball = this.props.find(prop => prop.type === "ball");
        if (ball) actor.reservations = [ball.id];
      }
      return;
    }
    actor.activity = forced;
    actor.activityVersion++;
    if (forced === "play") {
      const ball = this.props.find(prop => prop.type === "ball");
      actor.reservations = ball ? [ball.id] : [];
    } else actor.reservations = [];
    this.activityEndsAt.set(actor.id, this.elapsedMs + 2800);
    this.decisionAt.set(actor.id, this.elapsedMs + 2800);
  }
  private parkForSixSeven(): void {
    if (this.scene) this.finishScene();
    for (const actor of this.actors) {
      if (actor.activity === "dragged") continue;
      if (actor.activity !== "idle") {
        actor.activity = "idle";
        actor.activityVersion++;
        actor.reservations = [];
      }
    }
  }
  private steer(actor: Actor, heading: number): void {
    const probe = 36;
    const next = { x: actor.position.x + Math.cos(heading) * probe, y: actor.position.y + Math.sin(heading) * probe };
    const confined = this.confined(next);
    this.headings.set(actor.id, confined.x === next.x && confined.y === next.y ? heading : heading + Math.PI / 2);
  }
  private moveActor(actor: Actor, delta: number): void {
    const chaosMax = actor.personality.chaos >= 10;
    if (actor.personality.friendliness >= 10) this.steer(actor, this.headingToward(actor));
    else if (actor.personality.friendliness <= 0) this.steer(actor, this.headingAway(actor));
    else if (chaosMax && this.random() < 0.4) this.headings.set(actor.id, this.random() * Math.PI * 2);
    const heading = this.headings.get(actor.id) ?? 0;
    const speed = chaosMax ? 110 : 22 + actor.personality.chaos * 3;
    const prev = actor.position;
    const next = { x: actor.position.x + Math.cos(heading) * speed * delta / 1000, y: actor.position.y + Math.sin(heading) * speed * delta / 1000 };
    const confined = this.confined(next);
    if (confined.x !== next.x || confined.y !== next.y) this.headings.set(actor.id, heading + Math.PI * (chaosMax ? 0.65 + this.random() * 0.5 : 0.7));
    actor.position = confined;
    const dt = delta / 1000;
    this.actorMotion.set(actor.id, { x: (confined.x - prev.x) / dt, y: (confined.y - prev.y) / dt });
  }
  private playWithBall(actor: Actor, delta: number): void {
    const ball = this.props.find(prop => prop.id === actor.reservations[0]) ?? this.props.find(prop => prop.type === "ball");
    if (!ball) {
      actor.activity = "idle";
      actor.activityVersion++;
      return;
    }
    if (ball.id === this.draggingBall) return;
    if (!actor.reservations.includes(ball.id)) actor.reservations = [ball.id];
    const gap = distance(actor.position, ball.position);
    if (gap > ACTOR_RADIUS + BALL_RADIUS + 8) {
      // In goal mode, competitive friends approach from the far side so kicks face the hoop.
      let tx = ball.position.x, ty = ball.position.y;
      if (this.goalsEnabled && actor.personality.competitive >= 6) {
        const hoop = this.hoopCenter();
        tx = ball.position.x - (hoop.x - ball.position.x) * 0.12;
        ty = ball.position.y - (hoop.y - ball.position.y) * 0.08 + 18;
      }
      const speed = actor.personality.competitive >= 10 ? 130 : 34 + actor.personality.competitive * 3;
      const dx = tx - actor.position.x;
      const dy = ty - actor.position.y;
      const dist = Math.hypot(dx, dy) || 1;
      const step = Math.min(dist, speed * delta / 1000);
      const prev = actor.position;
      actor.position = this.confined({
        x: actor.position.x + (dx / dist) * step,
        y: actor.position.y + (dy / dist) * step,
      });
      this.headings.set(actor.id, Math.atan2(ball.position.y - actor.position.y, ball.position.x - actor.position.x));
      const dt = delta / 1000;
      this.actorMotion.set(actor.id, { x: (actor.position.x - prev.x) / dt, y: (actor.position.y - prev.y) / dt });
    } else {
      const power = (actor.personality.competitive >= 10 ? 1.6 : 1) * (actor.personality.chaos >= 10 ? 1.35 : 1);
      this.tryKick(ball, actor, KICK_SPEED * (0.85 + actor.personality.competitive * 0.04) * power);
      actor.mood.joy = clamp(actor.mood.joy + 0.4, 0, 100);
    }
  }
  private resolveActorCollisions(): void {
    for (let i = 0; i < this.actors.length; i++) {
      for (let j = i + 1; j < this.actors.length; j++) {
        const a = this.actors[i], b = this.actors[j];
        if (a.activity === "dragged" || b.activity === "dragged") continue;
        if (a.activity === "talk" || b.activity === "talk") continue;
        const gap = distance(a.position, b.position);
        const minGap = ACTOR_RADIUS * 2;
        if (gap >= minGap || gap < 0.001) continue;
        const nx = (b.position.x - a.position.x) / gap;
        const ny = (b.position.y - a.position.y) / gap;
        const overlap = (minGap - gap) / 2;
        a.position = this.confined({ x: a.position.x - nx * overlap, y: a.position.y - ny * overlap });
        b.position = this.confined({ x: b.position.x + nx * overlap, y: b.position.y + ny * overlap });
        const loner = a.personality.friendliness <= 0 || b.personality.friendliness <= 0;
        const sticky = !loner && (a.personality.friendliness >= 10 || b.personality.friendliness >= 10);
        if ((a.activity === "walk" || b.activity === "walk") && !sticky) {
          const bounce = Math.atan2(ny, nx);
          const wild = a.personality.chaos >= 10 || b.personality.chaos >= 10;
          if (a.activity === "walk") this.headings.set(a.id, bounce + Math.PI + (wild ? this.random() * 1.4 : (this.random() - 0.5) * 0.6));
          if (b.activity === "walk") this.headings.set(b.id, bounce + (wild ? this.random() * 1.4 : (this.random() - 0.5) * 0.6));
          a.mood.irritation = clamp(a.mood.irritation + (wild ? 1.4 : 0.8), 0, 100);
          b.mood.irritation = clamp(b.mood.irritation + (wild ? 1.4 : 0.8), 0, 100);
          this.emitBump(a.id, b.id);
        }
        if (loner) {
          if (a.personality.friendliness <= 0 && a.activity === "walk") this.headings.set(a.id, Math.atan2(-ny, -nx));
          if (b.personality.friendliness <= 0 && b.activity === "walk") this.headings.set(b.id, Math.atan2(ny, nx));
        }
      }
    }
  }
  private stepBalls(delta: number): void {
    const dt = delta / 1000;
    const box = this.ballBounds();
    for (const ball of this.props) {
      if (ball.type !== "ball" || ball.id === this.draggingBall) continue;
      const grounded = ball.position.y >= box.maxY - 0.5 && Math.abs(ball.velocity.y) <= SETTLE_SPEED;
      if (grounded) {
        ball.position.y = box.maxY;
        ball.velocity.y = 0;
        ball.velocity.x *= FLOOR_FRICTION;
        if (Math.abs(ball.velocity.x) < SETTLE_SPEED) ball.velocity.x = 0;
        ball.position.x = clamp(ball.position.x + ball.velocity.x * dt, box.minX, box.maxX);
        ball.spin += ball.velocity.x * dt * 4.2;
        continue;
      }
      ball.velocity.y += GRAVITY * dt;
      ball.position.x += ball.velocity.x * dt;
      ball.position.y += ball.velocity.y * dt;
      ball.spin += ball.velocity.x * dt * 4.2;
      if (ball.position.x <= box.minX) {
        ball.position.x = box.minX;
        const impact = Math.abs(ball.velocity.x);
        ball.velocity.x = Math.abs(ball.velocity.x) * WALL_BOUNCE;
        if (impact > 40) this.emit({ type: "ballBounced", propId: ball.id, surface: "wall", impact });
      } else if (ball.position.x >= box.maxX) {
        ball.position.x = box.maxX;
        const impact = Math.abs(ball.velocity.x);
        ball.velocity.x = -Math.abs(ball.velocity.x) * WALL_BOUNCE;
        if (impact > 40) this.emit({ type: "ballBounced", propId: ball.id, surface: "wall", impact });
      }
      if (ball.position.y <= box.minY) {
        ball.position.y = box.minY;
        ball.velocity.y = Math.abs(ball.velocity.y) * WALL_BOUNCE;
      } else if (ball.position.y >= box.maxY) {
        ball.position.y = box.maxY;
        const impact = Math.abs(ball.velocity.y);
        ball.velocity.y = impact <= SETTLE_SPEED ? 0 : -impact * FLOOR_BOUNCE;
        ball.velocity.x *= FLOOR_FRICTION;
        if (Math.abs(ball.velocity.x) < SETTLE_SPEED * 0.35) ball.velocity.x = 0;
        if (impact > SETTLE_SPEED) this.emit({ type: "ballBounced", propId: ball.id, surface: "floor", impact });
      }
      this.checkGoal(ball);
    }
  }
  private checkGoal(ball: Prop): void {
    if (!this.goalsEnabled) return;
    const hoop = this.hoopRect();
    const inside =
      ball.position.x >= hoop.x &&
      ball.position.x <= hoop.x + hoop.width &&
      ball.position.y >= hoop.y &&
      ball.position.y <= hoop.y + hoop.height;
    if (!inside) {
      this.ballInHoop.delete(ball.id);
      return;
    }
    if (this.ballInHoop.has(ball.id)) return;
    if (this.elapsedMs < (this.goalReadyAt.get(ball.id) ?? 0)) return;
    if (Math.hypot(ball.velocity.x, ball.velocity.y) < 35) return;
    this.ballInHoop.add(ball.id);
    this.goalReadyAt.set(ball.id, this.elapsedMs + GOAL_COOLDOWN_MS);
    this.score += 1;
    const scorerId = this.lastToucher.get(ball.id) ?? null;
    if (scorerId) {
      const scorer = this.actors.find(actor => actor.id === scorerId);
      if (scorer) {
        const boost = 6 + scorer.personality.competitive * 1.2;
        scorer.mood.joy = clamp(scorer.mood.joy + boost, 0, 100);
        scorer.needs.boredom = clamp(scorer.needs.boredom - 8, 0, 100);
      }
    }
    // Soft reject so the ball doesn't stick in the rim.
    ball.velocity.x = -Math.abs(ball.velocity.x) * 0.4 - 40;
    ball.velocity.y = Math.abs(ball.velocity.y) * 0.35 + 60;
    this.emit({ type: "goalScored", propId: ball.id, scorerId, score: this.score });
  }
  private resolveActorBallCollisions(): void {
    for (const ball of this.props) {
      if (ball.type !== "ball" || ball.id === this.draggingBall) continue;
      for (const actor of this.actors) {
        if (actor.activity === "dragged" || actor.activity === "talk") continue;
        const gap = distance(actor.position, ball.position);
        const minGap = ACTOR_RADIUS + BALL_RADIUS;
        if (gap >= minGap || gap < 0.001) continue;
        const nx = (ball.position.x - actor.position.x) / gap;
        const ny = (ball.position.y - actor.position.y) / gap;
        const overlap = minGap - gap;
        ball.position = this.confineBall({ x: ball.position.x + nx * overlap, y: ball.position.y + ny * overlap });
        const motion = this.actorMotion.get(actor.id) ?? { x: 0, y: 0 };
        const approachSpeed = Math.max(0, motion.x * nx + motion.y * ny);
        const chaosKick = actor.personality.chaos >= 10 ? 1.45 : 1;
        const base = (actor.activity === "play" ? KICK_SPEED * 1.15 : KICK_SPEED * 0.75) * chaosKick;
        const speed = base * (0.9 + this.random() * 0.2) * (1 + clamp(approachSpeed / 90, 0, 1.6));
        if (this.tryKick(ball, actor, speed) && (actor.activity === "walk" || actor.activity === "idle")) {
          actor.mood.joy = clamp(actor.mood.joy + 0.25, 0, 100);
        }
      }
    }
  }
  private tryKick(ball: Prop, actor: Actor, speed: number): boolean {
    const key = `${actor.id}::${ball.id}`;
    if (this.elapsedMs < (this.kickReadyAt.get(key) ?? 0)) return false;
    this.kickReadyAt.set(key, this.elapsedMs + KICK_COOLDOWN_MS);
    this.kickBall(ball, actor.position, speed, actor);
    this.lastToucher.set(ball.id, actor.id);
    this.emit({ type: "ballKicked", propId: ball.id, actorId: actor.id, strength: speed });
    return true;
  }
  private kickBall(ball: Prop, from: Point, speed: number, actor?: Actor): void {
    let dx = ball.position.x - from.x;
    let dy = ball.position.y - from.y;
    if (actor && this.goalsEnabled && actor.personality.competitive >= 5) {
      const hoop = this.hoopCenter();
      const hx = hoop.x - ball.position.x;
      const hy = hoop.y - ball.position.y;
      const blend = clamp(actor.personality.competitive / 10, 0.4, 0.88);
      dx = dx * (1 - blend) + hx * blend;
      dy = dy * (1 - blend) + hy * blend;
    }
    const gap = Math.hypot(dx, dy) || 1;
    const lift = Math.max(0.2, -dy / gap) * 0.35 + 0.45;
    ball.velocity.x = (dx / gap) * speed + (this.random() - 0.5) * (actor && actor.personality.competitive >= 8 ? 18 : 40);
    ball.velocity.y = (dy / gap) * speed * 0.55 - speed * lift;
  }
  private emitBump(aId: string, bId: string): void {
    const key = pairKey(aId, bId);
    if (this.elapsedMs < (this.bumpReadyAt.get(key) ?? 0)) return;
    this.bumpReadyAt.set(key, this.elapsedMs + BUMP_EVENT_COOLDOWN_MS);
    this.emit({ type: "actorsBumped", actorIds: [aId, bId] });
  }
  private sampleDrag(point: Point): void {
    const at = typeof performance !== "undefined" ? performance.now() : this.elapsedMs;
    if (this.dragSample) {
      const dt = Math.max(16, at - this.dragSample.at);
      this.dragVelocity = {
        x: (point.x - this.dragSample.x) / dt * 1000,
        y: (point.y - this.dragSample.y) / dt * 1000,
      };
    }
    this.dragSample = { x: point.x, y: point.y, at };
  }
  private clearDragSample(): void {
    this.dragSample = null;
    this.dragVelocity = { x: 0, y: 0 };
  }
  private flingNearbyBalls(from: Point, actorId: string | null): void {
    const throwSpeed = Math.hypot(this.dragVelocity.x, this.dragVelocity.y);
    if (throwSpeed < THROW_MIN_SPEED) return;
    for (const ball of this.props) {
      if (ball.type !== "ball" || ball.id === this.draggingBall) continue;
      if (distance(from, ball.position) > ACTOR_RADIUS + BALL_RADIUS + 28) continue;
      const strength = clamp(throwSpeed * 0.85, KICK_SPEED * 0.7, KICK_SPEED * 2.2);
      ball.velocity.x = this.dragVelocity.x * 0.9 + (this.random() - 0.5) * 30;
      ball.velocity.y = this.dragVelocity.y * 0.75 - Math.abs(this.dragVelocity.x) * 0.15;
      if (actorId) {
        this.kickReadyAt.set(`${actorId}::${ball.id}`, this.elapsedMs + KICK_COOLDOWN_MS);
        this.lastToucher.set(ball.id, actorId);
      }
      this.emit({ type: "ballKicked", propId: ball.id, actorId, strength });
    }
  }
  private chooseActivity(actor: Actor): void {
    const forced = this.extremeActivity(actor);
    if (forced) {
      actor.reservations = [];
      actor.activity = forced;
      actor.activityVersion++;
      this.decisionAt.set(actor.id, this.elapsedMs + 2800);
      this.activityEndsAt.set(actor.id, this.elapsedMs + 2800);
      if (forced === "play") {
        const ball = this.props.find(prop => prop.type === "ball");
        if (ball) actor.reservations = [ball.id];
      } else if (actor.personality.friendliness >= 10) this.headings.set(actor.id, this.headingToward(actor));
      else if (actor.personality.friendliness <= 0) this.headings.set(actor.id, this.headingAway(actor));
      else this.headings.set(actor.id, this.random() * Math.PI * 2);
      this.emit({ type: "activity", actorId: actor.id, activity: forced });
      return;
    }
    actor.reservations = [];
    const noise = () => this.random() * 9;
    const options: Array<[Activity, number]> = [
      ["walk", 28 + actor.personality.chaos * 1.5 + (actor.personality.friendliness >= 10 ? 36 : 0) + noise()],
      ["read", (10 - actor.personality.chaos) * 4 + actor.needs.boredom * 0.27 + noise()],
      ["rest", (100 - actor.needs.energy) * 0.9 + noise()],
    ];
    const ball = this.props.find(prop => prop.type === "ball" && !this.actors.some(other => other.reservations.includes(prop.id)));
    if (ball) {
      const hunger = actor.personality.competitive * (this.goalsEnabled ? 6.5 : 4) + actor.needs.boredom * 0.35 + (100 - actor.mood.joy) * 0.2;
      const leadChase = this.goalsEnabled && this.score > 0 ? actor.personality.competitive * 2.5 : 0;
      options.push(["play", hunger + leadChase + noise()]);
    }
    options.sort((a, b) => b[1] - a[1]);
    const activity = options[0][0];
    actor.activity = activity; actor.activityVersion++;
    this.decisionAt.set(actor.id, this.elapsedMs + 3000 + this.random() * 5000);
    this.activityEndsAt.set(actor.id, this.elapsedMs + 2500 + this.random() * 2400);
    if (activity === "walk") this.headings.set(actor.id, this.random() * Math.PI * 2);
    if (activity === "play" && ball) actor.reservations = [ball.id];
    this.emit({ type: "activity", actorId: actor.id, activity });
  }
  private checkEncounters(): void {
    for (let i = 0; i < this.actors.length; i++) for (let j = i + 1; j < this.actors.length; j++) {
      const a = this.actors[i], b = this.actors[j], key = pairKey(a.id, b.id), gap = distance(a.position, b.position);
      if (gap >= LEAVE_DISTANCE) { this.insidePairs.delete(key); continue; }
      if (gap > ENTER_DISTANCE || this.insidePairs.has(key)) continue;
      this.insidePairs.add(key);
      if (a.personality.friendliness <= 0 || b.personality.friendliness <= 0) continue;
      if (this.scene || this.dragging || [a.activity, b.activity].some(value => value === "dragged" || value === "talk")) continue;
      const relation = this.relationships.get(`${a.id}->${b.id}`)!;
      if (this.elapsedMs - relation.lastEncounterAt < ENCOUNTER_COOLDOWN) continue;
      this.beginScene("encounter", [a, b]);
    }
  }
  private finishScene(): void {
    if (!this.scene) return;
    this.scene = null;
    this.sceneEndsAt = 0;
    for (const id of this.sceneParticipants) {
      const actor = this.actors.find(item => item.id === id);
      if (actor?.activity === "talk") {
        actor.activity = "idle";
        actor.activityVersion++;
        this.decisionAt.set(actor.id, this.elapsedMs + 400);
      }
    }
    this.sceneParticipants = [];
  }
  private beginScene(kind: SceneInput["kind"], participants: Actor[]): void {
    if (this.brainrotOutbreak()) return;
    if (kind !== "drag_release" && (this.scene || this.elapsedMs - this.lastSceneAt < SCENE_COOLDOWN)) return;
    this.finishScene();
    this.lastSceneAt = this.elapsedMs;
    const sceneId = `scene-${this.nextSceneId++}`;
    if (kind === "encounter") for (const actor of participants) { actor.activity = "talk"; actor.activityVersion++; actor.reservations = []; this.activityEndsAt.set(actor.id, this.elapsedMs + 2800); }
    const input: SceneInput = {
      sceneId, kind,
      actors: participants.map(actor => ({ id: actor.id, name: actor.name, vibe: actor.vibe, mood: actor.mood.irritation > 40 ? "annoyed" : "okay" })),
      allowedIntents: kind === "encounter" ? ["greet", "tease", "invite"] : kind === "drag_release" ? ["complain", "greet"] : ["tease", "celebrate"],
    };
    const fallback = offlineScene(input);
    this.scene = { id: sceneId, kind, lines: fallback.lines };
    this.sceneParticipants = participants.map(actor => actor.id);
    this.sceneEndsAt = this.elapsedMs + 3200;
    this.applyIntent(kind, participants);
    this.emit({ type: "scene", sceneId, kind, output: fallback });
    const versions = participants.map(actor => actor.activityVersion);
    const current = () => this.scene?.id === sceneId && participants.every((actor, index) => this.actors.includes(actor) && actor.activityVersion === versions[index]);
    void this.director.suggest(input, this.elapsedMs, current).then((output: SceneOutput | null) => {
      if (!output || !current()) return;
      this.scene = { id: sceneId, kind, lines: output.lines };
      this.sceneEndsAt = this.elapsedMs + 3200;
      this.emit({ type: "scene", sceneId, kind, output });
    });
  }
  private applyIntent(kind: SceneInput["kind"], participants: Actor[]): void {
    if (kind === "encounter" && participants.length === 2) {
      const [a, b] = participants;
      for (const [from, to] of [[a, b], [b, a]] as const) {
        const relation = this.relationships.get(`${from.id}->${to.id}`)!;
        relation.affinity = clamp(relation.affinity + (from.personality.friendliness >= 5 ? 2 : 1), 0, 100);
        relation.familiarity = clamp(relation.familiarity + 1, 0, 100);
        relation.lastEncounterAt = this.elapsedMs;
      }
      a.needs.social = clamp(a.needs.social - 7, 0, 100);
      b.needs.social = clamp(b.needs.social - 7, 0, 100);
    }
    if (kind === "drag_release") participants[0].mood.irritation = clamp(participants[0].mood.irritation + 8, 0, 100);
  }
  startDrag(actorId: string): boolean {
    const actor = this.actors.find(item => item.id === actorId);
    if (!actor || this.dragging || this.draggingBall) return false;
    const previous = actor.activity;
    actor.activityVersion++;
    actor.reservations = [];
    actor.activity = "dragged";
    this.dragging = actorId;
    this.clearDragSample();
    this.sampleDrag(actor.position);
    if (this.scene && this.sceneParticipants.includes(actorId)) this.finishScene();
    this.emit({ type: "interrupted", actorId, previous });
    return true;
  }
  dragTo(point: Point): void {
    const actor = this.actors.find(item => item.id === this.dragging);
    if (!actor || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const next = this.confined(point);
    this.sampleDrag(next);
    actor.position = next;
    this.actorMotion.set(actor.id, { ...this.dragVelocity });
  }
  releaseDrag(): boolean {
    const actor = this.actors.find(item => item.id === this.dragging);
    if (!actor) return false;
    this.flingNearbyBalls(actor.position, actor.id);
    this.dragging = null;
    this.clearDragSample();
    actor.activity = "idle";
    actor.activityVersion++;
    this.decisionAt.set(actor.id, this.elapsedMs + 800);
    const other = this.actors.find(item => item.id !== actor.id && distance(item.position, actor.position) <= ENTER_DISTANCE);
    this.beginScene("drag_release", other ? [actor, other] : [actor]);
    if (other) {
      this.insidePairs.add(pairKey(actor.id, other.id));
      this.applyIntent("encounter", [actor, other]);
    }
    return true;
  }
  startBallDrag(propId: string): boolean {
    if (this.dragging || this.draggingBall) return false;
    const ball = this.props.find(prop => prop.id === propId && prop.type === "ball");
    if (!ball) return false;
    this.draggingBall = propId;
    ball.velocity = { x: 0, y: 0 };
    this.clearDragSample();
    this.sampleDrag(ball.position);
    return true;
  }
  dragBallTo(point: Point): void {
    const ball = this.props.find(prop => prop.id === this.draggingBall);
    if (!ball || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const next = this.confineBall(point);
    this.sampleDrag(next);
    ball.position = next;
  }
  releaseBallDrag(): boolean {
    const ball = this.props.find(prop => prop.id === this.draggingBall);
    if (!ball) return false;
    const throwSpeed = Math.hypot(this.dragVelocity.x, this.dragVelocity.y);
    if (throwSpeed >= THROW_MIN_SPEED) {
      ball.velocity = {
        x: this.dragVelocity.x * 0.95,
        y: this.dragVelocity.y * 0.85 - 40,
      };
      this.lastToucher.delete(ball.id);
      this.emit({ type: "ballKicked", propId: ball.id, actorId: null, strength: throwSpeed });
    } else {
      ball.velocity = { x: 0, y: 40 };
    }
    this.draggingBall = null;
    this.clearDragSample();
    this.emit({ type: "propsChanged", count: this.props.length });
    return true;
  }
  /** Apply an immediate velocity to a ball (tests / scripted flings). */
  impulseBall(propId: string, velocity: Point): boolean {
    const ball = this.props.find(prop => prop.id === propId && prop.type === "ball");
    if (!ball || ball.id === this.draggingBall) return false;
    if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) return false;
    ball.velocity = { x: velocity.x, y: velocity.y };
    return true;
  }
  addProp(type: Prop["type"], position: Point, createdBy = "user"): Prop | null {
    if (type !== "ball" || this.props.length >= MAX_PROPS || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
    const prop: Prop = {
      id: `prop-${this.nextPropId++}`,
      type,
      position: this.confineBall(position),
      velocity: { x: (this.random() - 0.5) * 36, y: 80 + this.random() * 40 },
      spin: 0,
      createdAt: this.elapsedMs,
      createdBy,
    };
    this.props.push(prop); this.emit({ type: "propAdded", prop }); this.emit({ type: "propsChanged", count: this.props.length });
    return { ...prop, position: { ...prop.position }, velocity: { ...prop.velocity } };
  }
  undoProp(): boolean {
    const prop = this.props.pop(); if (!prop) return false;
    for (const actor of this.actors) actor.reservations = actor.reservations.filter(id => id !== prop.id);
    this.emit({ type: "propsChanged", count: this.props.length }); return true;
  }
  cleanDesktop(): void {
    this.props = [];
    this.draggingBall = null;
    this.clearDragSample();
    this.lastToucher.clear();
    this.ballInHoop.clear();
    this.goalReadyAt.clear();
    this.score = 0;
    for (const actor of this.actors) actor.reservations = [];
    this.emit({ type: "propsChanged", count: 0 });
  }
  snapshot(): WorldSnapshot {
    return structuredClone({
      actors: this.actors,
      relationships: [...this.relationships.values()],
      props: this.props,
      bounds: this.bounds,
      scene: this.scene,
      score: this.score,
      hoop: this.goalsEnabled ? this.hoopRect() : null,
    });
  }
  exportSave(): WorldSave {
    return {
      version: 1,
      actors: this.actors.map(actor => ({ id: actor.id, personality: actor.personality, needs: actor.needs, mood: actor.mood, xRatio: actor.position.x / this.bounds.width, yRatio: actor.position.y / this.bounds.height })),
      relationships: [...this.relationships.values()].map(relation => ({ ...relation, lastEncounterAt: Number.isFinite(relation.lastEncounterAt) ? relation.lastEncounterAt : -1 })),
      props: this.props.filter(prop => prop.createdBy === "user").map(prop => ({ id: prop.id, type: prop.type, xRatio: prop.position.x / this.bounds.width, yRatio: prop.position.y / this.bounds.height, createdAt: prop.createdAt, createdBy: prop.createdBy })),
    };
  }
  importSave(input: unknown): boolean {
    if (!input || typeof input !== "object") return false;
    const save = input as WorldSave;
    if (save.version !== 1 || !Array.isArray(save.actors) || !Array.isArray(save.relationships) || !Array.isArray(save.props) || save.props.length > MAX_PROPS) return false;
    if (save.actors.length !== this.actors.length || new Set(save.actors.map(actor => actor.id)).size !== this.actors.length) return false;
    const allowed = new Set(this.actors.map(actor => actor.id));
    const validScore = (score: number) => Number.isFinite(score) && score >= 0 && score <= 100;
    try {
      if (!save.actors.every(actor => allowed.has(actor.id) && Object.values(actor.needs).every(validScore) && Object.values(actor.mood).every(validScore) && [actor.xRatio, actor.yRatio].every(value => Number.isFinite(value) && value >= 0 && value <= 1))) return false;
      // Accept old saved decorations only so the rest of an existing save survives;
      // they are discarded below and can never become visible again.
      if (!save.props.every(prop => typeof prop.id === "string" && /^prop-[1-9]\d*$/.test(prop.id) && ["note", "paper", "ball"].includes(prop.type) && typeof prop.createdBy === "string" && prop.createdBy.length <= 100 && Number.isFinite(prop.createdAt) && [prop.xRatio, prop.yRatio].every(value => Number.isFinite(value) && value >= 0 && value <= 1))) return false;
      if (new Set(save.props.map(prop => prop.id)).size !== save.props.length) return false;
      if (save.relationships.length !== this.actors.length * (this.actors.length - 1)) return false;
      if (!save.relationships.every(relation => allowed.has(relation.fromId) && allowed.has(relation.toId) && relation.fromId !== relation.toId && validScore(relation.affinity) && validScore(relation.familiarity))) return false;
      if (new Set(save.relationships.map(relation => `${relation.fromId}->${relation.toId}`)).size !== save.relationships.length) return false;
      for (const actor of save.actors) validatePersonality(actor.personality);
    } catch { return false; }
    for (const actor of this.actors) {
      const stored = save.actors.find(item => item.id === actor.id)!;
      actor.personality = { ...stored.personality };
      actor.needs = { ...stored.needs };
      actor.mood = { ...stored.mood };
      actor.position = this.confined({ x: stored.xRatio * this.bounds.width, y: stored.yRatio * this.bounds.height });
    }
    // Saved simulation milliseconds cannot be compared with a fresh session clock.
    this.relationships = new Map(save.relationships.map(relation => [`${relation.fromId}->${relation.toId}`, { ...relation, lastEncounterAt: -Infinity }]));
    this.props = save.props.filter(prop => prop.type === "ball" && prop.createdBy === "user").map(prop => ({
      id: prop.id,
      type: "ball" as const,
      position: this.confineBall({ x: prop.xRatio * this.bounds.width, y: prop.yRatio * this.bounds.height }),
      velocity: { x: 0, y: 0 },
      spin: 0,
      createdAt: prop.createdAt,
      createdBy: prop.createdBy,
    }));
    this.nextPropId = Math.max(0, ...this.props.map(prop => Number(prop.id.replace("prop-", "")) || 0)) + 1;
    return true;
  }
}
