/**
 * Midpoint stand-in for Electron overlay: ensures mock JSON + sprite sheets are loadable.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FriendCharacter } from "@tiny-menaces/shared";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = path.join(repoRoot, "packages/character-creator/assets");

async function main() {
  const jsonPath = path.join(assetsRoot, "mockCharacters.json");
  const raw = await readFile(jsonPath, "utf8");
  const roster = JSON.parse(raw) as FriendCharacter[];
  if (roster.length < 3) throw new Error("Expected at least 3 mock characters");

  for (const c of roster) {
    const sheetPath = path.join(assetsRoot, c.sprite.spriteSheetUrl.replace(/^\//, ""));
    const portraitPath = path.join(assetsRoot, c.imageUrl.replace(/^\//, ""));
    await readFile(sheetPath);
    await readFile(portraitPath);
    console.log(`OK ${c.name}: sheet + portrait on disk`);
  }
  console.log("Midpoint asset verification passed (use npm run preview for animated check).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
