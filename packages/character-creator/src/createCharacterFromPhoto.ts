import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SPRITE_LAYOUT, type CharacterVibe, type FriendCharacter } from "@tiny-menaces/shared";
import { buildSpriteSheet } from "./buildSpriteSheet.js";
import { cropFace } from "./cropFace.js";
import { styleFace } from "./styleFace.js";

export type CreateCharacterInput = {
  name: string;
  vibe: CharacterVibe;
  quotes?: FriendCharacter["quotes"];
  /** Directory where portrait + sprite PNGs are written. Created if missing. */
  outputDir: string;
  /** Base URL or relative path prefix for imageUrl / spriteSheetUrl in the returned object. */
  publicPathPrefix: string;
};

const DEFAULT_QUOTES: FriendCharacter["quotes"] = {
  idle: ["…"],
  hit: ["Hey!"],
  respawn: ["I'm back!"],
};

/**
 * Photo → face crop → styled portrait → 14-frame sprite sheet → FriendCharacter.
 */
export async function createCharacterFromPhoto(
  photo: Buffer,
  input: CreateCharacterInput,
): Promise<FriendCharacter> {
  const id = randomUUID();
  await mkdir(input.outputDir, { recursive: true });

  const cropped = await cropFace(photo);
  const portrait = await styleFace(cropped.buffer, input.vibe, 64);
  const sheet = await buildSpriteSheet(portrait, input.vibe);

  const portraitFile = `${id}-portrait.png`;
  const sheetFile = `${id}-sheet.png`;
  await writeFile(path.join(input.outputDir, portraitFile), portrait);
  await writeFile(path.join(input.outputDir, sheetFile), sheet);

  const prefix = input.publicPathPrefix.replace(/\/?$/, "/");

  return {
    id,
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
}
