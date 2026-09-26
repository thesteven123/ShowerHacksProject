import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FriendCharacter } from "@tiny-menaces/shared";

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export function rosterDataPath(): string {
  return path.join(packageRoot, "data", "characters.json");
}

export function rosterAssetsPath(): string {
  return path.join(packageRoot, "assets", "characters.json");
}

export async function loadRosterCharacters(): Promise<FriendCharacter[]> {
  const raw = await readFile(rosterDataPath(), "utf8");
  return JSON.parse(raw) as FriendCharacter[];
}

export type UpsertRosterOptions = {
  /** Keep existing quotes when re-building sprites (default true). */
  preserveQuotes?: boolean;
};

/**
 * Upsert one friend into data/ + assets/characters.json by id.
 */
export async function upsertRosterCharacter(
  character: FriendCharacter,
  options: UpsertRosterOptions = {},
): Promise<FriendCharacter> {
  const preserveQuotes = options.preserveQuotes !== false;
  await mkdir(path.join(packageRoot, "data"), { recursive: true });
  await mkdir(path.join(packageRoot, "assets"), { recursive: true });

  let roster: FriendCharacter[] = [];
  try {
    roster = await loadRosterCharacters();
  } catch {
    roster = [];
  }

  const index = roster.findIndex((c) => c.id === character.id);
  let merged = character;
  if (index >= 0 && preserveQuotes) {
    const existing = roster[index]!;
    merged = {
      ...character,
      quotes: existing.quotes,
      vibe: existing.vibe ?? character.vibe,
    };
  }

  if (index >= 0) {
    roster[index] = merged;
  } else {
    roster.push(merged);
  }

  const json = `${JSON.stringify(roster, null, 2)}\n`;
  await writeFile(rosterDataPath(), json);
  await writeFile(rosterAssetsPath(), json);
  return merged;
}
