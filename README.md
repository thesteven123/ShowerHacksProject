# Tiny Menaces

Your group chat escaped onto your desktop. The Electron app opens a transparent
overlay with a small group of autonomous desktop friends. The first minigame is
a playable 30-second Aim Challenge, backed by a reusable character state and
minigame system.

## Run the desktop app

Requires Node.js 22.12 or newer.

```sh
npm ci
npm start
```

- `Ctrl+Shift+M` / `⌘+Shift+M`: switch between passive pet and interactive mode.
  Passive mode keeps the desktop usable while allowing you to drag a pet directly.
- In interactive mode, drag a friend to interrupt their activity and trigger
  dialogue, drop a virtual ball, undo or clear virtual props, pet the first
  friend, edit four personality scores, or start the Aim Challenge. During a
  round the panel closes; a HUD tracks time, score, streak, and accuracy. A
  floating results card appears after 30 seconds.
- `Ctrl+Shift+Q` / `⌘+Shift+Q`: quit.

The window currently covers the primary display's work area. If another app
already claims a shortcut, Electron logs a warning; its constants are near
the top of `src/electron/main.ts`.

The current companion demo uses the three-friend mock roster; Aim Challenge
uses the first friend. Photo upload, full sprites, character-specific reactions,
and sounds remain teammates' integration work. Personality, progression, and
the living world are saved locally; unfinished rounds do not resume after a
restart. Dialogue has an offline fallback and no remote AI provider configured.

## Work areas

- **Desktop shell (Steven):** `src/electron/` owns the transparent window,
  shortcuts, click-through, and preload bridge.
- **Character creator:** `src/characters/` will supply character assets and
  records. The game accepts the existing `FriendCharacter` type.
- **Game mechanics (Kelvin):** `src/game/` owns the companion progression and
  Aim Challenge; `src/simulation/` owns the multi-friend living world. See the
  [game handoff](src/game/README.md) and [simulation handoff](src/simulation/README.md).
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
