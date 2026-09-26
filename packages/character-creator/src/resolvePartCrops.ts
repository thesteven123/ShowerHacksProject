import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { BodyV3PartIndex, LimbPartIndex, PhotoBodySchema } from "./bodyPartSlots.js";

const PART_EXT = /\.(heic|jpe?g|png)$/i;

function partPattern(index: number): RegExp {
  return new RegExp(`(?:^|[^0-9])${index}(?:crop)?(?=\\.[^.]+$)`, "i");
}

function isPartFile(name: string, index: number): boolean {
  return PART_EXT.test(name) && partPattern(index).test(name);
}

function rankPartFile(name: string, index: number): number {
  const lower = name.toLowerCase();
  let score = 0;
  if (lower.includes(`${index}crop`)) score += 100;
  else if (new RegExp(`${index}\\.(heic|jpe?g|png)$`, "i").test(name)) score += 80;
  if (/\.(jpe?g|png)$/i.test(name)) score += 20;
  if (/\.heic$/i.test(name)) score += 10;
  return score;
}

export async function pickPartFile(dir: string, index: number): Promise<string | undefined> {
  const entries = await readdir(dir);
  const matches = entries.filter((e) => isPartFile(e, index)).sort((a, b) => rankPartFile(b, index) - rankPartFile(a, index));
  return matches[0] ? path.join(dir, matches[0]) : undefined;
}

export type ResolvedPartCrops = {
  torsoPath: string;
  rightArmPath: string;
  leftArmPath: string;
  rightLegPath: string;
  leftLegPath: string;
};

export type ResolvedPartCropsV3 = {
  torsoPath: string;
  rightUpperArmPath: string;
  rightForearmPath: string;
  rightHandPath: string;
  leftUpperArmPath: string;
  leftForearmPath: string;
  leftHandPath: string;
  rightLegPath: string;
  rightFootPath: string;
  leftLegPath: string;
  leftFootPath: string;
};

const V2_LABELS: Record<LimbPartIndex, string> = {
  2: "torso (*2* / *2crop*)",
  3: "right arm (*3* / *3crop*)",
  4: "left arm (*4* / *4crop*)",
  5: "right leg (*5* / *5crop*)",
  6: "left leg (*6* / *6crop*)",
};

const V2_PARTS: LimbPartIndex[] = [2, 3, 4, 5, 6];

const V3_LABELS: Record<BodyV3PartIndex, string> = {
  2: "torso (*2*)",
  3: "right upper arm (*3*)",
  4: "right forearm (*4*)",
  5: "right hand (*5*)",
  6: "left upper arm (*6*)",
  7: "left forearm (*7*)",
  8: "left hand (*8*)",
  9: "right leg (*9*)",
  10: "right foot (*10*)",
  11: "left leg (*11*)",
  12: "left foot (*12*)",
};

const V3_PARTS: BodyV3PartIndex[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * v3 when any index 7–12 crop exists (v2 folders only use 2–6).
 */
export async function detectPhotoBodySchema(sourceDir: string): Promise<PhotoBodySchema> {
  const abs = path.resolve(sourceDir);
  for (const index of [7, 8, 9, 10, 11, 12] as BodyV3PartIndex[]) {
    if (await pickPartFile(abs, index)) return "v3";
  }
  return "v2";
}

async function resolveIndexedParts<T extends number>(
  abs: string,
  indices: T[],
  labels: Record<T, string>,
): Promise<{ paths: Partial<Record<T, string>>; missing: string[] }> {
  const paths: Partial<Record<T, string>> = {};
  for (const index of indices) {
    const found = await pickPartFile(abs, index);
    if (found) paths[index] = found;
  }
  const missing = indices.filter((i) => !paths[i]).map((i) => labels[i]);
  return { paths, missing };
}

/**
 * Finds torso + four limb crops in a character source folder.
 * Face (*1*) is resolved separately.
 */
export async function resolvePartCropPaths(sourceDir: string): Promise<ResolvedPartCrops> {
  const abs = path.resolve(sourceDir);
  const info = await stat(abs);
  if (!info.isDirectory()) {
    throw new Error(`Photo body mode needs a character folder; got file: ${abs}`);
  }

  const { paths, missing } = await resolveIndexedParts(abs, V2_PARTS, V2_LABELS);

  if (missing.length > 0) {
    throw new Error(
      `Photo body mode is missing part crop(s) in ${abs}:\n  - ${missing.join("\n  - ")}\n` +
        `Add tight PNG/JPEG crops (see packages/character-creator/README.md).`,
    );
  }

  return {
    torsoPath: paths[2]!,
    rightArmPath: paths[3]!,
    leftArmPath: paths[4]!,
    rightLegPath: paths[5]!,
    leftLegPath: paths[6]!,
  };
}

export async function resolvePartCropPathsV3(sourceDir: string): Promise<ResolvedPartCropsV3> {
  const abs = path.resolve(sourceDir);
  const info = await stat(abs);
  if (!info.isDirectory()) {
    throw new Error(`Photo body v3 needs a character folder; got file: ${abs}`);
  }

  const { paths, missing } = await resolveIndexedParts(abs, V3_PARTS, V3_LABELS);

  if (missing.length > 0) {
    throw new Error(
      `Photo body v3 is missing part crop(s) in ${abs}:\n  - ${missing.join("\n  - ")}\n` +
        `Need indices 2–12 (see docs/body-v3-spec.md).`,
    );
  }

  return {
    torsoPath: paths[2]!,
    rightUpperArmPath: paths[3]!,
    rightForearmPath: paths[4]!,
    rightHandPath: paths[5]!,
    leftUpperArmPath: paths[6]!,
    leftForearmPath: paths[7]!,
    leftHandPath: paths[8]!,
    rightLegPath: paths[9]!,
    rightFootPath: paths[10]!,
    leftLegPath: paths[11]!,
    leftFootPath: paths[12]!,
  };
}
