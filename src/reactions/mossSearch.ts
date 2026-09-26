import type { FriendCharacter, GameEventType } from "../shared/types";
import { flattenQuotes, pickLocalQuote, type QuoteDoc } from "./quoteSearch";

/**
 * Moss hook. Local search is the default so the demo works without keys.
 * When we have MOSS_PROJECT_ID / MOSS_PROJECT_KEY, wire `@moss-dev/moss` here:
 * createIndex("tiny-menaces-quotes"), loadIndex(), then query by event + name.
 */
export type MossQuotePicker = (
  character: FriendCharacter,
  event: GameEventType,
  query: string,
  docs: QuoteDoc[],
) => Promise<string | null>;

let mossReady = false;
let mossPicker: MossQuotePicker | null = null;

export async function initMossQuoteIndex(
  characters: FriendCharacter[],
  picker?: MossQuotePicker,
): Promise<boolean> {
  flattenQuotes(characters);
  mossPicker = picker ?? null;
  mossReady = Boolean(picker);
  return mossReady;
}

export function isMossReady(): boolean {
  return mossReady;
}

export async function pickMossQuote(
  character: FriendCharacter,
  event: GameEventType,
  query: string,
): Promise<{ text: string; source: "moss" | "character" | "vibe-fallback" | "local-search" }> {
  if (mossReady && mossPicker) {
    try {
      const text = await mossPicker(character, event, query, flattenQuotes([character]));
      if (text) return { text, source: "moss" };
    } catch {
      // Fall through to local search so a missed Moss call never blanks a reaction.
    }
  }

  return pickLocalQuote(character, event, query);
}
