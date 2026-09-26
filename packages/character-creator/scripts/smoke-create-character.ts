import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createCharacterFromPhoto } from "../src/createCharacterFromPhoto.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "assets", "smoke");
const samplePhoto = path.join(outDir, "sample-photo.png");

async function main() {
  await mkdir(outDir, { recursive: true });
  const photo = await sharp({
    create: { width: 400, height: 500, channels: 3, background: { r: 80, g: 120, b: 200 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="400" height="500"><circle cx="200" cy="180" r="90" fill="#ffe0bd"/></svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
  await writeFile(samplePhoto, photo);

  const character = await createCharacterFromPhoto(photo, {
    name: "Smoke Test",
    vibe: "chaotic",
    outputDir: outDir,
    publicPathPrefix: "/smoke/",
  });

  await readFile(path.join(outDir, path.basename(character.imageUrl)));
  await readFile(path.join(outDir, path.basename(character.sprite.spriteSheetUrl)));
  console.log("createCharacterFromPhoto OK:", character.id, character.name);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
