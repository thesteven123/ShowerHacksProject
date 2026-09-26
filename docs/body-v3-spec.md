# Body v3 — articulated limb spec

**Status:** Implemented on branch `body_v3` (`--body photo` auto-detects v3 when indices 7–12 exist; `--body photo_v3` forces v3). Golden build: **Philip** → `assets/built/philip-v3/`.

**Goal:** Match the overlay CSS rig ([README](../README.md): shoulder → elbow → forearm → hand; hip → foot) and enable finer photo crops and animation pivots than v2’s single arm/leg PNG per side.

---

## v2 → v3 part count

| Version | Face | Torso | Per arm | Per leg | Total drawable parts |
| --- | ---: | ---: | ---: | ---: | ---: |
| **v2** (current) | 1 | 1 | 1 (whole arm) | 1 (whole leg) | **6** body + head |
| **v3** (this spec) | 1 | 1 | 3 (upper arm, forearm, hand) | 2 (leg, foot) | **11** body + head |

Sides use **character anatomical** left/right (same as v2 and [`bodyPartSlots.ts`](../packages/character-creator/src/bodyPartSlots.ts)): character’s right arm is on the **viewer’s left** in a mirror selfie.

---

## Rig hierarchy (parent → child)

Attachment order for rendering and animation. Pivot names align with the CSS overlay.

```text
figure (root anchor — feet / hitbox baseline)
└── torso (2)
    ├── head (1)                    @ neck
    ├── right_upper_arm (3)         @ shoulder
    │   └── right_forearm (4)       @ elbow
    │       └── right_hand (5)      @ wrist
    ├── left_upper_arm (6)          @ shoulder
    │   └── left_forearm (7)        @ elbow
    │       └── left_hand (8)       @ wrist
    ├── right_leg (9)               @ hip
    │   └── right_foot (10)         @ ankle
    └── left_leg (11)               @ hip
        └── left_foot (12)          @ ankle
```

**Joints (rotation pivots):**

| Joint | Connects | Notes |
| --- | --- | --- |
| Neck | torso ↔ head | Reuse v2 `NECK_OVERLAP` (17 px). |
| Shoulder | torso ↔ upper arm | Upper arm hangs from torso side, ~6 px below shoulder line (v2 arm Y offset). |
| Elbow | upper arm ↔ forearm | Primary “wave / hit” bend for arms. |
| Wrist | forearm ↔ hand | Palm orientation; keep hand slot wide enough for flat palm in dance antic. |
| Hip | torso ↔ leg | Reuse v2 `HIP_OVERLAP` (20 px). |
| Ankle | leg ↔ foot | Walk cycle; foot stays lowest point for grounding. |

Head remains a separate crop (`*1*` / `*1crop*`) and is not renumbered.

---

## Source photo indices (filename convention)

Extend v2’s `*2*`…`*6*` pattern to `*2*`…`*12*` in the character source folder ([`resolvePartCrops`](../packages/character-creator/src/resolvePartCrops.ts) will gain v3 resolution later).

| Index | Part id | Lasso / export label |
| ---: | --- | --- |
| 1 | head | face (`*1*`, `*1crop*`) — unchanged |
| 2 | torso | torso |
| 3 | `right_upper_arm` | right upper arm |
| 4 | `right_forearm` | right forearm |
| 5 | `right_hand` | right hand |
| 6 | `left_upper_arm` | left upper arm |
| 7 | `left_forearm` | left forearm |
| 8 | `left_hand` | left hand |
| 9 | `right_leg` | right leg |
| 10 | `right_foot` | right foot |
| 11 | `left_leg` | left leg |
| 12 | `left_foot` | left foot |

Example filenames (slug `steven`): `steven3crop.jpg` … `steven12crop.jpg`, same as today’s `steven2`…`steven6` style.

**v2 compatibility:** A folder with only indices 2–6 is still **v2**. Detect v3 when **any** of 7–12 exist, or when `--body v3` / manifest flag is set (TBD at implementation).

---

## Crop guidance (lasso / friend photos)

- **Upper arm:** shoulder to elbow; include deltoid bulk, exclude forearm.
- **Forearm:** elbow to wrist; straight or slight bend OK; exclude hand.
- **Hand:** wrist to fingertips; prefer open palm or neutral fist for game readability.
- **Leg:** hip to ankle; knee may sit mid-slot; exclude foot.
- **Foot:** ankle to toes; sole line useful for walk contact.

Full-body reference photo workflow stays as in [`builder-part-crops.md`](./builder-part-crops.md); lasso gains ten limb slots instead of four.

---

## Sprite slot targets (initial)

Derived from v2 slots in [`bodyPartSlots.ts`](../packages/character-creator/src/bodyPartSlots.ts) by splitting height; widths unchanged. Tune after first v3 art pass.

| Part | Width × height (px) | v2 reference |
| --- | --- | --- |
| Head | 72 × 72 | `HEAD_SLOT` |
| Torso | 28 × 38 | `TORSO_SLOT` |
| Upper arm | 10 × 11 | ~upper half of `ARM_SLOT` (10 × 26) |
| Forearm | 10 × 10 | ~middle of arm |
| Hand | 10 × 8 | ~lower arm / palm |
| Leg | 12 × 24 | ~upper `LEG_SLOT` (12 × 34) |
| Foot | 12 × 12 | ~lower leg / shoe |

Overlaps at neck and hip stay as v2 until stacked height is re-measured for Person 3 hitbox ([`sprite-handoff-person3.md`](./sprite-handoff-person3.md)).

---

## TypeScript shape (planned)

```ts
type BodyV3PartIndex = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

type ScaledBodyPartsV3 = {
  torso: Buffer;
  rightUpperArm: Buffer;
  rightForearm: Buffer;
  rightHand: Buffer;
  leftUpperArm: Buffer;
  leftForearm: Buffer;
  leftHand: Buffer;
  rightLeg: Buffer;
  rightFoot: Buffer;
  leftLeg: Buffer;
  leftFoot: Buffer;
};
```

`BodyMode` may become `"procedural" | "photo_v2" | "photo_v3"` or `"photo"` with auto-detect from crop set.

---

## Implementation checklist (not done on `body_v3` yet)

- [ ] `docs/builder-part-crops.md` — v3 lasso indices 3–12
- [ ] `apps/part-lasso` — part picker labels and export names
- [ ] `resolvePartCrops.ts` — resolve 3–12 paths
- [ ] `prepareBodyParts.ts` / `buildSpriteSheet.ts` — stack and joint offsets
- [ ] Golden-path friend folder with 12 limb crops (optional: Steven v3_ trial set)
- [ ] Person 3: hitbox / anchor update if stacked height changes

---

## Figure

Connected front-view rig (labels + joints): open the inline visualization emitted in chat for this spec, or regenerate from the same layout when implementing.
