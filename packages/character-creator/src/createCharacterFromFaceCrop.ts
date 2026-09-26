import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SPRITE_LAYOUT, type CharacterVibe, type FriendCharacter } from "@tiny-menaces/shared";
import { buildSpriteSheet } from "./buildSpriteSheet.js";
import type { BodyMode } from "./bodyPartSlots.js";
import { scaleFaceCrop } from "./cropFace.js";
import { drawSubjectRectOverlay, findSubjectRect, type HeadFramingMode } from "./headFraming.js";
import { prepareScaledBodyPartsFromDir } from "./prepareBodyParts.js";
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
  /** procedural = colored chibi limbs; photo = part crops 2–6 in sourceDir */
  bodyMode?: BodyMode;
  /** Character source folder for photo body parts (defaults to face file's directory). */
  sourceDir?: string;
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
  const bodyMode = input.bodyMode ?? "procedural";

  const scaled = await scaleFaceCrop(faceCrop, SCALED_SIZE);
  const portrait = await styleFace(scaled.buffer, input.vibe, PORTRAIT_SIZE, {
    resizeFit: "contain",
    headFraming,
  });

  let photoBody: Awaited<ReturnType<typeof prepareScaledBodyPartsFromDir>> | undefined;
  if (bodyMode === "photo" || bodyMode === "photo_v3") {
    const sourceDir = input.sourceDir;
    if (!sourceDir) {
      throw new Error("Photo body mode requires sourceDir (character folder with part crops).");
    }
    const forceSchema = bodyMode === "photo_v3" ? ("v3" as const) : undefined;
    photoBody = await prepareScaledBodyPartsFromDir(sourceDir, input.vibe, forceSchema);
  }

  const sheet = await buildSpriteSheet(
    portrait,
    input.vibe,
    headFraming,
    photoBody?.parts,
  );

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
    if (photoBody) {
      await writeFile(path.join(input.intermediateDir, "2-torso-slot.png"), photoBody.parts.torso);
      if (photoBody.schema === "v3") {
        const p = photoBody.parts;
        await writeFile(path.join(input.intermediateDir, "3-right-upper-arm-slot.png"), p.rightUpperArm);
        await writeFile(path.join(input.intermediateDir, "4-right-forearm-slot.png"), p.rightForearm);
        await writeFile(path.join(input.intermediateDir, "5-right-hand-slot.png"), p.rightHand);
        await writeFile(path.join(input.intermediateDir, "6-left-upper-arm-slot.png"), p.leftUpperArm);
        await writeFile(path.join(input.intermediateDir, "7-left-forearm-slot.png"), p.leftForearm);
        await writeFile(path.join(input.intermediateDir, "8-left-hand-slot.png"), p.leftHand);
        await writeFile(path.join(input.intermediateDir, "9-right-leg-slot.png"), p.rightLeg);
        await writeFile(path.join(input.intermediateDir, "10-right-foot-slot.png"), p.rightFoot);
        await writeFile(path.join(input.intermediateDir, "11-left-leg-slot.png"), p.leftLeg);
        await writeFile(path.join(input.intermediateDir, "12-left-foot-slot.png"), p.leftFoot);
      } else {
        const p = photoBody.parts;
        await writeFile(path.join(input.intermediateDir, "3-right-arm-slot.png"), p.rightArm);
        await writeFile(path.join(input.intermediateDir, "4-left-arm-slot.png"), p.leftArm);
        await writeFile(path.join(input.intermediateDir, "5-right-leg-slot.png"), p.rightLeg);
        await writeFile(path.join(input.intermediateDir, "6-left-leg-slot.png"), p.leftLeg);
      }
    }
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
