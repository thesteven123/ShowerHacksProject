const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DesktopWorld, SceneDirector, validateSceneOutput } = require("../dist/simulation/index.js");
const { mockFriends } = require("../dist/shared/mockFriends.js");

function fixture({ director } = {}) {
  const events = [];
  const world = new DesktopWorld({ friends: mockFriends, bounds: { width: 900, height: 600 }, random: () => 0.5, director });
  world.subscribe(event => events.push(event));
  let now = 0;
  world.tick(now);
  return { world, events, advance(milliseconds) { for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) { now += 100; world.tick(now); } } };
}

test("three independent friends choose bounded local activities without AI", () => {
  const f = fixture();
  f.advance(8000);
  const snapshot = f.world.snapshot();
  assert.equal(snapshot.actors.length, 3);
  assert.ok(f.events.some(event => event.type === "activity"));
  assert.ok(snapshot.actors.every(actor => actor.needs.energy >= 0 && actor.needs.energy <= 100));
  assert.equal(snapshot.relationships.length, 6);
  assert.ok(snapshot.props.every(prop => ["note", "paper", "ball"].includes(prop.type)));
});

test("a competitive friend uses a virtual ball and play improves mood", () => {
  const friend = mockFriends[0];
  const world = new DesktopWorld({
    friends: [friend], bounds: { width: 900, height: 600 }, random: () => 0.5,
    personalities: { [friend.id]: { chaos: 0, brainrot: 0, competitive: 10, friendliness: 5 } },
  });
  world.addProp("ball", { x: 450, y: 350 });
  world.tick(0);
  for (let now = 100; now <= 10000; now += 100) world.tick(now);
  assert.equal(world.snapshot().actors[0].activity, "play");
  assert.ok(world.snapshot().actors[0].mood.joy > 55);
});

test("drag interrupts an activity and immediately gives an offline reply", () => {
  const f = fixture();
  f.advance(5000);
  const before = f.world.snapshot().actors[0], other = f.world.snapshot().actors[1];
  assert.equal(f.world.startDrag(before.id), true);
  assert.equal(f.world.snapshot().actors[0].activity, "dragged");
  assert.equal(f.world.snapshot().actors[0].activityVersion, before.activityVersion + 1);
  f.world.dragTo(other.position);
  assert.equal(f.world.releaseDrag(), true);
  const scene = f.events.filter(event => event.type === "scene").at(-1);
  assert.equal(scene.kind, "drag_release");
  assert.equal(scene.output.lines.length, 2);
  assert.ok(f.world.snapshot().relationships.find(r => r.fromId === before.id && r.toId === other.id).affinity > 50);
});

test("encounter avoids duplicate A/B and B/A scenes and tracks directed relations", () => {
  const f = fixture();
  const [a, b] = f.world.snapshot().actors;
  f.world.startDrag(a.id); f.world.dragTo(b.position); f.world.releaseDrag();
  f.advance(1000);
  const once = f.events.filter(event => event.type === "scene" && event.kind === "encounter").length;
  f.advance(6000);
  assert.equal(f.events.filter(event => event.type === "scene" && event.kind === "encounter").length, once);
  const pairs = f.world.snapshot().relationships;
  assert.ok(pairs.some(relation => relation.fromId === a.id && relation.toId === b.id));
  assert.ok(pairs.some(relation => relation.fromId === b.id && relation.toId === a.id));
});

test("virtual mess is bounded and can be undone or cleaned", () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) f.world.addProp("note", { x: 300 + i, y: 350 });
  assert.equal(f.world.snapshot().props.length, 12);
  assert.equal(f.world.addProp("paper", { x: 200, y: 200 }), null);
  assert.equal(f.world.undoProp(), true);
  assert.equal(f.world.snapshot().props.length, 11);
  f.world.cleanDesktop();
  assert.equal(f.world.snapshot().props.length, 0);
  assert.equal(f.world.undoProp(), false);
});

test("save restores normalized positions and rejects malformed records", () => {
  const f = fixture();
  f.world.addProp("ball", { x: 450, y: 300 });
  const save = f.world.exportSave(), other = fixture();
  other.world.setBounds({ width: 1800, height: 1200 });
  assert.equal(other.world.importSave(save), true);
  assert.equal(other.world.snapshot().props[0].position.x, 900);
  const before = other.world.exportSave();
  assert.equal(other.world.importSave({ ...save, props: [{ ...save.props[0], type: "real-file" }] }), false);
  assert.equal(other.world.importSave({ ...save, relationships: save.relationships.slice(1) }), false);
  assert.equal(other.world.importSave({ ...save, relationships: [...save.relationships.slice(0, -1), save.relationships[0]] }), false);
  assert.deepEqual(other.world.exportSave(), before);
});

test("pausing prevents catch-up after a long sleep", () => {
  const f = fixture();
  f.advance(2000);
  const before = f.world.snapshot().actors.map(actor => actor.needs.energy);
  f.world.setPaused(true); f.advance(120000);
  assert.deepEqual(f.world.snapshot().actors.map(actor => actor.needs.energy), before);
  f.world.setPaused(false); f.advance(100);
  assert.ok(f.world.snapshot().actors.every(actor => actor.needs.energy >= 0));
});

test("scene validation rejects unknown speakers, unsafe text, and unapproved intents", () => {
  const input = { sceneId: "s1", kind: "encounter", actors: [{ id: "a", name: "A", vibe: "chaotic", mood: "okay" }], allowedIntents: ["greet"] };
  assert.ok(validateSceneOutput({ intent: "greet", lines: [{ speakerId: "a", text: "Hi!" }] }, input));
  assert.equal(validateSceneOutput({ intent: "delete", lines: [{ speakerId: "a", text: "Hi" }] }, input), null);
  assert.equal(validateSceneOutput({ intent: "greet", lines: [{ speakerId: "other", text: "Hi" }] }, input), null);
  assert.equal(validateSceneOutput({ intent: "greet", lines: [{ speakerId: "a", text: "<script>" }] }, input), null);
});

test("scene director limits requests and discards replies after interruption", async () => {
  let resolve, calls = 0;
  const director = new SceneDirector(() => { calls++; return new Promise(done => { resolve = done; }); });
  const input = { sceneId: "s1", kind: "encounter", actors: [{ id: "a", name: "A", vibe: "chaotic", mood: "okay" }], allowedIntents: ["greet"] };
  let current = true;
  const first = director.suggest(input, 0, () => current);
  assert.equal(await director.suggest(input, 0, () => current), null);
  current = false; resolve({ intent: "greet", lines: [{ speakerId: "a", text: "Old news" }] });
  assert.equal(await first, null);
  assert.equal(calls, 1);
  current = true;
  const second = director.suggest(input, 500, () => current);
  resolve({ intent: "greet", lines: [{ speakerId: "a", text: "Hi" }] });
  assert.ok(await second);
  assert.equal(await director.suggest(input, 1000, () => current), null);
  assert.equal(calls, 2);
});
