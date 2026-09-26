# Sprite handoff reference — Person 2 → Person 3

User-provided team contract, recorded 2026-09-26. Current revision: v0.1.
Use this contract for game rendering and click-to-shoot hit detection.
The supplied `packages/` paths are not present in the scaffold inspected at
commit `06b1068`. That scaffold uses `src/shared/types.ts` and `src/characters/`,
and its `FriendCharacter` does not yet include `sprite`. Preserve these supplied
sprite parameters, but reconcile paths/types with Persons 1 and 2 before integration.

## Shared type

`packages/shared/src/types.ts`: `FriendCharacter.sprite` is a
`CharacterSpriteSpec`. The shared package `@tiny-menaces/shared` provides
`DEFAULT_SPRITE_LAYOUT`.

## Sprite sheet

- PNG, transparent background, horizontal strip.
- Each frame is 72 × 108 px (`frameWidth` × `frameHeight`).
- 14 frames, indexed 0–13 from left to right.
- Art proportions: head 72 × 72, torso 28 × 38, legs approximately 34 px tall.
- Neck/hip overlap gives a reported drawn stack of approximately 63 × 107 px,
  not 63 × 144 px from naive stacking. Use frame dimensions for rendering.

| Frame indices | Clip | FPS | Loop |
| --- | --- | --- | --- |
| 0–3 | idle | 6 | Yes |
| 4–7 | walk | 8 | Yes |
| 8–10 | hit | 12 | No |
| 11–13 | respawn | 10 | No |

## Position and anchor

The entity world position `(x, y)` is its feet-center anchor, not its top-left.
The anchor within each frame is `{ x: 36, y: 107 }`, measured from the frame's
top-left. Draw the frame with that anchor at the entity world position.

## Hitbox

Frame-local axis-aligned box:

```json
{ "x": 4, "y": 4, "width": 64, "height": 99 }
```

Derived rendering/hit-test formulas at native scale, without rotation or mirroring:

```text
frameLeft = entity.x - 36
frameTop  = entity.y - 107
hitLeft   = entity.x - 32
hitTop    = entity.y - 103
hitWidth  = 64
hitHeight = 99
```

For a positive uniform display scale `s`, apply the same scale to the anchor,
sprite, and hitbox:

```text
frameLeft = entity.x - 36 * s
frameTop  = entity.y - 107 * s
hitLeft   = entity.x - 32 * s
hitTop    = entity.y - 103 * s
hitWidth  = 64 * s
hitHeight = 99 * s
```

Pointer positions must be converted into the same game coordinate space before
testing. Any future mirroring or deformation must account for its transform;
the formulas above assume neither.

## Portrait

`imageUrl` is a separate 64 × 64 square face crop for roster/UI. It is not the
sprite sheet.

## Mock data and asset loading

- Mock JSON: `packages/character-creator/data/mockCharacters.json`
- Mock sheets: `packages/character-creator/assets/mocks/`
- Preview app: `apps/character-preview`
- Electron uses paths relative to the packaged app or `file://` URLs returned
  from character creation.
- The preview uses the same URLs through Vite static assets.

## Integration notes

The supplied clips are idle, walk, hit, and respawn only. Dance, 67 gestures,
dog crawling, and other planned behaviors need additional agreed assets or
explicit fallback effects; do not assign them nonexistent frame indices.

The team asks Person 3 to report renderer blockers in a PR or `#integration`.
This document records that workflow; no message has been sent.

## Contract history

- v0: Initial hackathon contract with `DEFAULT_SPRITE_LAYOUT`.
- v0.1: Taller chibi; 72 × 108 frames and approximately 63 × 107 drawn body stack.
