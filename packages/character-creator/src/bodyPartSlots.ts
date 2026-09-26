/** Sprite rig slot sizes (matches docs/sprite-handoff-person3.md). */
export const HEAD_SLOT = 72;
export const TORSO_SLOT = { width: 28, height: 38 };
export const ARM_SLOT = { width: 10, height: 26 };
export const LEG_SLOT = { width: 12, height: 34 };

export const NECK_OVERLAP = 17;
export const HIP_OVERLAP = 20;

export const TORSO_Y = HEAD_SLOT - NECK_OVERLAP;
export const LEGS_Y = TORSO_Y + TORSO_SLOT.height - HIP_OVERLAP;

/**
 * PNG buffers scaled to limb slot dimensions (photo body mode).
 * Arms/legs are character anatomical sides (facing the camera).
 */
export type ScaledBodyParts = {
  torso: Buffer;
  rightArm: Buffer;
  leftArm: Buffer;
  rightLeg: Buffer;
  leftLeg: Buffer;
};

export type BodyMode = "procedural" | "photo";

/** Part index in source filenames (1 = face, resolved elsewhere). */
export type LimbPartIndex = 2 | 3 | 4 | 5 | 6;
