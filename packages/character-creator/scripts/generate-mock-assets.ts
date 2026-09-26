import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { FriendCharacter } from "@tiny-menaces/shared";
import { buildSpriteSheet } from "../src/buildSpriteSheet.js";
import { styleFace } from "../src/styleFace.js";
import { DEFAULT_SPRITE_LAYOUT } from "@tiny-menaces/shared";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "assets", "mocks");
const dataPath = path.join(root, "data", "mockCharacters.json");

type MockDef = {
  id: string;
  name: string;
  vibe: FriendCharacter["vibe"];
  color: string;
  quotes: FriendCharacter["quotes"];
};

const MOCKS: MockDef[] = [
  {
    id: "mock-alex",
    name: "Alex",
    vibe: "chaotic",
    color: "#ff6b9d",
    quotes: {
      idle: ["Don't look at me.", "I'm innocent."],
      hit: ["RUDE!", "That was my good side!"],
      respawn: ["You can't keep me down!"],
    },
  },
  {
    id: "mock-jordan",
    name: "Jordan",
    vibe: "dramatic",
    color: "#9b7bff",
    quotes: {
      idle: ["Observe my grandeur."],
      hit: ["Betrayal!", "The audacity!"],
      respawn: ["Curtain call!"],
    },
  },
  {
    id: "mock-sam",
    name: "Sam",
    vibe: "supportive",
    color: "#5ee0a8",
    quotes: {
      idle: ["You got this!", "Team gremlin!"],
      hit: ["Okay okay!", "Fair shot."],
      respawn: ["Back to cheer you on!"],
    },
  },
];

async function fakeFacePng(color: string, label: string): Promise<Buffer> {
  const size = 128;
  const svg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
      <circle cx="64" cy="52" r="28" fill="#ffe0bd"/>
      <circle cx="52" cy="48" r="4" fill="#222"/>
      <circle cx="76" cy="48" r="4" fill="#222"/>
      <path d="M 48 68 Q 64 78 80 68" stroke="#222" stroke-width="3" fill="none"/>
      <text x="64" y="118" text-anchor="middle" font-size="14" fill="#fff" font-family="sans-serif">${label}</text>
    </svg>`,
  );
  return sharp(svg).png().toBuffer();
}

async function main() {
  await mkdir(assetsDir, { recursive: true });
  await mkdir(path.join(root, "data"), { recursive: true });
  const characters: FriendCharacter[] = [];

  for (const mock of MOCKS) {
    const face = await fakeFacePng(mock.color, mock.name.slice(0, 1));
    const portrait = await styleFace(face, mock.vibe, 64);
    const sheet = await buildSpriteSheet(portrait, mock.vibe);

    const portraitName = `${mock.id}-portrait.png`;
    const sheetName = `${mock.id}-sheet.png`;
    await writeFile(path.join(assetsDir, portraitName), portrait);
    await writeFile(path.join(assetsDir, sheetName), sheet);

    characters.push({
      id: mock.id,
      name: mock.name,
      imageUrl: `/mocks/${portraitName}`,
      vibe: mock.vibe,
      quotes: mock.quotes,
      sprite: {
        spriteSheetUrl: `/mocks/${sheetName}`,
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
    });
  }

  const json = `${JSON.stringify(characters, null, 2)}\n`;
  await writeFile(dataPath, json);
  await writeFile(path.join(root, "assets", "mockCharacters.json"), json);
  console.log(`Wrote ${characters.length} dev mocks to ${dataPath} (does not touch characters.json)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
