import { readFile } from "node:fs/promises";
import type { CharacterVibe } from "@tiny-menaces/shared";
import { ARM_SLOT, LEG_SLOT, type ScaledBodyParts, TORSO_SLOT } from "./bodyPartSlots.js";
import { scalePartCrop } from "./cropFace.js";
import { resolvePartCropPaths, type ResolvedPartCrops } from "./resolvePartCrops.js";
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

export async function prepareScaledBodyPartsFromDir(
  sourceDir: string,
  vibe: CharacterVibe,
): Promise<{ parts: ScaledBodyParts; paths: ResolvedPartCrops }> {
  const paths = await resolvePartCropPaths(sourceDir);
  const parts = await prepareScaledBodyPartsFromPaths(paths, vibe);
  return { parts, paths };
}
