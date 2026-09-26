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
const BODY_MARGIN = 42;

type WorldOptions = {
  friends: FriendCharacter[];
  bounds: Bounds;
  personalities?: Record<string, Personality>;
  random?: () => number;
  director?: SceneDirector;
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
  private lastPrankAt = new Map<string, number>();
  private insidePairs = new Set<string>();
  private nextSceneId = 1;
  private nextPropId = 1;
  private scene: WorldSnapshot["scene"] = null;
  private sceneEndsAt = 0;
  private dragging: string | null = null;
  private paused = false;

  constructor(options: WorldOptions) {
    if (options.friends.length < 1) throw new Error("At least one friend is required");
    if (new Set(options.friends.map(friend => friend.id)).size !== options.friends.length) throw new Error("Friend IDs must be unique");
    this.bounds = validBounds(options.bounds);
    this.random = options.random ?? Math.random;
    this.director = options.director ?? new SceneDirector();
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
  setBounds(bounds: Bounds): void {
    const next = validBounds(bounds), previous = this.bounds;
    this.bounds = next;
    for (const actor of this.actors) actor.position = this.confined({ x: actor.position.x / previous.width * next.width, y: actor.position.y / previous.height * next.height });
    for (const prop of this.props) prop.position = this.confined({ x: prop.position.x / previous.width * next.width, y: prop.position.y / previous.height * next.height });
  }
  setPaused(paused: boolean): void {
    this.paused = paused; this.lastTickMs = null; this.remainderMs = 0;
    if (paused) {
      this.scene = null;
      for (const actor of this.actors) if (actor.activity === "talk") {
        actor.activity = "idle"; actor.activityVersion++;
      }
    }
  }
  setPersonality(actorId: string, personality: Personality): boolean {
    const actor = this.actors.find(item => item.id === actorId);
    if (!actor) return false;
    actor.personality = validatePersonality(personality);
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
    if (this.scene && this.elapsedMs >= this.sceneEndsAt) this.scene = null;
    for (const actor of this.actors) {
      actor.needs.energy = clamp(actor.needs.energy + (actor.activity === "rest" ? 0.8 : -0.09), 0, 100);
      actor.needs.boredom = clamp(actor.needs.boredom + (actor.activity === "read" || actor.activity === "play" ? -0.6 : 0.14), 0, 100);
      actor.needs.social = clamp(actor.needs.social + (actor.activity === "talk" ? -0.5 : 0.08), 0, 100);
      actor.needs.hygiene = clamp(actor.needs.hygiene - 0.012, 0, 100);
      actor.mood.irritation = clamp(actor.mood.irritation - 0.02, 0, 100);
      actor.mood.joy = clamp(actor.mood.joy + (actor.activity === "play" ? 0.08 : actor.needs.boredom > 80 ? -0.03 : 0), 0, 100);
      if (actor.activity === "walk") this.moveActor(actor, delta);
      if (actor.activity !== "dragged" && actor.activity !== "talk" && this.elapsedMs >= (this.decisionAt.get(actor.id) ?? 0) && this.elapsedMs >= (this.activityEndsAt.get(actor.id) ?? 0)) this.chooseActivity(actor);
    }
    this.checkEncounters();
  }
  private moveActor(actor: Actor, delta: number): void {
    const heading = this.headings.get(actor.id) ?? 0;
    const speed = 22 + actor.personality.chaos * 3;
    const next = { x: actor.position.x + Math.cos(heading) * speed * delta / 1000, y: actor.position.y + Math.sin(heading) * speed * delta / 1000 };
    const confined = this.confined(next);
    if (confined.x !== next.x || confined.y !== next.y) this.headings.set(actor.id, heading + Math.PI * 0.7);
    actor.position = confined;
  }
  private chooseActivity(actor: Actor): void {
    actor.reservations = [];
    const noise = () => this.random() * 9;
    const options: Array<[Activity, number]> = [
      ["walk", 28 + actor.personality.chaos * 1.5 + noise()],
      ["read", (10 - actor.personality.chaos) * 4 + actor.needs.boredom * 0.27 + noise()],
      ["rest", (100 - actor.needs.energy) * 0.9 + noise()],
    ];
    const ball = this.props.find(prop => prop.type === "ball" && !this.actors.some(other => other.reservations.includes(prop.id)));
    if (ball) options.push(["play", actor.personality.competitive * 4 + actor.needs.boredom * 0.3 + (100 - actor.mood.joy) * 0.25 + noise()]);
    if (this.props.length < MAX_PROPS && this.elapsedMs - (this.lastPrankAt.get(actor.id) ?? -Infinity) >= 15_000) options.push(["prank", actor.personality.chaos * 4 + actor.personality.brainrot * 2 + actor.needs.boredom * 0.42 + noise()]);
    options.sort((a, b) => b[1] - a[1]);
    const activity = options[0][0];
    actor.activity = activity; actor.activityVersion++;
    this.decisionAt.set(actor.id, this.elapsedMs + 3000 + this.random() * 5000);
    this.activityEndsAt.set(actor.id, this.elapsedMs + (activity === "prank" ? 700 : 2500 + this.random() * 2400));
    if (activity === "walk") this.headings.set(actor.id, this.random() * Math.PI * 2);
    if (activity === "play" && ball) actor.reservations = [ball.id];
    this.emit({ type: "activity", actorId: actor.id, activity });
    if (activity === "prank") {
      this.lastPrankAt.set(actor.id, this.elapsedMs);
      this.addProp("note", actor.position, actor.id);
      this.beginScene("prop_prank", [actor]);
    }
  }
  private checkEncounters(): void {
    for (let i = 0; i < this.actors.length; i++) for (let j = i + 1; j < this.actors.length; j++) {
      const a = this.actors[i], b = this.actors[j], key = pairKey(a.id, b.id), gap = distance(a.position, b.position);
      if (gap >= LEAVE_DISTANCE) { this.insidePairs.delete(key); continue; }
      if (gap > ENTER_DISTANCE || this.insidePairs.has(key)) continue;
      this.insidePairs.add(key);
      if (this.scene || this.dragging || [a.activity, b.activity].some(value => value === "dragged" || value === "talk")) continue;
      const relation = this.relationships.get(`${a.id}->${b.id}`)!;
      if (this.elapsedMs - relation.lastEncounterAt < ENCOUNTER_COOLDOWN) continue;
      this.beginScene("encounter", [a, b]);
    }
  }
  private beginScene(kind: SceneInput["kind"], participants: Actor[]): void {
    if (this.scene && kind === "encounter") return;
    const sceneId = `scene-${this.nextSceneId++}`;
    if (kind === "encounter") for (const actor of participants) { actor.activity = "talk"; actor.activityVersion++; actor.reservations = []; this.activityEndsAt.set(actor.id, this.elapsedMs + 2800); }
    const input: SceneInput = {
      sceneId, kind,
      actors: participants.map(actor => ({ id: actor.id, name: actor.name, vibe: actor.vibe, mood: actor.mood.irritation > 40 ? "annoyed" : "okay" })),
      allowedIntents: kind === "encounter" ? ["greet", "tease", "invite"] : kind === "drag_release" ? ["complain", "greet"] : ["tease", "celebrate"],
    };
    const fallback = offlineScene(input);
    this.scene = { id: sceneId, kind, lines: fallback.lines };
    this.sceneEndsAt = this.elapsedMs + 3200;
    this.applyIntent(kind, participants);
    this.emit({ type: "scene", sceneId, kind, output: fallback });
    const versions = participants.map(actor => actor.activityVersion);
    const current = () => this.scene?.id === sceneId && participants.every((actor, index) => this.actors.includes(actor) && actor.activityVersion === versions[index]);
    void this.director.suggest(input, this.elapsedMs, current).then((output: SceneOutput | null) => {
      if (!output || !current()) return;
      this.scene = { id: sceneId, kind, lines: output.lines };
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
    if (!actor || this.dragging) return false;
    const previous = actor.activity;
    actor.activityVersion++;
    actor.reservations = [];
    actor.activity = "dragged";
    this.dragging = actorId;
    if (this.scene && this.scene.lines.some(line => line.speakerId === actorId)) this.scene = null;
    this.emit({ type: "interrupted", actorId, previous });
    return true;
  }
  dragTo(point: Point): void {
    const actor = this.actors.find(item => item.id === this.dragging);
    if (actor && Number.isFinite(point.x) && Number.isFinite(point.y)) actor.position = this.confined(point);
  }
  releaseDrag(): boolean {
    const actor = this.actors.find(item => item.id === this.dragging);
    if (!actor) return false;
    this.dragging = null;
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
  addProp(type: Prop["type"], position: Point, createdBy = "user"): Prop | null {
    if (this.props.length >= MAX_PROPS || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
    const prop: Prop = { id: `prop-${this.nextPropId++}`, type, position: this.confined(position), createdAt: this.elapsedMs, createdBy };
    this.props.push(prop); this.emit({ type: "propAdded", prop }); this.emit({ type: "propsChanged", count: this.props.length });
    return { ...prop, position: { ...prop.position } };
  }
  undoProp(): boolean {
    const prop = this.props.pop(); if (!prop) return false;
    for (const actor of this.actors) actor.reservations = actor.reservations.filter(id => id !== prop.id);
    this.emit({ type: "propsChanged", count: this.props.length }); return true;
  }
  cleanDesktop(): void {
    this.props = [];
    for (const actor of this.actors) actor.reservations = [];
    this.emit({ type: "propsChanged", count: 0 });
  }
  snapshot(): WorldSnapshot {
    return structuredClone({ actors: this.actors, relationships: [...this.relationships.values()], props: this.props, bounds: this.bounds, scene: this.scene });
  }
  exportSave(): WorldSave {
    return {
      version: 1,
      actors: this.actors.map(actor => ({ id: actor.id, personality: actor.personality, needs: actor.needs, mood: actor.mood, xRatio: actor.position.x / this.bounds.width, yRatio: actor.position.y / this.bounds.height })),
      relationships: [...this.relationships.values()].map(relation => ({ ...relation, lastEncounterAt: Number.isFinite(relation.lastEncounterAt) ? relation.lastEncounterAt : -1 })),
      props: this.props.map(prop => ({ id: prop.id, type: prop.type, xRatio: prop.position.x / this.bounds.width, yRatio: prop.position.y / this.bounds.height, createdAt: prop.createdAt, createdBy: prop.createdBy })),
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
    this.props = save.props.map(prop => ({ id: prop.id, type: prop.type, position: this.confined({ x: prop.xRatio * this.bounds.width, y: prop.yRatio * this.bounds.height }), createdAt: prop.createdAt, createdBy: prop.createdBy }));
    this.nextPropId = Math.max(0, ...this.props.map(prop => Number(prop.id.replace("prop-", "")) || 0)) + 1;
    return true;
  }
}
