# Game mechanics — Kelvin (Person 3)

This folder owns the reusable companion/game system and the minigames: a
30-second Aim Challenge (roster prey rotation) and Soccer (hoop scoring). It
handles targets, hits/kicks, effects, score, timer, respawn, difficulty, and
results. The companion system manages personality, Friendship, Anger, XP/Level,
behavior requests, `selectFriend` for the active companion, and per-character
saved data.

## Run and test

From the repository root, `npm start` launches the Electron desktop overlay.
`Ctrl/⌘ + Shift + M` switches between passive pet and interactive mode;
`Ctrl/⌘ + Shift + Q` quits. In passive mode the transparent window ignores mouse
input. Interactive mode reveals floating controls. During a round, the panel
closes and the HUD remains. `npm test` builds and runs game tests.

`npm run preview` is an optional browser development preview. The product
integration target is the Electron app.

## Public module

Import `GameSystem` and supporting types from `src/game/index.ts`. The build
also creates `dist/game-browser/game/index.js` for the existing isolated renderer.
Electron's renderer keeps Node integration disabled.

```ts
const system = new GameSystem({
  character: mockFriends[0],
  bounds: { width: 900, height: 650 },
  onGameEvent: event => { /* existing hit and roundEnded events */ },
});
const unsubscribe = system.subscribe(event => { /* UI/reaction events */ });
system.setInteractive(true);
system.startRound("aim-challenge", "normal");
system.tick(); // On animation frames and before pointer input
system.shoot({ x: 420, y: 280 }); // Coordinates relative to the game area
const snapshot = system.snapshot();
unsubscribe();
system.destroy();
```

Register more games using `registerGame(id, () => new YourMiniGame())`.
`MiniGame` is defined in `types.ts`. The system owns character state and awards
round XP once. Each game owns its target, timing, and scoring.
`exportSave()` and `importSave()` persist personality, Friendship, Anger, and XP.
The renderer currently stores this per character in localStorage. Active rounds
reset on reload.

## Team handoffs

- Person 1: The existing Electron shell, preload roster, mode bridge, and
  shortcuts are used directly. Passive mode remains click-through.
- Person 2: `DEFAULT_SPRITE_LAYOUT` follows the supplied 72×108, 14-frame,
  feet-center v0.1 geometry and hitbox. The renderer exposes
  `window.tinyMenacesGame.setSprite(url)` for a 1008×108 transparent strip.
  Asset paths and the shared sprite field still need agreement.
- Person 4: Subscribe to system events or the renderer's
  `tiny-menaces:event` browser event to replace placeholder dialogue and add
  sound. The game retains responsibility for stat changes.
- Person 5: Read `system.snapshot()` for live values and results. The floating
  controls and results card are a working example that can be restyled or
  replaced without changing the game engine.

Creation-time personality scores (0–10) are Chaos, Brainrot, Competitive,
and Friendliness. The overlay personality sliders push live updates into both
`GameSystem` and the living world so behavior changes immediately. Friendship
and Anger are separate dynamic stats (0–100). Tunable thresholds and rewards
are in `config.ts`.

The existing shared `FriendCharacter` and `GameEvent` types are unchanged.
Additional event/stat types remain in this game module until the team agrees
on shared contract changes.

See the [game plan](../../docs/game-mechanics-plan.md), [integration
handoff](../../docs/game-mechanics-integration-handoff.md), and [sprite
contract](../../docs/game-mechanics-sprite-handoff.md).
