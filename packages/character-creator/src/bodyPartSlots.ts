/** Sprite rig slot sizes (matches docs/sprite-handoff-person3.md). */
export const HEAD_SLOT = 72;
export const TORSO_SLOT = { width: 28, height: 38 };
export const ARM_SLOT = { width: 10, height: 26 };
export const LEG_SLOT = { width: 12, height: 34 };

/** Body v3 articulated slots (docs/body-v3-spec.md). */
export const UPPER_ARM_SLOT = { width: 10, height: 11 };
export const FOREARM_SLOT = { width: 10, height: 10 };
export const HAND_SLOT = { width: 10, height: 8 };
export const LEG_V3_SLOT = { width: 12, height: 24 };
export const FOOT_SLOT = { width: 12, height: 12 };

export const NECK_OVERLAP = 17;
export const HIP_OVERLAP = 20;
export const ELBOW_OVERLAP = 2;
export const WRIST_OVERLAP = 2;
export const ANKLE_OVERLAP = 2;

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

export type ScaledBodyPartsV3 = {
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

export type PhotoBodySchema = "v2" | "v3";

export type BodyMode = "procedural" | "photo" | "photo_v3";

/** Part index in source filenames (1 = face, resolved elsewhere). */
export type LimbPartIndex = 2 | 3 | 4 | 5 | 6;

/** Body v3 part indices 2–12 (1 = face). */
export type BodyV3PartIndex = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
