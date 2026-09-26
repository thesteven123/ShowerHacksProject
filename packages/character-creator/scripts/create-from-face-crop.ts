import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCharacterFromFaceCrop } from "../src/createCharacterFromFaceCrop.js";
import { upsertRosterCharacter } from "../src/roster.js";
import { faceCropUsage, parseFaceCropArgs } from "./lib/faceCropCli.js";

function usage(): never {
  console.error(faceCropUsage("create-from-face-crop"));
  console.error("\nWrites portrait + sheet to packages/character-creator/assets/built/<slug>/");
  process.exit(1);
}

async function main() {
  const args = await parseFaceCropArgs(process.argv.slice(2), usage);
  console.log("Face file:", args.faceCropPath);
  const faceCrop = await readFile(args.faceCropPath);

  const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outputDir = path.join(packageRoot, "assets", "built", args.slug);

  const character = await createCharacterFromFaceCrop(faceCrop, {
    id: args.slug,
    name: args.name,
    vibe: args.vibe,
    outputDir,
    publicPathPrefix: `/built/${args.slug}/`,
    headFraming: args.headFraming,
    bodyMode: args.bodyMode,
    sourceDir: args.sourceDir,
  });

  if (args.addToRoster) {
    await upsertRosterCharacter(character);
    console.log("Roster: updated characters.json →", character.id);
  }

  const jsonPath = path.join(outputDir, `${args.slug}.json`);
  await writeFile(jsonPath, JSON.stringify(character, null, 2));

  console.log("Built avatar in:", outputDir);
  console.log("  portrait:", `${args.slug}-portrait.png`);
  console.log("  sheet:   ", `${args.slug}-sheet.png`);
  console.log("  json:    ", `${args.slug}.json`);
  console.log(JSON.stringify(character, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
