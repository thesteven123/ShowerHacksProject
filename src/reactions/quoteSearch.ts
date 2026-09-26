import type { FriendCharacter, GameEventType } from "../shared/types";
import { vibeFallbacks } from "./vibeFallbacks";

export type QuoteDoc = {
  id: string;
  text: string;
  characterId: string;
  name: string;
  vibe: FriendCharacter["vibe"];
  event: GameEventType;
};

const EVENT_HINTS: Record<GameEventType, string[]> = {
  idle: ["idle", "wander", "lurk", "bored", "chill", "hang", "waiting"],
  hit: ["hit", "shot", "click", "ouch", "ow", "bonk", "kill", "attack"],
  respawn: ["respawn", "back", "revive", "again", "return", "sequel", "alive"],
};

export function flattenQuotes(characters: FriendCharacter[]): QuoteDoc[] {
  const docs: QuoteDoc[] = [];

  for (const character of characters) {
    for (const event of ["idle", "hit", "respawn"] as const) {
      const lines = character.quotes[event].length
        ? character.quotes[event]
        : vibeFallbacks[character.vibe][event];

      lines.forEach((text, index) => {
        docs.push({
          id: `${character.id}-${event}-${index}`,
          text,
          characterId: character.id,
          name: character.name,
          vibe: character.vibe,
          event,
        });
      });
    }
  }

  return docs;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function searchQuotes(
  docs: QuoteDoc[],
  query: string,
  options?: { characterId?: string; event?: GameEventType; limit?: number },
): QuoteDoc[] {
  const queryTokens = new Set([
    ...tokenize(query),
    ...(options?.event ? EVENT_HINTS[options.event] : []),
  ]);

  const scored = docs
    .filter((doc) => {
      if (options?.characterId && doc.characterId !== options.characterId) return false;
      if (options?.event && doc.event !== options.event) return false;
      return true;
    })
    .map((doc) => {
      const textTokens = tokenize(`${doc.text} ${doc.name} ${doc.vibe} ${doc.event}`);
      let score = 0;

      for (const token of textTokens) {
        if (queryTokens.has(token)) score += 2;
      }

      const lower = doc.text.toLowerCase();
      for (const token of queryTokens) {
        if (token.length > 3 && lower.includes(token)) score += 1;
      }

      if (options?.event && doc.event === options.event) score += 3;
      score += Math.random() * 0.4;

      return { doc, score };
    })
    .sort((a, b) => b.score - a.score);

  const limit = options?.limit ?? 5;
  return scored.slice(0, limit).map((entry) => entry.doc);
}

export function pickLocalQuote(
  character: FriendCharacter,
  event: GameEventType,
  query?: string,
): { text: string; source: "character" | "vibe-fallback" | "local-search" } {
  const own = character.quotes[event];
  const fallback = vibeFallbacks[character.vibe][event];
  const pool = own.length ? own : fallback;
  const source = own.length ? "character" : "vibe-fallback";

  if (!query || !query.trim()) {
    return { text: pool[Math.floor(Math.random() * pool.length)], source };
  }

  const docs = flattenQuotes([
    {
      ...character,
      quotes: {
        idle: event === "idle" ? pool : [],
        hit: event === "hit" ? pool : [],
        respawn: event === "respawn" ? pool : [],
      },
    },
  ]);

  const [best] = searchQuotes(docs, query, { characterId: character.id, event, limit: 1 });
  return { text: best?.text ?? pool[0], source: source === "character" ? "local-search" : source };
}
