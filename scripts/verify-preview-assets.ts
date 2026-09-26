/**
 * Midpoint stand-in for Electron overlay: ensures roster + sprite sheets are loadable.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FriendCharacter } from "@tiny-menaces/shared";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = path.join(repoRoot, "packages/character-creator/assets");

async function verifyRosterFile(label: string, jsonRel: string): Promise<void> {
  const jsonPath = path.join(assetsRoot, jsonRel);
  const raw = await readFile(jsonPath, "utf8");
  const roster = JSON.parse(raw) as FriendCharacter[];
  if (roster.length === 0) {
    console.warn(`WARN ${label}: empty roster`);
    return;
  }
  for (const c of roster) {
    const sheetPath = path.join(assetsRoot, c.sprite.spriteSheetUrl.replace(/^\//, ""));
    const portraitPath = path.join(assetsRoot, c.imageUrl.replace(/^\//, ""));
    await readFile(sheetPath);
    await readFile(portraitPath);
    console.log(`OK ${label} ${c.name}: sheet + portrait on disk`);
  }
}

async function main() {
  await verifyRosterFile("roster", "characters.json");
  try {
    await verifyRosterFile("dev-mock", "mockCharacters.json");
  } catch {
    console.warn("WARN dev mockCharacters.json missing — run npm run generate:mocks");
  }
  console.log("Asset verification passed (use npm run preview for animated check).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
