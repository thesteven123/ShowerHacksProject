# Tiny Menaces

Your group chat escaped onto your desktop. The Electron app opens a transparent
overlay with one wandering pet. The first minigame is a playable 30-second Aim
Challenge, backed by a reusable character state and minigame system.

## Run the desktop app

Requires Node.js 22.12 or newer.

```sh
npm ci
npm start
```

- `Ctrl+Shift+M` / `⌘+Shift+M`: switch between passive pet and interactive mode.
  Passive mode shows the pet and lets mouse clicks pass through to the desktop.
- In interactive mode, floating controls allow petting, editing four personality
  scores, and starting the Aim Challenge. During a round the panel closes; a
  HUD tracks time, score, streak, and accuracy. A floating results card appears
  after 30 seconds.
- `Ctrl+Shift+Q` / `⌘+Shift+Q`: quit.

The window currently covers the primary display's work area. If another app
already claims a shortcut, Electron logs a warning; its constants are near
the top of `src/electron/main.ts`.

The current demo uses one member of the three-friend mock roster. Photo upload,
real sprites, reactions, and sounds remain teammates' integration work. The
character's personality and progression are saved locally; unfinished rounds
do not resume after a restart.

## Work areas

- **Desktop shell (Steven):** `src/electron/` owns the transparent window,
  shortcuts, click-through, and preload bridge.
- **Character creator:** `src/characters/` will supply character assets and
  records. The game accepts the existing `FriendCharacter` type.
- **Game mechanics (Kelvin):** `src/game/` owns the companion system, Aim
  Challenge, hit detection, stats, and events. See its [handoff](src/game/README.md).
- **Reactions:** `src/reactions/` can consume game events to select dialogue
  and effects.
- **Interface:** `src/ui/` has working floating desktop controls that can be
  refined using game state snapshots.
- **Shared types and mocks:** `src/shared/` remains the existing team contract.

## Checks

```sh
npm run typecheck
npm test
```

`npm run preview` provides an optional browser test page for quick UI iteration.
The delivered game runs through `npm start` in Electron. `dist/` and
`node_modules/` are generated and ignored by Git.
