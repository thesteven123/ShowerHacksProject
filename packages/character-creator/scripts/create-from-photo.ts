import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCharacterFromPhoto, type CreateCharacterInput } from "../src/createCharacterFromPhoto.js";
import type { CharacterVibe } from "@tiny-menaces/shared";

const VIBES: CharacterVibe[] = ["chaotic", "dramatic", "supportive"];

function usage(): never {
  console.error(`Usage: create-from-photo <photo-path> [--name Name] [--vibe ${VIBES.join("|")}]

Writes portrait + sprite sheet to packages/character-creator/assets/created/
and prints FriendCharacter JSON (paths relative to that folder).`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const photoPath = positional[0];
  if (!photoPath) usage();

  let name = "Friend";
  let vibe: CharacterVibe = "chaotic";

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--name" && argv[i + 1]) name = argv[++i];
    if (argv[i] === "--vibe" && argv[i + 1]) {
      const v = argv[++i] as CharacterVibe;
      if (!VIBES.includes(v)) usage();
      vibe = v;
    }
  }

  return { photoPath, name, vibe };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const absPhoto = path.resolve(args.photoPath);
  const photo = await readFile(absPhoto);

  const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outputDir = path.join(packageRoot, "assets", "created");
  await mkdir(outputDir, { recursive: true });

  const input: CreateCharacterInput = {
    name: args.name,
    vibe: args.vibe,
    outputDir,
    publicPathPrefix: "/created/",
  };

  const character = await createCharacterFromPhoto(photo, input);
  const exported = {
    ...character,
    imageUrl: `/created/${path.basename(character.imageUrl)}`,
    sprite: {
      ...character.sprite,
      spriteSheetUrl: `/created/${path.basename(character.sprite.spriteSheetUrl)}`,
    },
  };

  const jsonPath = path.join(outputDir, `${character.id}.json`);
  await writeFile(jsonPath, JSON.stringify(exported, null, 2));

  console.log("Created assets in:", outputDir);
  console.log("  portrait:", path.basename(character.imageUrl));
  console.log("  sheet:   ", path.basename(character.sprite.spriteSheetUrl));
  console.log("  json:    ", path.basename(jsonPath));
  console.log(
    `  sheet size: ${exported.sprite.frameWidth}×${exported.sprite.frameHeight}, ${exported.sprite.frameCount} frames (idle|walk|hit|respawn left→right)`,
  );
  console.log("\nOpen the *-sheet.png in Preview to scrub the animation strip.\n");
  console.log(JSON.stringify(exported, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
