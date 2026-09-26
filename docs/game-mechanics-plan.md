# Game Mechanics and Character Progression — Kelvin (Person 3)

Recorded: 2026-09-26. This document captures Kelvin's current design direction
and proposed handoff. It is a planning document, not an implemented API or a
team-approved expansion of everyone else's scope.

## Product direction

Tiny Menaces is primarily a companion desktop pet and character-raising
experience. Its core value is companionship, emotional connection, and funny,
recognizable friend behavior. Minigames are activities within that experience.
The first version starts with one pet.

The core loop is:

```text
Player action (pet / throw / hit / play)
    -> character state and progression changes
    -> behavior rules select a response
    -> movement, animation, dialogue, or sound makes the change visible
    -> new interactions or content become available
```

## Three distinct character layers

| Layer | Purpose | Candidate fields | Change model |
| --- | --- | --- | --- |
| Base personality | Who the character is | Chaos, Brainrot, Competitive, Friendliness; each scored 0–10 | Random initial suggestion, user-editable before confirmation, then relatively stable |
| Dynamic state | How the character feels now | Friendship, Anger, Energy | Changes through interaction and time |
| Progression | What the player has unlocked | XP, Level, Unlocks | Accumulates through activities |

Friendliness is a personality trait; Friendship is the developing relationship
with the player. They must not be treated as the same field.

### Personality initialization

Latest creation flow (supersedes the earlier 0–100 personality examples):

1. Display exactly four personality dimensions, each with a maximum score of 10.
2. Generate one random set of four suggested values as a starting point.
3. Let the user edit each value before creating the character.
4. Confirm and retain the final values as that character's base personality.

Use 0–10 as the working range. The lower bound and integer-versus-decimal input
were not specified by Kelvin; 0 and integer steps are proposed UI defaults.
Kelvin delegated dimension selection; use Chaos, Brainrot, Competitive, and
Friendliness for v1. Confidence is deferred to avoid overlapping controls.

| Dimension | Low end | High end | Primary behavior role |
| --- | --- | --- | --- |
| Chaos | Predictable, calm routines | Frequent spontaneous antics | Timing and variety of random actions |
| Brainrot | Mostly ordinary expressions | Frequent memes, 67, barking, silly gestures | Choice of humorous content |
| Competitive | Relaxed about challenges | Eager to compete and rematch | Challenge enthusiasm and taunt style |
| Friendliness | Reserved, gives the user space | Social, seeks interaction | Frequency/style of companionship and greetings |

Four independent dimensions are enough for the first build. Their combinations
already allow a calm but meme-heavy pet or a chaotic but friendly pet. Low
Friendliness means reserved, not hostile. Competitive must not silently change
the scoring or difficulty rules; any mechanical modifier needs explicit tuning.

Each dimension should have a short description and low/high reference labels
so users understand what its score changes. Sliders with visible numeric values
are a proposed UI. An optional Randomize button can generate a new suggestion
only when the user requests it; ordinary rendering must never overwrite edits.
No AI call is required for the random suggestion. Random distribution and any
shared point budget are not specified; do not silently impose a total budget.

Example: Chaos = 8/10, Brainrot = 9/10, Competitive = 6/10,
Friendliness = 4/10. The user can adjust any of these before confirming.

This change applies to base personality only. Dynamic state remains on its
separately documented provisional 0–100 scale, and Level/XP retains its own
progression rules. A personality score is not the character's progression level.

Numeric traits should coexist with the existing `FriendCharacter.vibe` field
until the team agrees on a schema change.

### Dynamic state

Illustrative effects:

| Action | Intended change |
| --- | --- |
| Pet the character | Increase Friendship |
| Play a minigame together | Increase Friendship and award progression XP |
| Hit the character | Increase Anger |
| Throw the character | Increase Anger; possible future Chaos training XP |
| Allow time to pass | Gradually reduce Anger |

The source examples use both +3 and +5 Friendship per pet, +5 Friendship for
playing, +15 Anger per hit, and +8 Anger per throw. These are tunable examples,
not conflicting constants to implement literally. Dynamic-state values in the
illustrative 0–100 system should be clamped to that range; personality uses 0–10.

### Progression

Interactions, minigames, challenges, and potentially idle time can award XP.
XP determines Level, and Level can unlock behaviors or activities.

Illustrative unlock ladder:

| Level | Example unlock |
| --- | --- |
| 1 | Walking, petting, grabbing |
| 2 | Throwing |
| 3 | Dog bark |
| 5 | Aim Challenge hard mode |
| 7 | Say 67 |
| 10 | Legendary dance |
| 15 | Rage Mode |

The ladder and XP curve are not finalized. The demo must be able to demonstrate
key features without lengthy grinding. Decide whether Rage Mode is an early
anger response or a level-gated ability before implementation; the examples
describe both. Difficulty availability likewise needs to be reconciled with
the example Level 5 unlock.

## Stats must visibly affect behavior

### Chaos

Higher Chaos increases the frequency or weighting of unpredictable actions.
Example cadence on the new scale is around 60 seconds at Chaos 2, 30 seconds at Chaos 5, and
10–20 seconds at Chaos 8. These are tuning examples.

A high-Chaos character might allocate behavior choices as follows:

| Behavior | Example weight |
| --- | --- |
| Normal walking | 30% |
| Random running | 15% |
| Dog crawling | 10% |
| Dancing | 10% |
| Strange dialogue | 15% |
| Watching the cursor | 10% |
| Idling | 10% |

A calmer character may favor walking, sitting, and sleeping. Select from
available, unlocked behaviors only, and normalize weights after filtering.
Use time-based cooldowns or scheduling rather than rolling a fixed probability
every rendering frame, which would make behavior depend on frame rate.

### Friendship

Higher Friendship should produce visible companionship behaviors. Examples:

- Above 50: occasionally follow the cursor.
- Above 80: occasionally sit near the user's active window.

Active-window awareness requires support from Person 1 and is a later feature;
it is not available from the sprite contract alone.

### Anger

The Aim Challenge provides a clear feedback loop: repeated hits increase Anger,
and the character becomes visibly more annoyed and harder to catch.

Illustrative tiers:

| Anger band | Intended behavior |
| --- | --- |
| Low, below approximately 30 | Normal movement/escape |
| Around 30–50 | Annoyed reactions such as "bro stop" |
| Around 50–80 | Faster movement (example: 1.4x) and cursor avoidance |
| Around 80+ | Potential Rage Mode: faster running, frequent turns, stronger taunts, possibly cartoon projectiles |

Exact inclusive boundaries, speed caps, and mode transitions need one consistent
configuration. At +15 Anger per hit, starting at 10 reaches 85 after five hits;
the narrative example ending at 75 was illustrative, not a separate rule.

Difficulty supplies the baseline. If Anger modifies movement during a round,
that is part of the rules and must be visible to the player. Decide the initial
round Anger policy before treating scores as comparable; persistent starting
states can change challenge difficulty.

### Brainrot — expansion

The design includes potential training rewards: Say 67 grants 3 Brainrot XP,
barking grants 2, and a themed minigame grants 10. These are examples.

Example Brainrot behavior bands on the new scale are mostly
normal below 3, occasional memes from 3 to below 6, more unusual actions from
6 to below 8, frequent 67/barking/dancing from 8 to below 9.5, and a special
Brainrot Mode at 9.5–10. These thresholds are illustrative and need tuning
against the chosen input step size.

A Brainrot Mode sequence might be: stop -> say "67" -> dance -> run -> bark
-> resume walking. Trait XP is distinct from the trait's 0–10 value and from
general Level XP. The conversion to learned behavior or an effective trait
value has not been decided. Do not silently mutate base personality or add
trait XP directly to it.

## Ambient behaviors and future interactions

Preserve the existing ideas as content for the companion experience:

- Say 67 and perform a matching gesture.
- Bark, dog-crawl, and dance.
- Punch the screen with a temporary simulated crack overlay.
- Eat a ground fruit and temporarily grow or become visually distorted.
- Later, two pets greet each other; one barking can prompt another to join.

Use behavior cooldowns and bounded reaction chains. Transformations must restore
the normal appearance. Multi-pet interactions are outside the one-pet first build.

## First minigame: 30-second Aim Challenge

Retain the agreed initial deliverable:

| Owner | Responsibilities | First deliverable |
| --- | --- | --- |
| Person 3 — Game mechanics (Kelvin) | Aiming/click detection, hit effects, score, timer, respawn | A playable 30-second round using placeholder characters first |

- Start with one moving placeholder target.
- Clicking a valid target registers one hit, awards points, and triggers a reaction.
- Use +10 per hit and approximately 0.8 seconds before respawn as initial tuning.
- Track missed shots and hit streaks; UI control clicks are not shots.
- Prevent repeat hits while the target is dying, hidden, or not yet targetable.
- End scoring when the 30-second round ends.
- Supply score, hits, misses, accuracy, average time to hit, and longest streak.
- Average time to hit is appearance-to-hit time, not pure reaction time.
- Show unavailable ratios/averages as unavailable rather than dividing by zero.
- Add difficulty settings and clearly signaled taunt bonus windows after the
  core round works; bonus amounts still need agreement.

The nurturing system extends this deliverable: game actions update the pet's
state and progression, and state drives reactions and movement modifiers.
Other minigames remain future extensions (pop-up targets, tracking, hit only
the taunter, avoid the dancer, and short rotating microgame instructions).

## Hackathon scope and sequence

The creation flow now requires four editable personality scores. This is
separate from the earlier proposal to implement four gameplay systems first:
**Chaos + Friendship + Anger + Level/XP**. Retain that behavior implementation
priority; do not confuse those four systems with the four personality dimensions.
The selected dimensions are Chaos, Brainrot, Competitive, and Friendliness;
detailed behavioral mappings still need tuning. Expanded Brainrot behavior, Energy, and
additional trait-specific rules remain later work.

1. Build a complete placeholder-based 30-second round with hit detection,
   scoring, timing, and respawn. Integrate this early with the Electron shell.
2. Add one-pet state: petting increases Friendship, hits increase Anger,
   and inactivity gradually reduces Anger.
3. Make the changes visible: Chaos affects ambient choice, Friendship enables
   cursor-following, and Anger changes movement/requests an annoyed reaction.
4. Add XP, one level-up, and one demonstrable content unlock.
5. Connect real sprites, reaction assets, and UI; expand only after this loop works.

## Handoff to teammates

### What Kelvin delivers

- A runnable isolated preview using placeholder/mock characters.
- The playable round and character-state/behavior logic.
- A centralized tuning configuration for thresholds, deltas, durations, and difficulty.
- Start/stop/reset controls, a documented state snapshot, and event definitions.
- Example inputs and outputs so UI and reaction work can proceed independently.
- Integration notes and a reproducible demo sequence.

### Inputs and outputs to agree on

The following are proposed semantics, not finalized exported names or types.
Align them with `src/shared/types.ts` in the inspected scaffold. See
[the scaffold handoff](game-mechanics-integration-handoff.md) for current versus
proposed contracts and integration gaps.

| Direction | Data/control |
| --- | --- |
| Input | Existing `FriendCharacter[]`; the supplied sprite spec must still be integrated into the shared type |
| Input | Four confirmed personality scores (working range 0–10), generated and edited during creation; shared field names to be agreed |
| Input | Playable bounds, game mode, pointer position, and elapsed time |
| Commands | Pet, grab/throw when supported, start round, stop round, restart |
| State output | Per-character personality, dynamic state, XP, level, unlocks |
| Round output | Phase, remaining time, score, shots, hits, streak, final results |
| Existing event output | `hit` with `characterId`; `roundEnded` with `score` |
| Proposed additional events | `respawn`, `taunt`, state changed, behavior requested, level up, content unlocked |

Events should identify the character and include relevant state/reason so
Person 4 can choose a reaction without implementing duplicate game rules.
Kelvin's module owns stat mutations and round scoring. Consumers display or
react to the outputs rather than independently calculating those rules.

Keep per-character simulation state separate from sprite metadata and temporary
round state. Coordinate shared schema changes with Person 1; do not replace the
existing `FriendCharacter` contract unilaterally.

### Team responsibilities

| Collaborator | Provides | Receives from Kelvin |
| --- | --- | --- |
| Person 1 — Desktop/integration | Electron shell, bounds, hotkeys, click-through, app lifecycle; agreement on storage ownership | Module entry point, lifecycle controls, state/round integration requirements |
| Person 2 — Character creator | Characters, sprites, animation assets | Requested behaviors/clips and renderer feedback |
| Person 4 — Personality/reactions | Dialogue, sounds, reaction content; personality-generation coordination | Events and current state for selecting reactions |
| Person 5 — UI/demo flow | Setup, roster, stat display, difficulty selection, HUD, results | State snapshots, round statistics, level/unlock notifications |

Creation handoff: Person 2 and Person 5 coordinate the four-score editor and
random suggestion with Person 1's shared schema. Kelvin consumes the confirmed
values for behavior rules; the game must not rerandomize them on receipt.
These added ownership details are proposed until teammates agree.

Long-term progression needs persistence. The owner of save/load, saved-state
format, and restart behavior must be agreed with Person 1; persistence is not
already implemented by this document.

## Sprite contract: preserve v0.1

See [the recorded sprite handoff](game-mechanics-sprite-handoff.md).
The 72 × 108 frame, feet-center anchor `(36, 107)`, local hitbox
`(4, 4, 64, 99)`, and the idle/walk/hit/respawn clips remain authoritative.
Apply display scale consistently to rendering and hit detection.

Dance, dog-crawl, and 67 gestures do not yet have agreed sprite frames.
Request additional assets or agree on fallback effects; never invent frame
indices. A behavioral state is not automatically an available animation clip.

## Acceptance demo

1. Generate four suggested personality scores, edit at least one, confirm the
   character, and verify the game receives the exact confirmed values.
2. Observe an ambient behavior selected using Chaos.
3. Pet the character; Friendship changes and, at the chosen threshold, enables
   the demonstrated companionship behavior.
4. Start the Aim Challenge; repeated hits raise Anger and visibly change behavior.
5. Complete the round; verify statistics and the XP reward.
6. Demonstrate a level-up/unlock and use the newly available behavior.
7. Return to companion mode and verify that round state clears appropriately
   while character progression remains in the current session.

Restart persistence is a separate check once save/load is implemented.

## Current status

The first implementation now lives in `src/game/` on `kelvin/desktop-pet`:
companion state, four personality traits, progression, an extensible minigame
interface, and a playable 30-second Aim Challenge. The existing Electron shell
loads it through a browser ES module and displays a transparent desktop pet,
temporary floating controls, a HUD, and results card. The mock roster supplies
the first character. See `src/game/README.md` for the actual public interface.
