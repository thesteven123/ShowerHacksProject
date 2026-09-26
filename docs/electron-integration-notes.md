# Electron integration notes (Person 1 ← Person 2)

Midpoint check: mock characters load and animate using the same URLs and layout as this preview.

## Import

```ts
import {
  createCharacterFromPhoto,
  loadMockCharacters,
} from "@tiny-menaces/character-creator";
import type { FriendCharacter } from "@tiny-menaces/shared";
```

## Mocks (before photo pipeline is wired)

```ts
const roster: FriendCharacter[] = await loadMockCharacters();
// Resolve asset paths for file:// or bundled resources:
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

## Renderer

Copy or share [`apps/character-preview/src/spriteRenderer.ts`](../apps/character-preview/src/spriteRenderer.ts) for draw + hitTest. Anchor and hitbox match [`docs/sprite-handoff-person3.md`](./sprite-handoff-person3.md).

## Local verification (no Electron)

```bash
npm install
npm run generate:mocks
npm run preview
```

Open http://localhost:5174 — transparent-checker background simulates overlay; click to verify hitbox and hit/respawn clips.
