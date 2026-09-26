import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CharacterVibe } from "@tiny-menaces/shared";
import type { HeadFramingMode } from "../../src/headFraming.js";

const VIBES: CharacterVibe[] = ["chaotic", "dramatic", "supportive"];

const FACE_EXT = /\.(heic|jpe?g|png)$/i;
/** Photo index 1 = face; index 2 = body (ignored). */
const FACE_NAME = /(?:^|[^0-9])1(?:crop)?(?=\.[^.]+$)/i;
const BODY_NAME = /(?:^|[^0-9])2(?:crop)?(?=\.[^.]+$)/i;

const FRAMINGS: HeadFramingMode[] = ["template", "bbox"];

export type FaceCropCliArgs = {
  faceCropPath: string;
  name: string;
  vibe: CharacterVibe;
  slug: string;
  withIntermediates: boolean;
  headFraming: HeadFramingMode;
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
        `"${base}" looks like a body shot (2 in the name). Use the face file with 1 in the name, or pass the character folder under sources/.`,
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
      `No face file (name contains 1) in ${abs}. Add e.g. kelvin1crop.jpg or maanya1.HEIC; body shots (2) are skipped.`,
    );
  }

  return path.join(abs, faceFiles[0]!);
}

export function defaultSlugFromPath(absFaceCrop: string): string {
  const parent = path.basename(path.dirname(absFaceCrop));
  if (parent !== "sources" && parent !== "assets" && parent !== "character-creator") {
    return parent.toLowerCase();
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
    if (argv[i] === "--intermediates") withIntermediates = true;
  }

  const faceCropPath = await resolveFaceCropInput(inputPath);
  const baseSlug = (slug ?? defaultSlugFromPath(faceCropPath)).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const resolvedSlug = slugExplicit ? baseSlug : `${baseSlug}-${headFraming}`;

  if (name === "Friend" && resolvedSlug) {
    name = resolvedSlug.charAt(0).toUpperCase() + resolvedSlug.slice(1);
  }

  return { faceCropPath, name, vibe, slug: resolvedSlug, withIntermediates, headFraming };
}

export function faceCropUsage(scriptName: string): string {
  return `Usage: ${scriptName} <character-folder|face-file> [--name Name] [--vibe ${VIBES.join("|")}] [--framing ${FRAMINGS.join("|")}] [--slug id] [--intermediates]

Picks the face input automatically: filename must contain 1 (face); 2 is body and ignored.
When given a folder, prefers *1crop* JPEG/PNG, then *1* HEIC.
Default slug is <name>-template or <name>-bbox unless --slug is set.`;
}
