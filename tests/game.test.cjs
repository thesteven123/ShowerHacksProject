const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  GameSystem,
  AimChallenge,
  DEFAULT_SPRITE_LAYOUT: layout,
  hitboxFor,
  contains,
  frameFor,
  randomPersonality,
} = require("../dist/game/index.js");
const { mockFriends } = require("../dist/shared/mockFriends.js");

const personality = { chaos: 8, brainrot: 9, competitive: 6, friendliness: 7 };
function fixture() {
  let time = 0,
    seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const events = [],
    legacy = [];
  const system = new GameSystem({
    character: mockFriends[0],
    personality,
    bounds: { width: 900, height: 650 },
    random,
    now: () => time,
    onGameEvent: (e) => legacy.push(e),
  });
  system.subscribe((e) => events.push(e));
  system.setInteractive(true);
  return {
    system,
    events,
    legacy,
    advance(ms) {
      time += ms;
      system.tick();
    },
    jump(ms) {
      time += ms;
    },
    center() {
      const box = hitboxFor(system.snapshot().round.target, layout);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    },
  };
}

test("sprite v0.1 world hitbox and non-looping animation endpoints", () => {
  const box = hitboxFor({ x: 200, y: 300, scale: 2 }, layout);
  assert.deepEqual(box, { x: 136, y: 94, width: 128, height: 198 });
  assert.equal(contains({ x: 136, y: 94 }, box), true);
  assert.equal(contains({ x: 264, y: 94 }, box), false);
  assert.equal(frameFor("hit", 10000, layout), 10);
  assert.equal(frameFor("respawn", 10000, layout), 13);
  assert.equal(frameFor("idle", 1000, layout), 2);
});

test("one click means one hit; respawn blocks scoring and creates a new target", () => {
  const f = fixture();
  f.system.startRound();
  f.advance(120);
  const point = f.center(),
    old = f.system.snapshot().round.target;
  assert.equal(f.system.shoot(point), true);
  assert.equal(f.system.snapshot().state.anger, 20);
  assert.equal(f.system.shoot(point), false);
  assert.equal(f.system.snapshot().round.score, 10);
  assert.equal(f.system.snapshot().round.streak, 0);
  f.advance(520);
  assert.equal(f.system.snapshot().round.target.phase, "respawning");
  assert.equal(f.system.shoot(f.center()), false);
  f.advance(280);
  assert.equal(f.system.snapshot().round.target.phase, "active");
  assert.notEqual(f.system.snapshot().round.target.x, old.x);
  assert.equal(f.events.filter((e) => e.type === "respawn").length, 1);
  f.advance(100);
  assert.equal(f.system.shoot(f.center()), true);
  assert.deepEqual(
    f.legacy.map((e) => e.type),
    ["hit", "hit"],
  );
});

test("30-second results are accurate and reward exactly once", () => {
  const f = fixture();
  f.system.startRound();
  f.advance(100);
  f.system.shoot(f.center());
  f.system.shoot({ x: 0, y: 0 });
  f.advance(800);
  f.advance(200);
  f.system.shoot(f.center());
  f.advance(28900);
  const { result, round, state } = f.system.snapshot();
  assert.equal(round, null);
  assert.equal(result.score, 20);
  assert.equal(result.hits, 2);
  assert.equal(result.shots, 3);
  assert.equal(result.misses, 1);
  assert.equal(result.accuracy, 2 / 3);
  assert.equal(result.averageHitMs, 150);
  assert.equal(result.bestStreak, 1);
  assert.equal(state.xp, 24);
  assert.equal(state.friendship, 40);
  f.advance(30000);
  f.system.shoot({ x: 100, y: 100 });
  assert.equal(f.system.snapshot().state.xp, 24);
  assert.equal(f.events.filter((e) => e.type === "roundCompleted").length, 1);
  assert.deepEqual(f.legacy.at(-1), { type: "roundEnded", score: 20 });
});

test("late input checks the clock before allowing a shot; no-shot results are finite", () => {
  const f = fixture();
  f.system.startRound();
  const point = f.center();
  f.jump(30000);
  assert.equal(f.system.shoot(point), false);
  const result = f.system.snapshot().result;
  assert.equal(result.shots, 0);
  assert.equal(result.accuracy, null);
  assert.equal(result.averageHitMs, null);
  assert.equal(result.score, 0);
});

test("mode exit aborts without XP, prevents input, and restart clears round state", () => {
  const f = fixture();
  f.system.startRound();
  f.system.shoot(f.center());
  f.system.setInteractive(false);
  f.advance(50000);
  assert.equal(f.system.snapshot().state.xp, 0);
  assert.equal(f.system.snapshot().result, null);
  assert.equal(f.system.startRound(), false);
  assert.equal(f.system.perform("pet").accepted, false);
  assert.equal(f.events.filter((e) => e.type === "roundEnded").length, 0);
  f.system.setInteractive(true);
  assert.equal(f.system.startRound(), true);
  assert.equal(f.system.snapshot().round.score, 0);
  assert.equal(f.system.snapshot().round.remainingMs, 30000);
});

test("petting has cooldown, unlocks companionship, levels up and unlocks bark", () => {
  const f = fixture();
  const saved = f.system.exportSave();
  saved.xp = 48;
  saved.friendship = 45;
  assert.equal(f.system.importSave(saved), true);
  assert.equal(f.system.perform("bark").accepted, false);
  assert.equal(f.system.perform("pet").accepted, true);
  assert.equal(f.system.perform("pet").accepted, false);
  assert.equal(f.system.snapshot().state.friendship, 50);
  assert.equal(f.system.snapshot().state.level, 2);
  assert.equal(f.system.perform("bark").accepted, true);
  assert.equal(f.system.perform("bark").accepted, false);
  f.advance(2000);
  assert.equal(f.system.perform("pet").accepted, true);
  assert.deepEqual(f.events.find((e) => e.type === "levelUp").unlocked, [
    "bark",
  ]);
});

test("persistent pet data survives round abort and validates imports atomically", () => {
  const f = fixture();
  f.system.setPersonality({ ...personality, chaos: 2 });
  const saved = f.system.exportSave(),
    g = fixture();
  assert.equal(g.system.importSave(saved), true);
  assert.deepEqual(g.system.exportSave(), saved);
  for (const bad of [
    null,
    {},
    { ...saved, version: 2 },
    { ...saved, characterId: "other" },
    { ...saved, xp: -1 },
    { ...saved, friendship: NaN },
    { ...saved, personality: { ...personality, chaos: 11 } },
  ]) {
    assert.equal(g.system.importSave(bad), false);
    assert.deepEqual(g.system.exportSave(), saved);
  }
  g.system.startRound();
  assert.equal(g.system.setPersonality(personality), false);
  assert.equal(g.system.importSave(saved), false);
});

test("difficulty scale, small viewport bounds, and resizing preserve valid targets", () => {
  for (const difficulty of ["easy", "normal", "hard"]) {
    const f = fixture();
    f.system.startRound("aim-challenge", difficulty);
    const scale = f.system.snapshot().round.target.scale;
    assert.equal(scale, { easy: 1.4, normal: 1.1, hard: 0.8 }[difficulty]);
    f.system.setBounds({ width: 35, height: 50 });
    f.advance(2000);
    const box = hitboxFor(f.system.snapshot().round.target, layout);
    assert.ok(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= 35 &&
        box.y + box.height <= 50,
    );
    f.system.setBounds({ width: 900, height: 650 });
    assert.equal(f.system.snapshot().round.target.scale, scale);
  }
});

test("taunt bonus is visible in target state and anger remains bounded", () => {
  const f = fixture();
  f.system.startRound();
  f.advance(4000);
  assert.equal(f.system.snapshot().round.target.taunting, true);
  f.system.shoot(f.center());
  assert.equal(f.system.snapshot().round.score, 15);
  for (let i = 0; i < 9; i++) {
    f.advance(900);
    f.system.shoot(f.center());
  }
  assert.equal(f.system.snapshot().state.anger, 100);
  f.system.abortRound();
  f.advance(200000);
  assert.equal(f.system.snapshot().state.anger, 0);
});

test("random traits are independent bounded integers and snapshots do not mutate state", () => {
  assert.deepEqual(
    randomPersonality(() => 0),
    { chaos: 0, brainrot: 0, competitive: 0, friendliness: 0 },
  );
  assert.deepEqual(
    randomPersonality(() => 0.9999),
    { chaos: 10, brainrot: 10, competitive: 10, friendliness: 10 },
  );
  const f = fixture();
  const snapshot = f.system.snapshot();
  snapshot.state.xp = 10000;
  snapshot.personality.chaos = 100;
  assert.equal(f.system.snapshot().state.xp, 0);
  assert.equal(f.system.snapshot().personality.chaos, 8);
});

test("a second registered game runs through the same lifecycle and events", () => {
  const f = fixture();
  class AnotherClickGame extends AimChallenge {
    id = "another-click-game";
  }
  f.system.registerGame("another-click-game", () => new AnotherClickGame());
  assert.equal(f.system.startRound("another-click-game", "easy"), true);
  f.system.shoot(f.center());
  f.advance(30000);
  assert.equal(f.system.snapshot().result.gameId, "another-click-game");
  assert.equal(f.legacy.filter((e) => e.type === "roundEnded").length, 1);
  f.system.destroy();
  assert.equal(f.system.startRound(), false);
});
