import type { FriendCharacter } from "../shared/types.js";
import type { Bounds, Personality, Point } from "../game/types.js";

export type Activity = "idle" | "walk" | "read" | "rest" | "play" | "talk" | "dragged";
export type Needs = { energy: number; boredom: number; hygiene: number; social: number };
export type Mood = { joy: number; irritation: number };
export type Actor = {
  id: string;
  name: string;
  vibe: FriendCharacter["vibe"];
  personality: Personality;
  needs: Needs;
  mood: Mood;
  activity: Activity;
  position: Point; // feet-center, local to the desktop arena
  activityVersion: number;
  reservations: string[];
};
export type Relationship = {
  fromId: string;
  toId: string;
  affinity: number;
  familiarity: number;
  lastEncounterAt: number;
};
export type Prop = {
  id: string;
  type: "ball";
  position: Point;
  createdAt: number;
  createdBy: string;
};
export type SceneKind = "encounter" | "drag_release";
export type SceneInput = {
  sceneId: string;
  kind: SceneKind;
  actors: Array<{ id: string; name: string; vibe: string; mood: string }>;
  allowedIntents: Array<"greet" | "tease" | "invite" | "complain" | "celebrate">;
};
export type SceneOutput = {
  lines: Array<{ speakerId: string; text: string }>;
  intent: "greet" | "tease" | "invite" | "complain" | "celebrate";
};
export type WorldEvent =
  | { type: "activity"; actorId: string; activity: Activity }
  | { type: "interrupted"; actorId: string; previous: Activity }
  | { type: "scene"; sceneId: string; kind: SceneKind; output: SceneOutput }
  | { type: "propAdded"; prop: Prop }
  | { type: "propsChanged"; count: number };
export type WorldSnapshot = {
  actors: Actor[];
  relationships: Relationship[];
  props: Prop[];
  bounds: Bounds;
  scene: { id: string; kind: SceneKind; lines: SceneOutput["lines"] } | null;
};
export type WorldSave = {
  version: 1;
  actors: Array<{ id: string; personality: Personality; needs: Needs; mood: Mood; xRatio: number; yRatio: number }>;
  relationships: Relationship[];
  props: Array<{ id: string; type: Prop["type"]; xRatio: number; yRatio: number; createdAt: number; createdBy: string }>;
};
