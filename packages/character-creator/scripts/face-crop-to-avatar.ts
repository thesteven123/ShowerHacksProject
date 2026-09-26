import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runFaceCropToAvatar } from "../src/createCharacterFromFaceCrop.js";
import { faceCropUsage, parseFaceCropArgs } from "./lib/faceCropCli.js";

function usage(): never {
  console.error(faceCropUsage("face-crop-to-avatar"));
  console.error(`
Deterministic stages (always written):
  assets/built/<slug>/pipeline/1-scaled-256.png
  assets/built/<slug>/pipeline/2-portrait-64.png
  assets/built/<slug>/pipeline/3-sheet.png
  assets/built/<slug>/<slug>.json
  assets/built/<slug>/<slug>-portrait.png
  assets/built/<slug>/<slug>-sheet.png`);
  process.exit(1);
}

async function main() {
  const args = await parseFaceCropArgs(process.argv.slice(2), usage);
  const faceCrop = await readFile(args.faceCropPath);

  const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outputDir = path.join(packageRoot, "assets", "built", args.slug);
  const intermediateDir = path.join(outputDir, "pipeline");

  const { character } = await runFaceCropToAvatar(faceCrop, {
    id: args.slug,
    name: args.name,
    vibe: args.vibe,
    outputDir,
    publicPathPrefix: `/built/${args.slug}/`,
    intermediateDir,
    headFraming: args.headFraming,
  });

  const jsonPath = path.join(outputDir, `${args.slug}.json`);
  await writeFile(jsonPath, JSON.stringify(character, null, 2));

  console.log("Face crop:", args.faceCropPath);
  console.log("Framing:  ", args.headFraming);
  console.log("Slug/id:  ", args.slug);
  console.log("Pipeline: ", intermediateDir);
  console.log("Avatar:   ", outputDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
