# Reactions work area

Person 4: `getReaction(character, event)` and `createReactionEngine` live here.

```ts
import { createReactionEngine, getReaction } from "../reactions";

const reaction = getReaction(character, "hit");
// reaction.line, reaction.antic, reaction.effect, reaction.sound
```

Person 3 emits `hit`, `idle`, `respawn`, or `roundEnded`. This folder returns the line, stupid bit, effect, and sound. Local quote search works without Moss keys.
