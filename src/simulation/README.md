# Living desktop simulation — Kelvin (Person 3)

`DesktopWorld` runs several friends in the existing Electron overlay. It is the
companion mode around the 30-second Aim Challenge; the challenge still uses
`GameSystem` in `src/game/`. The browser preview uses the same renderer for
iteration, but `npm start` is the desktop deliverable.

## What works now

- Each friend has four creation-time personality scores (Chaos, Brainrot,
  Competitive, Friendliness, each 0–10), local needs/mood (0–100), an activity,
  and a feet-center position in the arena.
- A fixed 100 ms local simulation chooses walk, read, rest, play (when a virtual
  ball exists), or prank. Needs and personality influence choices. Only the
  simulation changes positions, relationships, and virtual props.
- Close friends can meet and exchange a short offline dialogue. Relationships
  are directional, and proximity hysteresis plus a cooldown prevent repeated
  encounters. Dragging interrupts the current activity immediately; releasing
  a friend produces a reply. All visible dialogue works without network access.
- Props exist only inside the app overlay. The UI can drop a ball, undo the
  latest virtual prop, or clear all props. There is a 12-prop cap; no desktop
  file is created, moved, or deleted.
- The world pauses during Aim Challenge and resumes afterward. Saves are
  validated and stored locally with normalized positions so display resizing
  does not break the layout. A suspended computer does not cause hours of
  catch-up simulation.

## Engine API and handoff

Import `DesktopWorld`, `SceneDirector`, and types from `src/simulation/index.ts`.
The browser build exports the same modules under `dist/game-browser/simulation/`.

```ts
const world = new DesktopWorld({
  friends, // FriendCharacter[] from the shared roster
  bounds: { width: 900, height: 650 },
  personalities: { [friends[0].id]: { chaos: 8, brainrot: 7,
    competitive: 6, friendliness: 8 } },
});
const unsubscribe = world.subscribe(event => { /* render or react */ });
world.tick(performance.now()); // each animation frame
world.startDrag(friends[0].id);
world.dragTo({ x: 300, y: 400 });
world.releaseDrag();
world.addProp("ball", { x: 450, y: 500 });
const snapshot = world.snapshot();
const save = world.exportSave();
world.importSave(save);
unsubscribe();
```

The UI adapter is `src/ui/living-world.js`. It exposes the world as
`window.tinyMenacesGame.world` for integration and testing. Coordinates and
props are relative to `#arena`. Electron's passive mode remains click-through;
the area around each visible friend accepts dragging even in passive mode.
`window.tinyMenacesGame.speak(actorId, text)` displays a short line above the
matching friend, which Person 4 can use for reactions. Use `Ctrl/⌘ + Shift + M`
to open the other controls. The renderer pauses the world
while a minigame is active.

`WorldEvent` reports activities, interruptions, scenes, and prop changes.
`WorldSnapshot` is a cloned read model; the UI should not mutate it. A scene
contains only dialogue from its participants. The local simulation creates a
reply immediately. `SceneDirector` optionally accepts **one shared**
`SceneProvider(scene, abortSignal)` for alternative dialogue. It permits one
request in flight, at most two requests per simulation minute, a 5-second
abort, and only short validated replies from known speakers. A reply to a scene
that has since changed is discarded. No provider, API key, or cloud endpoint is
configured in this branch, so offline dialogue is always available.

Person 1 can keep the world in the existing Electron renderer and expose a
secure main-process bridge if a remote provider is later added. Person 2 can
replace the CSS figures with each friend's actual sprite while keeping the
feet-center position and shared character IDs. Person 4 can use `WorldEvent`
and the scene output to supply character-specific text, animation, and sound.
Person 5 can restyle `src/ui/living-world.js` and the floating controls, and
can use `snapshot()` for a roster or relationship display. The first friend's
existing `GameSystem` stats remain separate from world needs/mood for now;
there is no automatic conversion between them.

## Scope of this version

The simulation has deterministic local behavior, not a general AI agent. It
does not inspect other apps or the desktop, and it has no remote AI connection.
The visible friends currently use image crops with CSS bodies; future sprite
clips for reading, playing, or interacting require Person 2's assets. Only the
first friend enters Aim Challenge. The other friends remain companion actors.

Run `npm run typecheck` and `npm test` from the repository root.
