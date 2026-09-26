# Tiny Menaces

Your group chat escaped onto your desktop. Tiny Menaces is a transparent, always-on-top Electron overlay: real photo-limb friends wander, talk, and play a 30-second Aim Challenge.

## Run it

Requires Node.js 22.12 or newer.

```sh
npm install
npm start
```

- `Ctrl+Shift+M` / `⌘+Shift+M`: toggle interactive mode. Quiet mode keeps the desktop usable; you can still drag a pet.
- `Ctrl+Shift+Q` / `⌘+Shift+Q`: quit.

There is no normal app window. After `npm start`, look on the **monitor where the mouse is**. Clicks pass through except on pets until interactive mode is on. Check the taskbar/dock for `tiny-menaces`.

`npm start` compiles the main process and game modules, copies `src/ui/` plus Person 2's built photos into `dist/`, then launches Electron.

## Roster and sprites

Friends come from Person 2's `packages/character-creator/data/characters.json` (Kelvin, Maanya, Philip, Steven). Each has:

- `imageUrl` — face portrait
- `sprite` — 14-frame 72×108 sheet for Person 3
- `limbs` — photo crops for head / torso / arms / legs on the overlay figures

Maanya does the 6-7 dance. Reactions fill in stub quotes.

## Reactions

Person 3 emits `hit` / `idle` / `respawn` / `roundEnded`. Person 4's engine in `src/reactions/` returns the line, antic, effect, and sound:

```ts
import { getReaction } from "./src/reactions";

const reaction = getReaction(character, "hit");
```

The overlay also calls this over IPC (`reactions:get`). Quote search is local and works without Moss keys.

## Workstream seams

- **Electron shell:** `src/electron/` — window, shortcuts, click-through, roster/reaction IPC.
- **Character creator:** `packages/character-creator/` — photo limbs and sprite sheets.
- **Game mechanics:** `src/game/` — companion state and Aim Challenge.
- **Living world:** `src/simulation/` — multi-friend desktop wander.
- **Reactions:** `src/reactions/` — `getReaction`, antics, sounds, local quote search.
- **Interface:** `src/ui/` — overlay HUD, pets, and world layer.

## Checks

```sh
npm run typecheck
npm test
```

`npm run preview` is a browser test page for Person 3's UI. `dist/` and `node_modules/` are generated and ignored by Git.
