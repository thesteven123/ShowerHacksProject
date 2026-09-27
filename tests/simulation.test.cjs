const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DesktopWorld, SceneDirector, offlineScene, validateSceneOutput } = require("../dist/simulation/index.js");
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
  assert.ok(snapshot.props.every(prop => prop.type === "ball"));
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

test("encounter dialogue expires and friends resume autonomous activities", () => {
  const world = new DesktopWorld({ friends: mockFriends.slice(0, 2), bounds: { width: 180, height: 200 }, random: () => 0.5 });
  world.tick(0);
  for (let now = 100; now <= 200; now += 100) world.tick(now);
  assert.equal(world.snapshot().scene?.kind, "encounter");
  assert.ok(world.snapshot().actors.every(actor => actor.activity === "talk"));
  for (let now = 300; now <= 5000; now += 100) world.tick(now);
  assert.equal(world.snapshot().scene, null);
  assert.ok(world.snapshot().actors.every(actor => actor.activity !== "talk"));
});

test("offline dialogue varies instead of repeating one greeting", () => {
  const scene = {
    kind: "encounter",
    actors: [{ id: "a", name: "Alex", vibe: "chaotic", mood: "okay" }, { id: "b", name: "Blair", vibe: "dramatic", mood: "okay" }],
    allowedIntents: ["greet", "tease", "invite"],
  };
  const lines = [1, 2, 3].map(number => offlineScene({ ...scene, sceneId: `scene-${number}` }).lines[0].text);
  assert.equal(new Set(lines).size, 3);
  assert.ok(lines.every(line => !line.startsWith("Hey")));
});

test("dropped balls fall with gravity and settle on the floor", () => {
  const friend = mockFriends[0];
  const world = new DesktopWorld({
    friends: [friend], bounds: { width: 900, height: 600 }, random: () => 0.5,
    personalities: { [friend.id]: { chaos: 0, brainrot: 0, competitive: 0, friendliness: 5 } },
  });
  world.startDrag(friend.id);
  world.dragTo({ x: 80, y: 200 });
  world.releaseDrag();
  const ball = world.addProp("ball", { x: 700, y: 60 });
  assert.ok(ball);
  const startY = ball.position.y;
  let now = 0;
  world.tick(now);
  for (; now < 2500; now += 100) world.tick(now);
  const after = world.snapshot().props[0];
  assert.ok(after.position.y > startY);
  assert.ok(after.position.y >= world.snapshot().bounds.height * 0.7);
  for (; now <= 6000; now += 100) world.tick(now);
  const settled = world.snapshot().props[0];
  assert.ok(Math.abs(settled.velocity.y) < 25);
  assert.ok(settled.position.y >= world.snapshot().bounds.height - 40);
});

test("friends separate when they walk into each other", () => {
  const world = new DesktopWorld({ friends: mockFriends.slice(0, 2), bounds: { width: 900, height: 600 }, random: () => 0.5 });
  world.tick(0);
  const [a, b] = world.snapshot().actors;
  world.startDrag(a.id);
  world.dragTo({ x: 400, y: 400 });
  world.releaseDrag();
  world.startDrag(b.id);
  world.dragTo({ x: 405, y: 400 });
  world.releaseDrag();
  for (let now = 100; now <= 5000; now += 100) world.tick(now);
  const later = world.snapshot().actors;
  assert.ok(Math.hypot(later[0].position.x - later[1].position.x, later[0].position.y - later[1].position.y) >= 60);
});

test("a walking friend kicks a nearby ball", () => {
  const friend = mockFriends[0];
  const world = new DesktopWorld({
    friends: [friend], bounds: { width: 900, height: 600 }, random: () => 0.5,
    personalities: { [friend.id]: { chaos: 10, brainrot: 0, competitive: 0, friendliness: 5 } },
  });
  world.addProp("ball", { x: 450, y: 500 });
  world.tick(0);
  world.startDrag(friend.id);
  world.dragTo({ x: 450, y: 500 });
  world.releaseDrag();
  for (let now = 100; now <= 2000; now += 100) world.tick(now);
  const ball = world.snapshot().props[0];
  assert.ok(Math.hypot(ball.velocity.x, ball.velocity.y) > 40 || Math.hypot(ball.position.x - 450, ball.position.y - 500) > 20);
});

test("kicks cool down instead of machine-gunning the ball", () => {
  const friend = mockFriends[0];
  const world = new DesktopWorld({
    friends: [friend], bounds: { width: 900, height: 600 }, random: () => 0.5,
    personalities: { [friend.id]: { chaos: 0, brainrot: 0, competitive: 10, friendliness: 5 } },
  });
  const kicks = [];
  world.subscribe(event => { if (event.type === "ballKicked") kicks.push(event); });
  world.addProp("ball", { x: 450, y: 400 });
  world.tick(0);
  world.startDrag(friend.id);
  world.dragTo({ x: 450, y: 400 });
  world.releaseDrag();
  for (let now = 100; now <= 700; now += 100) world.tick(now);
  assert.ok(kicks.length >= 1);
  assert.ok(kicks.length <= 3);
});

test("companion worlds do not score hoop goals unless goalsEnabled", () => {
  const friend = mockFriends[0];
  const world = new DesktopWorld({
    friends: [friend], bounds: { width: 900, height: 600 }, random: () => 0.5,
    personalities: { [friend.id]: { chaos: 0, brainrot: 0, competitive: 10, friendliness: 5 } },
  });
  assert.equal(world.snapshot().hoop, null);
  assert.equal(world.goalsAreEnabled(), false);
  const goals = [];
  world.subscribe(event => { if (event.type === "goalScored") goals.push(event); });
  world.addProp("ball", { x: 860, y: 40 });
  world.tick(0);
  for (let now = 100; now <= 3000; now += 100) world.tick(now);
  assert.equal(goals.length, 0);
  assert.equal(world.snapshot().score, 0);
});

test("goal mode scores when a ball enters the hoop", () => {
  const friend = mockFriends[0];
  const world = new DesktopWorld({
    friends: [friend], bounds: { width: 900, height: 600 }, random: () => 0.5, goalsEnabled: true,
    personalities: { [friend.id]: { chaos: 0, brainrot: 0, competitive: 10, friendliness: 5 } },
  });
  assert.ok(world.snapshot().hoop);
  const hoop = world.snapshot().hoop;
  const goals = [];
  world.subscribe(event => { if (event.type === "goalScored") goals.push(event); });
  const cx = hoop.x + hoop.width / 2;
  const cy = hoop.y + hoop.height / 2;
  const ball = world.addProp("ball", { x: cx, y: cy + 10 });
  assert.ok(ball);
  assert.equal(world.impulseBall(ball.id, { x: -20, y: -120 }), true);
  world.tick(0);
  for (let now = 16; now <= 400; now += 16) world.tick(now);
  assert.equal(goals.length, 1);
  assert.equal(world.snapshot().score, 1);
});

test("virtual balls are bounded and can be undone or cleaned", () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) f.world.addProp("ball", { x: 300 + i, y: 350 });
  assert.equal(f.world.snapshot().props.length, 12);
  assert.equal(f.world.addProp("ball", { x: 200, y: 200 }), null);
  assert.equal(f.world.undoProp(), true);
  assert.equal(f.world.snapshot().props.length, 11);
  f.world.cleanDesktop();
  assert.equal(f.world.snapshot().props.length, 0);
  assert.equal(f.world.undoProp(), false);
});

test("autonomous friends do not produce pranks or decorations", () => {
  const friend = mockFriends[0];
  const world = new DesktopWorld({ friends: [friend], bounds: { width: 900, height: 600 }, random: () => 0.5 });
  world.tick(0);
  for (let now = 100; now <= 21000; now += 100) world.tick(now);
  assert.equal(world.snapshot().props.length, 0);
  assert.ok(world.snapshot().actors.every(actor => actor.activity !== "prank"));
});

test("old saved decorations are discarded while character state survives", () => {
  const f = fixture();
  assert.equal(f.world.addProp("note", { x: 300, y: 300 }), null);
  const save = f.world.exportSave();
  save.props.push({ id: "prop-99", type: "note", xRatio: 0.5, yRatio: 0.5, createdAt: 0, createdBy: "demo-alex" });
  assert.equal(f.world.importSave(save), true);
  assert.equal(f.world.snapshot().props.length, 0);
  assert.equal(f.world.snapshot().actors.length, 3);
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

test("turning brainrot up to 10 parks the group until it comes back down", () => {
  const [alex, blair] = mockFriends;
  const calm = { chaos: 10, brainrot: 0, competitive: 0, friendliness: 0 };
  const world = new DesktopWorld({
    friends: [alex, blair],
    bounds: { width: 900, height: 600 },
    random: () => 0.5,
    personalities: { [alex.id]: calm, [blair.id]: { ...calm } },
  });
  world.tick(0);
  for (let now = 100; now <= 5000; now += 100) world.tick(now);
  const moving = world.snapshot().actors.map(actor => ({ ...actor.position }));
  assert.equal(world.setPersonality(alex.id, { ...calm, brainrot: 10 }), true);
  for (let now = 5100; now <= 8000; now += 100) world.tick(now);
  const parked = world.snapshot().actors;
  assert.ok(parked.every(actor => actor.activity === "idle"));
  parked.forEach((actor, index) => {
    assert.ok(Math.hypot(actor.position.x - moving[index].x, actor.position.y - moving[index].y) < 5);
  });
  assert.equal(world.setPersonality(alex.id, calm), true);
  for (let now = 8100; now <= 12000; now += 100) world.tick(now);
  const resumed = world.snapshot().actors[0];
  assert.ok(Math.hypot(resumed.position.x - parked[0].position.x, resumed.position.y - parked[0].position.y) > 8);
});

test("max chaos sends a friend ricocheting across the room", () => {
  const friend = mockFriends[0];
  const world = new DesktopWorld({
    friends: [friend], bounds: { width: 900, height: 600 }, random: () => 0.5,
    personalities: { [friend.id]: { chaos: 10, brainrot: 0, competitive: 0, friendliness: 5 } },
  });
  world.tick(0);
  const start = { ...world.snapshot().actors[0].position };
  for (let now = 100; now <= 2500; now += 100) world.tick(now);
  const later = world.snapshot().actors[0];
  assert.equal(later.activity, "walk");
  assert.ok(Math.hypot(later.position.x - start.x, later.position.y - start.y) > 120);
});

test("max competitive locks onto the ball", () => {
  const friend = mockFriends[0];
  const world = new DesktopWorld({
    friends: [friend], bounds: { width: 900, height: 600 }, random: () => 0.5,
    personalities: { [friend.id]: { chaos: 0, brainrot: 0, competitive: 10, friendliness: 5 } },
  });
  const kicks = [];
  world.subscribe(event => { if (event.type === "ballKicked") kicks.push(event); });
  world.addProp("ball", { x: 700, y: 500 });
  world.tick(0);
  world.startDrag(friend.id);
  world.dragTo({ x: 180, y: 420 });
  world.releaseDrag();
  for (let now = 100; now <= 9000; now += 100) world.tick(now);
  assert.equal(world.snapshot().actors[0].activity, "play");
  assert.ok(kicks.some(kick => kick.strength > 400));
});

test("max friendliness closes the gap and zero friendliness keeps it open", () => {
  const [alex, blair] = mockFriends;
  const close = new DesktopWorld({
    friends: [alex, blair], bounds: { width: 900, height: 600 }, random: () => 0.5,
    personalities: {
      [alex.id]: { chaos: 0, brainrot: 0, competitive: 0, friendliness: 10 },
      [blair.id]: { chaos: 0, brainrot: 0, competitive: 0, friendliness: 4 },
    },
  });
  close.tick(0);
  close.startDrag(alex.id); close.dragTo({ x: 140, y: 400 }); close.releaseDrag();
  close.startDrag(blair.id); close.dragTo({ x: 760, y: 400 }); close.releaseDrag();
  for (let now = 100; now <= 12000; now += 100) close.tick(now);
  const [a, b] = close.snapshot().actors;
  assert.ok(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) < 420);

  const apart = new DesktopWorld({
    friends: [alex, blair], bounds: { width: 900, height: 600 }, random: () => 0.5,
    personalities: {
      [alex.id]: { chaos: 2, brainrot: 0, competitive: 0, friendliness: 0 },
      [blair.id]: { chaos: 2, brainrot: 0, competitive: 0, friendliness: 0 },
    },
  });
  const scenes = [];
  apart.subscribe(event => { if (event.type === "scene" && event.kind === "encounter") scenes.push(event); });
  apart.tick(0);
  apart.startDrag(alex.id); apart.dragTo({ x: 420, y: 400 }); apart.releaseDrag();
  apart.startDrag(blair.id); apart.dragTo({ x: 490, y: 400 }); apart.releaseDrag();
  for (let now = 100; now <= 8000; now += 100) apart.tick(now);
  const [left, right] = apart.snapshot().actors;
  assert.ok(Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y) > 160);
  assert.equal(scenes.length, 0);
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
