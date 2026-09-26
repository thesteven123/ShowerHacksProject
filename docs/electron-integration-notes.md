# Electron integration notes (Person 1 ← Person 2)

Midpoint check: **Steven** (roster id `steven`) loads and animates using the same URLs and layout as `npm run preview`. Mocks are optional for hitbox-only testing.

## Import

```ts
import {
  createCharacterFromPhoto,
  loadRosterCharacters,
  loadMockCharacters,
} from "@tiny-menaces/character-creator";
import type { FriendCharacter } from "@tiny-menaces/shared";
```

## Roster (golden path — use this first)

```ts
const roster: FriendCharacter[] = await loadRosterCharacters();
// JSON paths look like /built/steven/steven-sheet.png — resolve to:
// packages/character-creator/assets/built/steven/steven-sheet.png
// (or bundled equivalent in the packaged app)
```

Reference assets on disk: [`packages/character-creator/assets/built/steven/`](../packages/character-creator/assets/built/steven/).

## Dev mocks (optional)

```ts
const mocks: FriendCharacter[] = await loadMockCharacters();
// mock JSON uses /mocks/... — map to packages/character-creator/assets/mocks/
```

## Photo → character

```ts
const buffer = await fs.readFile(filePath);
const character = await createCharacterFromPhoto(buffer, {
  name: "Casey",
  vibe: "chaotic",
  outputDir: path.join(app.getPath("userData"), "characters"),
  publicPathPrefix: `file://${path.join(app.getPath("userData"), "characters")}/`,
});
```

For the **two-photo + lasso** pipeline (same as Steven), use the CLI from [`builder-part-crops.md`](./builder-part-crops.md) or `createCharacterFromFaceCrop` with `bodyMode: "photo"`.

## Renderer

Copy or share [`apps/character-preview/src/spriteRenderer.ts`](../apps/character-preview/src/spriteRenderer.ts) for draw + hitTest. Anchor and hitbox match [`docs/sprite-handoff-person3.md`](./sprite-handoff-person3.md).

## Local verification (no Electron)

```bash
npm install
npm run verify:preview
npm run preview
```

Open http://localhost:5174 — preview selects **Steven** by default; transparent-checker background simulates overlay; click to verify hitbox and hit/respawn clips.
