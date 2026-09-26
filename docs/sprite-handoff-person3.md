# Sprite handoff (Person 2 → Person 3)

Proposed v0 contract for rendering and hit detection. **Person 3 signed off** on anchor, hitbox, and clip layout (2026-09-26).

## Type

See [`packages/shared/src/types.ts`](../packages/shared/src/types.ts) — `FriendCharacter.sprite` is a `CharacterSpriteSpec`.

## Sheet layout

- **Format:** PNG, horizontal strip, transparent background.
- **Frame size:** 72×108 px (`frameWidth` × `frameHeight`) — one cell per pose.
- **Body proportions (art inside the frame):** head 72×72, torso 28×38, arms 10×26, legs ~34 px tall; neck/hip overlap so the drawn stack is ~**63×107** px (width × height), not 63×144 from naive stacking. Limb/torso fills use vibe colors with a dark stroke so they read on dark backgrounds.
- **Frame count:** 14 frames, indices 0–13 left to right.

| Frames | Clip    | FPS | Loop |
|--------|---------|-----|------|
| 0–3    | idle    | 6   | yes  |
| 4–7    | walk    | 8   | yes  |
| 8–10   | hit     | 12  | no   |
| 11–13  | respawn | 10  | no   |

## Position & anchor

- Game position `(x, y)` is the **anchor point** (feet center): `{ x: 36, y: 107 }` from the **top-left of the current frame**.
- Draw the frame so that anchor sits at the entity’s world position.

## Hitbox (click-to-shoot)

Axis-aligned box in **frame-local** pixels (same space as hitbox fields on the spec):

```
x: 4, y: 4, width: 64, height: 99
```

Transform to world space using the entity position and anchor when testing clicks.

## Portrait

`imageUrl` is a separate 64×64 portrait for roster/UI — oval alpha cutout (not a square photo frame), not the sprite sheet.

## Mock data

- JSON: [`packages/character-creator/data/mockCharacters.json`](../packages/character-creator/data/mockCharacters.json)
- Sheets: [`packages/character-creator/assets/mocks/`](../packages/character-creator/assets/mocks/)

## Loading in Electron (Person 1)

Use paths relative to the packaged app or `file://` URLs returned from character creation. Preview app loads the same URLs via Vite static assets — see `apps/character-preview`.

## Changelog

- **v0 (hackathon):** Initial contract with `DEFAULT_SPRITE_LAYOUT` in `@tiny-menaces/shared`.
- **v0.1:** Taller chibi — 72×108 frames, ~63×107 body stack (head/torso/legs proportions).
