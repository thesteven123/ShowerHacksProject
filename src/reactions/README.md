# Reactions work area

Person 4: `getReaction(character, event)` and `createReactionEngine` live here.

```ts
import { createReactionEngine, getReaction } from "../reactions";

const reaction = getReaction(character, "hit");
// reaction.line, reaction.antic, reaction.effect, reaction.sound
```

Person 3 emits `hit`, `idle`, `respawn`, or `roundEnded`. This folder returns the line, stupid bit, effect, and sound. Local quote search works without Moss keys.

The overlay calls the same API over IPC (`reactions:get`): click a gremlin in game mode for hit → down → respawn, and idle lines fire on a timer.

Roster comes from Person 2's `packages/character-creator/data/characters.json`. Photo limb crops sit on the CSS figure (`head` / `torso` / `arm` / `leg`). Maanya keeps the 6-7 dance. `FriendCharacter.sprite` is passed through for Person 3.
