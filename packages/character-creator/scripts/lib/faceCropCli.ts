import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CharacterVibe } from "@tiny-menaces/shared";
import type { BodyMode } from "../../src/bodyPartSlots.js";
import type { HeadFramingMode } from "../../src/headFraming.js";

const VIBES: CharacterVibe[] = ["chaotic", "dramatic", "supportive"];

const FACE_EXT = /\.(heic|jpe?g|png)$/i;
/** Photo index 1 = face; 2 = torso; 3 = arm; 4 = leg (2–4 used in photo body mode). */
const FACE_NAME = /(?:^|[^0-9])1(?:crop)?(?=\.[^.]+$)/i;
const BODY_NAME = /(?:^|[^0-9])2(?:crop)?(?=\.[^.]+$)/i;

const FRAMINGS: HeadFramingMode[] = ["template", "bbox"];
const BODY_MODES: BodyMode[] = ["procedural", "photo"];

export type FaceCropCliArgs = {
  faceCropPath: string;
  sourceDir: string;
  name: string;
  vibe: CharacterVibe;
  slug: string;
  withIntermediates: boolean;
  headFraming: HeadFramingMode;
  bodyMode: BodyMode;
  addToRoster: boolean;
};

function isFaceFileName(name: string): boolean {
  return FACE_EXT.test(name) && FACE_NAME.test(name);
}

function isBodyFileName(name: string): boolean {
  return FACE_EXT.test(name) && BODY_NAME.test(name);
}

function rankFaceFile(name: string): number {
  const lower = name.toLowerCase();
  let score = 0;
  if (lower.includes("1crop")) score += 100;
  else if (/1\.(heic|jpe?g|png)$/i.test(name)) score += 80;
  if (/\.(jpe?g|png)$/i.test(name)) score += 20;
  if (/\.heic$/i.test(name)) score += 10;
  return score;
}

/**
 * Resolves a character folder or explicit path to the face asset (`*1*` / `*1crop*`).
 */
export async function resolveFaceCropInput(inputPath: string): Promise<string> {
  const abs = path.resolve(inputPath);
  const info = await stat(abs);

  if (info.isFile()) {
    const base = path.basename(abs);
    if (isBodyFileName(base)) {
      throw new Error(
        `"${base}" is a torso/body part file (2 in the name). Pass the character folder or the face file (*1* / *1crop*).`,
      );
    }
    if (!isFaceFileName(base)) {
      throw new Error(
        `"${base}" is not a recognized face file. Expected a name containing 1 (e.g. kelvin1crop.jpg or maanya1.HEIC).`,
      );
    }
    return abs;
  }

  if (!info.isDirectory()) {
    throw new Error(`Not a file or directory: ${abs}`);
  }

  const entries = await readdir(abs);
  const faceFiles = entries.filter(isFaceFileName).sort((a, b) => rankFaceFile(b) - rankFaceFile(a));

  if (faceFiles.length === 0) {
    throw new Error(
      `No face file (name contains 1) in ${abs}. Add e.g. kelvin1crop.jpg or maanya1.HEIC; torso/arm/leg use 2–4 in photo body mode.`,
    );
  }

  return path.join(abs, faceFiles[0]!);
}

export function defaultSlugFromPath(absFaceCrop: string): string {
  const dir = path.dirname(absFaceCrop);
  const parent = path.basename(dir);
  const grandparent = path.basename(path.dirname(dir));

  // e.g. sources/kelvin/v2_/kelvin1crop.jpg → kelvin-v2
  if (
    grandparent !== "sources" &&
    grandparent !== "assets" &&
    grandparent !== "character-creator" &&
    parent !== grandparent &&
    parent !== "sources"
  ) {
    const variant = parent.replace(/^_+|_+$/g, "").replace(/_/g, "-").toLowerCase();
    const character = grandparent.toLowerCase();
    const combined = variant ? `${character}-${variant}` : character;
    return combined.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  if (parent !== "sources" && parent !== "assets" && parent !== "character-creator") {
    return parent.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  return path.basename(absFaceCrop, path.extname(absFaceCrop)).replace(/1crop$/i, "").replace(/1$/i, "");
}

export async function parseFaceCropArgs(argv: string[], usage: () => never): Promise<FaceCropCliArgs> {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const inputPath = positional[0];
  if (!inputPath) usage();

  let name = "Friend";
  let vibe: CharacterVibe = "chaotic";
  let slug: string | undefined;
  let slugExplicit = false;
  let withIntermediates = false;
  let headFraming: HeadFramingMode = "bbox";
  let bodyMode: BodyMode = "procedural";
  let addToRoster = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--name" && argv[i + 1]) name = argv[++i];
    if (argv[i] === "--vibe" && argv[i + 1]) {
      const v = argv[++i] as CharacterVibe;
      if (!VIBES.includes(v)) usage();
      vibe = v;
    }
    if (argv[i] === "--slug" && argv[i + 1]) {
      slug = argv[++i];
      slugExplicit = true;
    }
    if (argv[i] === "--framing" && argv[i + 1]) {
      const f = argv[++i] as HeadFramingMode;
      if (!FRAMINGS.includes(f)) usage();
      headFraming = f;
    }
    if (argv[i] === "--body" && argv[i + 1]) {
      const b = argv[++i] as BodyMode;
      if (!BODY_MODES.includes(b)) usage();
      bodyMode = b;
    }
    if (argv[i] === "--intermediates") withIntermediates = true;
    if (argv[i] === "--roster") addToRoster = true;
  }

  const faceCropPath = await resolveFaceCropInput(inputPath);
  const sourceDir = path.dirname(faceCropPath);
  const baseSlug = (slug ?? defaultSlugFromPath(faceCropPath)).toLowerCase().replace(/[^a-z0-9-]+/g, "-");

  let resolvedSlug: string;
  if (slugExplicit) {
    resolvedSlug = baseSlug;
  } else if (bodyMode === "photo") {
    resolvedSlug = `${baseSlug}-photo`;
  } else {
    resolvedSlug = `${baseSlug}-${headFraming}`;
  }

  if (name === "Friend" && resolvedSlug) {
    name = resolvedSlug.charAt(0).toUpperCase() + resolvedSlug.slice(1);
  }

  return {
    faceCropPath,
    sourceDir,
    name,
    vibe,
    slug: resolvedSlug,
    withIntermediates,
    headFraming,
    bodyMode,
    addToRoster,
  };
}

export function faceCropUsage(scriptName: string): string {
  return `Usage: ${scriptName} <character-folder|face-file> [--name Name] [--vibe ${VIBES.join("|")}] [--framing ${FRAMINGS.join("|")}] [--body ${BODY_MODES.join("|")}] [--slug id] [--roster] [--intermediates]

Picks the face input automatically: filename must contain 1 (face).
Photo body mode (--body photo) requires *2* torso, *3* right arm, *4* left arm, *5* right leg, *6* left leg in the same folder.
When given a folder, prefers *1crop* JPEG/PNG, then *1* HEIC.
Default slug is <name>-template, <name>-bbox, or <name>-photo unless --slug is set.
--roster upserts into data/characters.json (real friends roster).`;
}
