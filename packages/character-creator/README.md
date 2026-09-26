# @tiny-menaces/character-creator

Person 2 package: photo → `FriendCharacter` + sprite sheets. No Electron dependency.

## API

- `createCharacterFromPhoto(photoBuffer, options)` — full photo → center crop → portrait + sheet (random UUID filenames).
- `createCharacterFromFaceCrop(faceBuffer, options)` — pre-cropped face: **scale only** (no extract), stable `id` / filenames.
- `loadMockCharacters()` — three fake friends for parallel dev.
- `cropFace`, `styleFace`, `buildSpriteSheet` — lower-level steps.

## Mocks

```bash
npm run generate:mocks -w @tiny-menaces/character-creator
```

## Face crop → avatar (deterministic)

From repo root:

### Kelvin (repeat workflow)

Re-run after pipeline or source crop changes. Uses **bbox** framing (default), writes the **canonical** `built/kelvin/` paths that `mockCharacters.json` already references, and refreshes `pipeline/` debug PNGs.

```bash
npm run face-crop:avatar -- packages/character-creator/assets/sources/kelvin --slug kelvin
```

Outputs:

- `packages/character-creator/assets/built/kelvin/kelvin-portrait.png`
- `packages/character-creator/assets/built/kelvin/kelvin-sheet.png`
- `packages/character-creator/assets/built/kelvin/kelvin.json`
- `packages/character-creator/assets/built/kelvin/pipeline/` (scaled, portrait, sheet, `1b-subject-bbox.png`)

Preview in the browser (repo root, then hard refresh **http://localhost:5174**):

```bash
npm run preview
```

Pick **Kelvin** in the roster dropdown. Do not run `generate:mocks` afterward — it rebuilds procedural mocks and does not refresh Kelvin.

### Other sources / framing

```bash
# Default slug is kelvin-bbox (folder name + framing suffix) — not wired into mock roster
npm run face-crop:avatar -- packages/character-creator/assets/sources/kelvin

npm run face-crop:avatar -- packages/character-creator/assets/sources/kelvin --framing template --slug kelvin
```

**Head framing** (`--framing`):

| Mode | Flag | Effect |
|------|------|--------|
| B | `bbox` (default) | Subject pixel bbox scaled into head slot; no oval; sprite uses `meet` |
| A | `template` | Fixed oval in portrait + oval clip + zoom in sprite sheet |

Default output slug: `kelvin-bbox` (or `kelvin-template` when using `--framing template`). Pass `--slug kelvin` to write the canonical folder without a suffix.

Browse `*-sheet.png`, `*-portrait.png`, and `pipeline/` (`1b-subject-bbox.png` for bbox only).

```bash
# Same API, no pipeline/ folder
npm run create:from-face-crop -- packages/character-creator/assets/sources/kelvin --framing bbox
```

## Contract

See [docs/sprite-handoff-person3.md](../../docs/sprite-handoff-person3.md).
