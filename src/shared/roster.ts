import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { vibeFallbacks } from "../reactions/vibeFallbacks";
import { mockFriends } from "./mockFriends";
import type { CharacterLimbs, CharacterSpriteSpec, FriendCharacter, Vibe } from "./types";

type RosterJson = FriendCharacter[];

const STUB_QUOTES = new Set(["…", "...", "Hey!", "I'm back!", "Ready when you are."]);

const VIBE_BY_ID: Record<string, Vibe> = {
  maanya: "chaotic",
  philip: "dramatic",
  kelvin: "supportive",
  steven: "chaotic",
};

const EXTRA_QUOTES: Record<string, FriendCharacter["quotes"]> = {
  maanya: {
    idle: ["I live here now.", "six seven", "It's 6-7. I don't make the rules."],
    hit: ["OW. You clicked me like a cookie banner.", "Rude."],
    respawn: ["I'm back and I'm worse.", "Death was mid. I'm clocking back in."],
  },
};

function repoRoot(): string {
  return path.resolve(__dirname, "../..");
}

function rosterPath(): string {
  return path.join(repoRoot(), "packages/character-creator/data/characters.json");
}

function toUiUrl(assetPath: string): string {
  return assetPath.replace(/^\//, "./");
}

function limbUrl(id: string, fileName: string): string | undefined {
  const relative = `built/${id}/pipeline/${fileName}`;
  const onDisk = path.join(repoRoot(), "packages/character-creator/assets", relative);
  return existsSync(onDisk) ? `./${relative.replace(/\\/g, "/")}` : undefined;
}

function portraitUrl(id: string, imageUrl: string): string {
  const builtPortrait = path.join(
    repoRoot(),
    "packages/character-creator/assets/built",
    id,
    `${id}-portrait.png`,
  );
  if (existsSync(builtPortrait)) return `./built/${id}/${id}-portrait.png`;
  return toUiUrl(imageUrl);
}

function attachLimbs(id: string): CharacterLimbs | undefined {
  const limbs: CharacterLimbs = {
    head: limbUrl(id, "2-portrait-64.png") ?? portraitUrl(id, ""),
    torso: limbUrl(id, "2-torso-slot.png"),
    // Camera-facing: character's right side is the viewer's left.
    armLeft: limbUrl(id, "3-right-arm-slot.png"),
    armRight: limbUrl(id, "4-left-arm-slot.png"),
    legLeft: limbUrl(id, "5-right-leg-slot.png"),
    legRight: limbUrl(id, "6-left-leg-slot.png"),
  };
  return limbs.head || limbs.torso ? limbs : undefined;
}

function rewriteSprite(id: string, sprite: CharacterSpriteSpec | undefined): CharacterSpriteSpec | undefined {
  if (!sprite) return undefined;
  const sheet = path.join(repoRoot(), "packages/character-creator/assets/built", id, `${id}-sheet.png`);
  return {
    ...sprite,
    spriteSheetUrl: existsSync(sheet) ? `./built/${id}/${id}-sheet.png` : toUiUrl(sprite.spriteSheetUrl),
  };
}

function realQuotes(lines: string[]): string[] {
  return lines.filter((line) => !STUB_QUOTES.has(line.trim()));
}

function enrich(character: FriendCharacter): FriendCharacter {
  const vibe = VIBE_BY_ID[character.id] ?? character.vibe;
  const extras = EXTRA_QUOTES[character.id] ?? vibeFallbacks[vibe];
  return {
    ...character,
    vibe,
    imageUrl: portraitUrl(character.id, character.imageUrl),
    sprite: rewriteSprite(character.id, character.sprite),
    limbs: attachLimbs(character.id),
    quotes: {
      idle: [...realQuotes(character.quotes.idle), ...extras.idle],
      hit: [...realQuotes(character.quotes.hit), ...extras.hit],
      respawn: [...realQuotes(character.quotes.respawn), ...extras.respawn],
    },
  };
}

export function loadRoster(): FriendCharacter[] {
  const file = rosterPath();
  if (!existsSync(file)) return mockFriends;

  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as RosterJson;
    if (!Array.isArray(parsed) || parsed.length === 0) return mockFriends;
    return parsed.map(enrich);
  } catch (error) {
    console.warn("Could not load Person 2 roster, using mock friends.", error);
    return mockFriends;
  }
}
