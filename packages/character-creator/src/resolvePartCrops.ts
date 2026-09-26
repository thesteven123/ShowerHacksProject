import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { LimbPartIndex } from "./bodyPartSlots.js";

const PART_EXT = /\.(heic|jpe?g|png)$/i;

function partPattern(index: LimbPartIndex): RegExp {
  return new RegExp(`(?:^|[^0-9])${index}(?:crop)?(?=\\.[^.]+$)`, "i");
}

function isPartFile(name: string, index: LimbPartIndex): boolean {
  return PART_EXT.test(name) && partPattern(index).test(name);
}

function rankPartFile(name: string, index: LimbPartIndex): number {
  const lower = name.toLowerCase();
  let score = 0;
  if (lower.includes(`${index}crop`)) score += 100;
  else if (new RegExp(`${index}\\.(heic|jpe?g|png)$`, "i").test(name)) score += 80;
  if (/\.(jpe?g|png)$/i.test(name)) score += 20;
  if (/\.heic$/i.test(name)) score += 10;
  return score;
}

async function pickPartFile(dir: string, index: LimbPartIndex): Promise<string | undefined> {
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

const PART_LABELS: Record<LimbPartIndex, string> = {
  2: "torso (*2* / *2crop*)",
  3: "right arm (*3* / *3crop*)",
  4: "left arm (*4* / *4crop*)",
  5: "right leg (*5* / *5crop*)",
  6: "left leg (*6* / *6crop*)",
};

const REQUIRED_PARTS: LimbPartIndex[] = [2, 3, 4, 5, 6];

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

  const paths: Partial<Record<LimbPartIndex, string>> = {};
  for (const index of REQUIRED_PARTS) {
    const found = await pickPartFile(abs, index);
    if (found) paths[index] = found;
  }

  const missing = REQUIRED_PARTS.filter((i) => !paths[i]).map((i) => PART_LABELS[i]);

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
