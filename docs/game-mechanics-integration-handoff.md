# Person 3 — Kelvin: Scaffold Integration and Handoff

## Verified repository snapshot

Inspected on 2026-09-26: `thesteven123/ShowerHacksProject`, `main`, commit
`06b1068` (Add Tiny Menaces Electron scaffold). Remote branch listing returned
only `main` at inspection time. Kelvin's local `kelvin/desktop-pet` branch was
fast-forwarded to this commit without deleting the local design documents.
This records the initial scaffold snapshot. Kelvin subsequently added the game
module, browser build, and floating desktop UI. The Electron app was launched
and checked with its preload bridge, native window, and a real pointer hit.

## Ownership and first delivery

| Owner | Scope | First deliverable |
| --- | --- | --- |
| Person 3 — Game mechanics (Kelvin) | Aiming/click detection, hit effects, score, timer, respawn | A playable 30-second round using placeholder characters first |

Own gameplay implementation under `src/game/`. The broader product direction
is companionship and character raising, with minigames as activities. Extend
the first round with personality-driven behavior and progression incrementally.
Do not delay the first integration until every ambient behavior is available.

## Existing seams

| Path | Current responsibility/status |
| --- | --- |
| `src/electron/main.ts` | Transparent overlay on the primary display, always-on-top, mode/quit hotkeys, click-through |
| `src/electron/preload.ts` | `window.tinyMenaces.listFriends()`, `getMode()`, `onModeChange(callback)` |
| `src/shared/types.ts` | `FriendCharacter` and the two existing `GameEvent` variants |
| `src/shared/mockFriends.ts` | Alex, Blair, Casey; blank image URLs with UI initials fallback |
| `src/game/` | Implemented companion/game system and Aim Challenge |
| `src/characters/` | Character creation work area; README only |
| `src/reactions/` | Reaction work area; README only |
| `src/ui/` | Plain HTML/CSS/JavaScript desktop overlay, floating controls, HUD, and results; not React |

The shared roster contains three mock friends; the desktop game currently
displays and uses the first one. Roster selection remains UI/creator work.

## Existing contract: keep compatibility

`FriendCharacter` currently has `id`, `name`, `imageUrl`, `vibe`, and
`quotes.idle/hit/respawn`. `vibe` is `chaotic | dramatic | supportive`.

Existing game events are exactly:

```ts
{ type: "hit"; characterId: string }
{ type: "roundEnded"; score: number }
```

The shared type still lacks sprite and personality fields. Numeric personality,
pet state, XP, difficulty, detailed result, respawn, and behavior events are
implemented as game-module types/events pending team agreement on shared types.
Do not redefine `FriendCharacter` or `GameEvent` in the feature folder. Propose
additive shared contracts through the integration owner and retain old mock
data compatibility during migration.

## Personality decision for v1

Use four dimensions: **Chaos, Brainrot, Competitive, Friendliness**. Each has a
maximum of 10; working UI defaults are integer scores from 0 to 10. Generate a
random suggestion at creation, allow edits, and retain the confirmed values.
Confidence is deferred. No AI is required to generate the initial suggestion.

- Chaos: how often spontaneous actions occur.
- Brainrot: how meme-heavy the selected actions and expressions are.
- Competitive: enthusiasm for challenges, rematches, and competitive reactions.
- Friendliness: sociability and preference for companion interactions.

Friendliness is a stable preference. Friendship is a dynamic relationship with
the user; Anger is current mood. Level/XP is progression, not a fifth trait.
The exact shared field names and schema migration still require integration.

## Completed implementation sequence

1. Build a game simulation in `src/game/` accepting one character, bounds,
   time updates, and clicks. Produce state snapshots and existing game events.
2. Add a minimal playable preview: target motion, hit effect, score, countdown,
   and respawn. Use the mock roster and placeholders, not a photo dependency.
3. Integrate one full round into Electron with Person 1 and Person 5; stop
   accepting shots when the round ends or game mode is disabled.
4. Supply difficulty configuration and detailed round results without breaking
   the existing `roundEnded` consumer contract.
5. Add companion state/progression and behavior events. Real sprite assets,
   teammate dialogue, and sound remain follow-up integrations.

## Integration details and remaining gaps

### Browser loading

Resolved: the existing renderer remains isolated with Node integration disabled.
`tsconfig.game.json` compiles `src/game/` as browser ES modules to
`dist/game-browser/`; the Electron UI imports those modules with a normal
`<script type="module">`. The original main-process build remains intact.

### Sprite paths and coordinates

Person 2's supplied contract references `packages/shared/` and
`packages/character-creator/`, but this scaffold has a `src/` layout. Its shared
type does not contain `CharacterSpriteSpec` yet. Reconcile those paths and
types before loading the sheets. Keep the supplied v0.1 geometry unchanged:
72×108 frame, feet anchor (36,107), local hitbox (4,4,64,99).

The current renderer uses the feet-centered v0.1 anchor and hitbox for its
placeholder pet and can accept the 1008×108 sprite strip through its explicit
`setSprite(url)` adapter. Pointer positions are converted to the arena's local
coordinates. Person 2's actual file paths and `CharacterSpriteSpec` field still
need shared-contract alignment; the supplied assets are not checked in.

### Companion input

Passive mode ignores mouse input at the Electron window level, so the desktop
remains usable. The existing mode shortcut opens temporary floating controls
for petting and gameplay. Grabbing, throwing, fruit interaction, and active
window awareness are later additions and require input/asset agreement.
Personality and progression are saved per character in renderer localStorage.

### Mode lifecycle

The renderer uses the existing mode bridge. Disabling interactive mode aborts
an active round immediately, with no partial result or XP reward. Restarting
starts a fresh round. The mode listener is attached once per renderer lifetime;
the current bridge has no unsubscribe function.

## What each teammate receives

| Recipient | Kelvin's handoff | Dependency from them |
| --- | --- | --- |
| Person 1 | Module entry point, lifecycle rules, build requirements, proposed shared types | Browser-loadable integration, window bounds/input policy, storage agreement |
| Person 2 | Rendering contract feedback and list of required behavior clips | Real character records and sprites; additional animation agreements |
| Person 4 | Character ID, event, relevant stats, requested behavior | Dialogue, sounds, effects; no duplicate stat mutation |
| Person 5 | Start/stop/restart controls, live state, results, level/unlock notifications | Controls, personality editor, HUD, stats/results display |

Provide sample event payloads, a small usage example, tuning configuration, and
one reliable demo path with the implementation. Keep the handoff usable with
placeholder content so nobody waits for another workstream's assets.

## Acceptance checks for the first implementation

- One placeholder target completes a 30-second round in the overlay.
- A valid click produces exactly one hit and score increment.
- Hidden/respawning targets, UI buttons, and post-round clicks cannot score.
- Timer, respawn, restart, and mode exit leave no stale gameplay callbacks.
- Results correctly handle no shots and no hits.
- Existing mock roster and existing event consumers still work.
- When sprites arrive, visual position and scaled hitbox stay aligned.
- Run `npm run typecheck` and `npm test`, then verify the Electron interaction
  loop after any changes to the desktop UI or integration code.

## Status

The playable local implementation is complete. `npm test` passes 11 game tests.
A native Electron smoke test passed for the preload bridge, window, petting,
real pointer hit, and mode exit. The sprite assets and shared
`CharacterSpriteSpec` are not present yet. No remote push, PR, or teammate
message has been performed.
