# Tiny Menaces

Your group chat escaped onto your desktop. Tiny Menaces is a transparent, always-on-top Electron overlay: three full-body gremlins wander the screen, react to game events, and (if they're chaotic) do the 6-7 dance.

Gameplay, photo uploads, and live Moss search are still other workstreams. The Electron shell, shared types, mock roster, CSS sprites, and reaction engine are in place.

## Run it

Requires Node.js 22.12 or newer.

```sh
npm install
npm start
```

- `Ctrl+Shift+M` / `⌘+Shift+M`: toggle game mode. Normal mode ignores mouse input so the desktop stays usable; game mode accepts clicks.
- `Ctrl+Shift+Q` / `⌘+Shift+Q`: quit.

There is no normal app window. After `npm start`, look on the **monitor where the mouse is** for:

- a dark pill in the top-left that says `TINY MENACES`
- three small full-body figures (orange / purple / green), about 88×148 px

Clicks pass through until game mode is on, so it can feel like nothing launched. Check the taskbar/dock for `tiny-menaces`. If either shortcut is already claimed, Electron logs a warning; change the constants at the top of `src/electron/main.ts`.

`npm start` compiles the TypeScript main process, copies `src/ui/` into `dist/ui/`, then launches Electron. `dist/` and `node_modules/` are generated and ignored by Git.

If a teammate still sees nothing: `git pull` on `main`, Node 22.12+, then `npm install` and `npm start` (not `electron .` alone). Quit with `Ctrl+Shift+Q` before starting again.

## Overlay characters

The renderer draws unnamed CSS stick figures (no nameplates, no photo backgrounds). Each `.figure` is:

- `head` with `eye` (`left` / `right`) and `mouth`
- `torso` with `arm` (`left` / `right`) → `elbow` → `forearm` → `hand`
- `legs` with `leg` (`left` / `right`) → `foot`

Alex (chaotic, orange) does the 6-7 dance: shoulders stay put, elbows angle out, palms stay horizontal, and a bubble chants "six" / "seven". Blair (dramatic, purple) and Casey (supportive, green) idle-walk.

## Shared contract

`src/shared/types.ts` is the source of truth:

- `FriendCharacter`: `id`, `name`, `imageUrl`, `vibe` (`chaotic` | `dramatic` | `supportive`), and `quotes.idle/hit/respawn`
- `GameEvent`: `idle`, `hit`, or `respawn` with a `characterId`, or `roundEnded` with a `score`
- `Reaction`: `line`, `antic`, `effect`, `sound`, and `source`

`src/shared/mockFriends.ts` is the demo roster the overlay loads over IPC (`friends:list`). Swap it for the character creator's output when that workstream is ready.

## Reactions

Person 3 emits `hit` / `idle` / `respawn` / `roundEnded`. Person 4's engine in `src/reactions/` returns the line, antic, effect, and sound:

```ts
import { createReactionEngine, getReaction } from "./src/reactions";

const reaction = getReaction(character, "hit");
// reaction.line, reaction.antic, reaction.effect, reaction.sound
```

Quote search is local and works without Moss keys. Optional Moss hooks live in `src/reactions/mossSearch.ts` for later.

## Workstream seams

- **Electron shell:** `src/electron/` owns the transparent window, shortcuts, and preload bridge.
- **Character creator:** add photo upload/crop under `src/characters/`; return `FriendCharacter[]`. The overlay currently uses CSS bodies, not `imageUrl`.
- **Game mechanics:** add aiming, hits, scoring, and respawn under `src/game/`; emit `GameEvent`s from the shared types.
- **Reactions:** `src/reactions/` is implemented (`getReaction`, `createReactionEngine`, antics, sounds, local quote search).
- **Interface:** `src/ui/` renders the overlay sprites and mode label. Setup, HUD, and end-screen surfaces still need to be added here.

## Checks

```sh
npm run typecheck
npm run build
```
