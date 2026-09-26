# @tiny-menaces/character-creator

Person 2 package: photo → `FriendCharacter` + sprite sheets. No Electron dependency.

## API

- `createCharacterFromPhoto(photoBuffer, options)` — full photo → center crop → portrait + sheet (random UUID filenames).
- `createCharacterFromFaceCrop(faceBuffer, options)` — pre-cropped face: **scale only** (no extract), stable `id` / filenames. Optional `bodyMode: "photo"` uses part crops from `sourceDir`.
- `loadRosterCharacters()` — real friends from `data/characters.json`.
- `upsertRosterCharacter(character)` — merge one entry into roster JSON (used by `--roster` CLI).
- `loadMockCharacters()` — dev-only Alex / Jordan / Sam (`mockCharacters.json`).
- `cropFace`, `styleFace`, `buildSpriteSheet`, `prepareScaledBodyPartsFromDir` — lower-level steps.

## Real friends roster

**Preview and game integration** load [`assets/characters.json`](assets/characters.json) (mirror in [`data/characters.json`](data/characters.json)). Dev placeholders live separately in `mockCharacters.json` (see below).

### Taking photos (friends)

Friends send **two photos** only (face + full body). Share [`docs/friend-photo-guide.md`](../../docs/friend-photo-guide.md) and the oval overlay [`assets/guides/face-oval-overlay.png`](assets/guides/face-oval-overlay.png) (matches in-game `template` framing).

### Build + register (photo body)

**Builder workflow:** two friend photos → [lasso part crops](../../docs/builder-part-crops.md) (`npm run lasso`) → CLI below. You can also place hand-cut crops in `assets/sources/<slug>/` (files `*1*` … `*6*`) without the lasso app.

From repo root:

```bash
npm run face-crop:avatar -- packages/character-creator/assets/sources/<slug>/v2_ \
  --body photo --slug <slug> --name "<Name>" --roster
```

`--roster` upserts into `characters.json` (keeps existing **quotes** on rebuild). Output PNGs: `assets/built/<slug>/`.

```bash
npm run preview   # http://localhost:5174 — defaults to Steven (golden path)
```

Optional: check **Show dev mocks** in preview for Alex / Jordan / Sam.

Verify assets:

```bash
npm run verify:preview
```

### Photo part indices

| Index in filename | Part |
| --- | --- |
| `1` / `1crop` | Face |
| `2` | Torso |
| `3` | Right arm (character-facing) |
| `4` | Left arm |
| `5` | Right leg |
| `6` | Left leg |

Example:

```bash
npm run face-crop:avatar -- packages/character-creator/assets/sources/steven/v2_ \
  --body photo --slug steven --name Steven --roster
```

See [builder-part-crops.md](../../docs/builder-part-crops.md) — Steven is the reference run for workflow and Electron midpoint.

**Head framing** (`--framing`): `bbox` (default) or `template` — see below.

## Dev mocks (optional)

Procedural Alex / Jordan / Sam for hitbox testing only. **Does not touch `characters.json`.**

```bash
npm run generate:mocks -w @tiny-menaces/character-creator
```

## Head framing

| Mode | Flag | Effect |
|------|------|--------|
| B | `bbox` (default) | Subject bbox in head slot; no oval |
| A | `template` | Oval portrait + clip |

## Contract

See [docs/sprite-handoff-person3.md](../../docs/sprite-handoff-person3.md).
