# Tiny Menaces

A small Electron starter for the hackathon setup block: a transparent desktop overlay, a system-wide game-mode toggle, and typed placeholder friends. Gameplay, photo uploads, reactions, and sponsor integrations are intentionally not implemented here.

## Run it

Requires Node.js 22.12 or newer.

```sh
npm install
npm start
```

- `Ctrl+Shift+M` / `⌘+Shift+M`: toggle game mode. Normal mode ignores mouse input so the desktop remains usable; game mode accepts input.
- `Ctrl+Shift+Q` / `⌘+Shift+Q`: quit.

The overlay currently covers the primary display's work area. If either system shortcut is already claimed by another app, Electron logs a warning; change the constants near the top of `src/electron/main.ts`.

## Shared contract

`src/shared/types.ts` defines `FriendCharacter` (`id`, `name`, `imageUrl`, `vibe`, and `quotes.idle/hit/respawn`) and `GameEvent` (`hit` with a `characterId`, or `roundEnded` with a `score`). `src/shared/mockFriends.ts` supplies three made-up demo friends with no photo dependency. The safe preload bridge exposes the roster to the renderer; replace the mock roster with the character creator's output when that workstream is ready.

## Workstream seams

- **Electron shell / setup (Steven):** `src/electron/` owns the transparent window, shortcuts, and preload bridge.
- **Character creator:** add its implementation under `src/characters/`; return `FriendCharacter[]` and provide `imageUrl` values. The current UI already falls back to initials when an image is absent.
- **Game mechanics:** add logic under `src/game/`; consume the shared roster and produce `GameEvent`s. The scaffold deliberately does not implement shooting, scoring, or collision detection.
- **Reactions:** add logic under `src/reactions/`; consume a character plus a game event and return the reaction content/effect.
- **Interface:** `src/ui/` currently renders the mode label and demo characters; extend it with setup, HUD, and end-screen surfaces, consuming the shared types rather than duplicating them.

## Checks

```sh
npm run typecheck
npm run build
```

`npm start` builds the TypeScript main process and copies the UI files into `dist/` before launching Electron. `dist/` and `node_modules/` are generated and ignored by Git.
