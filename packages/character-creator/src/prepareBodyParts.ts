import { readFile } from "node:fs/promises";
import type { CharacterVibe } from "@tiny-menaces/shared";
import {
  ARM_SLOT,
  FOOT_SLOT,
  FOREARM_SLOT,
  HAND_SLOT,
  LEG_SLOT,
  LEG_V3_SLOT,
  type PhotoBodySchema,
  type ScaledBodyParts,
  type ScaledBodyPartsV3,
  TORSO_SLOT,
  UPPER_ARM_SLOT,
} from "./bodyPartSlots.js";
import { scalePartCrop } from "./cropFace.js";
import {
  detectPhotoBodySchema,
  resolvePartCropPaths,
  resolvePartCropPathsV3,
  type ResolvedPartCrops,
  type ResolvedPartCropsV3,
} from "./resolvePartCrops.js";
import { applyVibeTintToImage } from "./styleFace.js";

async function scaleAndTint(raw: Buffer, w: number, h: number, vibe: CharacterVibe): Promise<Buffer> {
  const scaled = await scalePartCrop(raw, w, h);
  return applyVibeTintToImage(scaled.buffer, vibe);
}

export async function prepareScaledBodyPartsFromPaths(
  paths: ResolvedPartCrops,
  vibe: CharacterVibe,
): Promise<ScaledBodyParts> {
  const [torsoRaw, rightArmRaw, leftArmRaw, rightLegRaw, leftLegRaw] = await Promise.all([
    readFile(paths.torsoPath),
    readFile(paths.rightArmPath),
    readFile(paths.leftArmPath),
    readFile(paths.rightLegPath),
    readFile(paths.leftLegPath),
  ]);

  const [torso, rightArm, leftArm, rightLeg, leftLeg] = await Promise.all([
    scaleAndTint(torsoRaw, TORSO_SLOT.width, TORSO_SLOT.height, vibe),
    scaleAndTint(rightArmRaw, ARM_SLOT.width, ARM_SLOT.height, vibe),
    scaleAndTint(leftArmRaw, ARM_SLOT.width, ARM_SLOT.height, vibe),
    scaleAndTint(rightLegRaw, LEG_SLOT.width, LEG_SLOT.height, vibe),
    scaleAndTint(leftLegRaw, LEG_SLOT.width, LEG_SLOT.height, vibe),
  ]);

  return { torso, rightArm, leftArm, rightLeg, leftLeg };
}

export async function prepareScaledBodyPartsV3FromPaths(
  paths: ResolvedPartCropsV3,
  vibe: CharacterVibe,
): Promise<ScaledBodyPartsV3> {
  const [
    torsoRaw,
    rightUpperArmRaw,
    rightForearmRaw,
    rightHandRaw,
    leftUpperArmRaw,
    leftForearmRaw,
    leftHandRaw,
    rightLegRaw,
    rightFootRaw,
    leftLegRaw,
    leftFootRaw,
  ] = await Promise.all([
    readFile(paths.torsoPath),
    readFile(paths.rightUpperArmPath),
    readFile(paths.rightForearmPath),
    readFile(paths.rightHandPath),
    readFile(paths.leftUpperArmPath),
    readFile(paths.leftForearmPath),
    readFile(paths.leftHandPath),
    readFile(paths.rightLegPath),
    readFile(paths.rightFootPath),
    readFile(paths.leftLegPath),
    readFile(paths.leftFootPath),
  ]);

  const [
    torso,
    rightUpperArm,
    rightForearm,
    rightHand,
    leftUpperArm,
    leftForearm,
    leftHand,
    rightLeg,
    rightFoot,
    leftLeg,
    leftFoot,
  ] = await Promise.all([
    scaleAndTint(torsoRaw, TORSO_SLOT.width, TORSO_SLOT.height, vibe),
    scaleAndTint(rightUpperArmRaw, UPPER_ARM_SLOT.width, UPPER_ARM_SLOT.height, vibe),
    scaleAndTint(rightForearmRaw, FOREARM_SLOT.width, FOREARM_SLOT.height, vibe),
    scaleAndTint(rightHandRaw, HAND_SLOT.width, HAND_SLOT.height, vibe),
    scaleAndTint(leftUpperArmRaw, UPPER_ARM_SLOT.width, UPPER_ARM_SLOT.height, vibe),
    scaleAndTint(leftForearmRaw, FOREARM_SLOT.width, FOREARM_SLOT.height, vibe),
    scaleAndTint(leftHandRaw, HAND_SLOT.width, HAND_SLOT.height, vibe),
    scaleAndTint(rightLegRaw, LEG_V3_SLOT.width, LEG_V3_SLOT.height, vibe),
    scaleAndTint(rightFootRaw, FOOT_SLOT.width, FOOT_SLOT.height, vibe),
    scaleAndTint(leftLegRaw, LEG_V3_SLOT.width, LEG_V3_SLOT.height, vibe),
    scaleAndTint(leftFootRaw, FOOT_SLOT.width, FOOT_SLOT.height, vibe),
  ]);

  return {
    torso,
    rightUpperArm,
    rightForearm,
    rightHand,
    leftUpperArm,
    leftForearm,
    leftHand,
    rightLeg,
    rightFoot,
    leftLeg,
    leftFoot,
  };
}

export type PreparedPhotoBody =
  | { schema: "v2"; parts: ScaledBodyParts; paths: ResolvedPartCrops }
  | { schema: "v3"; parts: ScaledBodyPartsV3; paths: ResolvedPartCropsV3 };

export async function prepareScaledBodyPartsFromDir(
  sourceDir: string,
  vibe: CharacterVibe,
  schema?: PhotoBodySchema,
): Promise<PreparedPhotoBody> {
  const resolved = schema ?? (await detectPhotoBodySchema(sourceDir));
  if (resolved === "v3") {
    const paths = await resolvePartCropPathsV3(sourceDir);
    const parts = await prepareScaledBodyPartsV3FromPaths(paths, vibe);
    return { schema: "v3", parts, paths };
  }
  const paths = await resolvePartCropPaths(sourceDir);
  const parts = await prepareScaledBodyPartsFromPaths(paths, vibe);
  return { schema: "v2", parts, paths };
}
