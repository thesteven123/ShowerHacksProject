import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FriendCharacter } from "@tiny-menaces/shared";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Loads bundled mock roster (three fake friends). */
export async function loadMockCharacters(): Promise<FriendCharacter[]> {
  const jsonPath = path.join(moduleDir, "..", "data", "mockCharacters.json");
  const raw = await readFile(jsonPath, "utf8");
  return JSON.parse(raw) as FriendCharacter[];
}

export { loadMockCharacters as getMockCharacters };
