import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SPRITE_LAYOUT, type CharacterVibe, type FriendCharacter } from "@tiny-menaces/shared";
import { buildSpriteSheet } from "./buildSpriteSheet.js";
import { scaleFaceCrop } from "./cropFace.js";
import { drawSubjectRectOverlay, findSubjectRect, type HeadFramingMode } from "./headFraming.js";
import { styleFace } from "./styleFace.js";

export type FaceCropPipelineStage = "scaled" | "portrait" | "sheet";

export type FaceCropPipelineResult = {
  scaled256: Buffer;
  portrait: Buffer;
  sheet: Buffer;
  character: FriendCharacter;
};

export type CreateCharacterFromFaceCropInput = {
  /** Stable id (e.g. roster slug `kelvin`) — used in filenames and FriendCharacter.id */
  id: string;
  name: string;
  vibe: CharacterVibe;
  quotes?: FriendCharacter["quotes"];
  outputDir: string;
  publicPathPrefix: string;
  /** When set, writes scaled-256.png, portrait.png, sheet.png for reproducible diffs. */
  intermediateDir?: string;
  /** template (A) = fixed oval; bbox (B) = subject bbox fit, no oval */
  headFraming?: HeadFramingMode;
};

const DEFAULT_QUOTES: FriendCharacter["quotes"] = {
  idle: ["…"],
  hit: ["Hey!"],
  respawn: ["I'm back!"],
};

const SCALED_SIZE = 256;
const PORTRAIT_SIZE = 64;

/**
 * Face crop PNG/JPEG → scale (no cut) → styled portrait → sprite sheet → FriendCharacter.
 * Same inputs always produce the same PNG bytes (fixed sharp pipeline, no random ids).
 */
export async function runFaceCropToAvatar(
  faceCrop: Buffer,
  input: CreateCharacterFromFaceCropInput,
): Promise<FaceCropPipelineResult> {
  await mkdir(input.outputDir, { recursive: true });
  if (input.intermediateDir) {
    await mkdir(input.intermediateDir, { recursive: true });
  }

  const headFraming = input.headFraming ?? "bbox";

  const scaled = await scaleFaceCrop(faceCrop, SCALED_SIZE);
  const portrait = await styleFace(scaled.buffer, input.vibe, PORTRAIT_SIZE, {
    resizeFit: "contain",
    headFraming,
  });
  const sheet = await buildSpriteSheet(portrait, input.vibe, headFraming);

  const portraitFile = `${input.id}-portrait.png`;
  const sheetFile = `${input.id}-sheet.png`;
  await writeFile(path.join(input.outputDir, portraitFile), portrait);
  await writeFile(path.join(input.outputDir, sheetFile), sheet);

  if (input.intermediateDir) {
    await writeFile(path.join(input.intermediateDir, "1-scaled-256.png"), scaled.buffer);
    if (headFraming === "bbox") {
      const rect = await findSubjectRect(scaled.buffer);
      await writeFile(
        path.join(input.intermediateDir, "1b-subject-bbox.png"),
        await drawSubjectRectOverlay(scaled.buffer, rect),
      );
    }
    await writeFile(path.join(input.intermediateDir, "2-portrait-64.png"), portrait);
    await writeFile(path.join(input.intermediateDir, "3-sheet.png"), sheet);
  }

  const prefix = input.publicPathPrefix.replace(/\/?$/, "/");

  const character: FriendCharacter = {
    id: input.id,
    name: input.name,
    imageUrl: `${prefix}${portraitFile}`,
    vibe: input.vibe,
    quotes: input.quotes ?? DEFAULT_QUOTES,
    sprite: {
      spriteSheetUrl: `${prefix}${sheetFile}`,
      frameWidth: DEFAULT_SPRITE_LAYOUT.frameWidth,
      frameHeight: DEFAULT_SPRITE_LAYOUT.frameHeight,
      frameCount: DEFAULT_SPRITE_LAYOUT.frameCount,
      anchor: { ...DEFAULT_SPRITE_LAYOUT.anchor },
      hitbox: { ...DEFAULT_SPRITE_LAYOUT.hitbox },
      animations: {
        idle: { ...DEFAULT_SPRITE_LAYOUT.animations.idle },
        walk: { ...DEFAULT_SPRITE_LAYOUT.animations.walk },
        hit: { ...DEFAULT_SPRITE_LAYOUT.animations.hit },
        respawn: { ...DEFAULT_SPRITE_LAYOUT.animations.respawn },
      },
    },
  };

  return { scaled256: scaled.buffer, portrait, sheet, character };
}

export async function createCharacterFromFaceCrop(
  faceCrop: Buffer,
  input: CreateCharacterFromFaceCropInput,
): Promise<FriendCharacter> {
  const { character } = await runFaceCropToAvatar(faceCrop, input);
  return character;
}
