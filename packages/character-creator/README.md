# @tiny-menaces/character-creator

Person 2 package: photo → `FriendCharacter` + sprite sheets. No Electron dependency.

## API

- `createCharacterFromPhoto(photoBuffer, options)` — writes portrait + sheet PNGs, returns `FriendCharacter`.
- `loadMockCharacters()` — three fake friends for parallel dev.
- `cropFace`, `styleFace`, `buildSpriteSheet` — lower-level steps.

## Mocks

```bash
npm run generate:mocks -w @tiny-menaces/character-creator
```

## Contract

See [docs/sprite-handoff-person3.md](../../docs/sprite-handoff-person3.md).
