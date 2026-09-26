import type {
  FriendCharacter,
  GameEvent,
  GameEventType,
  Reaction,
  RoundEndReaction,
} from "../shared/types";
import { friendById } from "./mockFriends";
import { isMossReady, pickMossQuote } from "./mossSearch";
import { pickLocalQuote } from "./quoteSearch";
import { pickAntic } from "./antics";
import { playReactionSound } from "./sounds";
import { styleFor } from "./vibeFallbacks";

const EVENT_QUERIES: Record<GameEventType, string> = {
  idle: "wandering around the desktop being a little gremlin",
  hit: "just got clicked shot bonked ouch",
  respawn: "came back to life after getting hunted",
};

function buildReaction(
  character: FriendCharacter,
  event: GameEventType | "roundEnded",
  text: string,
  source: Reaction["source"],
): Reaction {
  const styleEvent: GameEventType = event === "roundEnded" ? "respawn" : event;
  const antic = pickAntic(character, styleEvent);
  const fallback = styleFor(character.vibe, styleEvent);
  const sixSevenLines = character.quotes.idle.filter((line) => /6-7|six seven/i.test(line));
  const line =
    antic.id === "six-seven" && sixSevenLines.length
      ? sixSevenLines[Math.floor(Math.random() * sixSevenLines.length)]
      : text;

  return {
    characterId: character.id,
    name: character.name,
    vibe: character.vibe,
    event,
    line,
    antic,
    effect: antic.effect ?? fallback.effect,
    sound: antic.sound ?? fallback.sound,
    source,
  };
}

/** Sync API for Person 3. Instant line + effect + sound id. */
export function getReaction(
  character: FriendCharacter,
  event: GameEventType,
  query = EVENT_QUERIES[event],
): Reaction {
  const picked = pickLocalQuote(character, event, query);
  return buildReaction(character, event, picked.text, picked.source);
}

export function getReactionById(
  characters: FriendCharacter[],
  characterId: string,
  event: GameEventType,
  query?: string,
): Reaction | null {
  const character = friendById(characters, characterId);
  if (!character) return null;
  return getReaction(character, event, query);
}

/** Async API for Moss. Same shape; falls back locally if Moss is offline. */
export async function getReactionAsync(
  character: FriendCharacter,
  event: GameEventType,
  query = EVENT_QUERIES[event],
): Promise<Reaction> {
  if (!isMossReady()) {
    return getReaction(character, event, query);
  }

  const picked = await pickMossQuote(character, event, query);
  return buildReaction(character, event, picked.text, picked.source);
}

export function getRoundEndReaction(
  characters: FriendCharacter[],
  score: number,
): RoundEndReaction {
  const headline =
    score >= 20
      ? "Desktop cleared. The group chat is in shambles."
      : score >= 10
        ? "Respectable hunt. The gremlins will remember this."
        : "The friends won. Your cursor needs a pep talk.";

  const reactions = characters.map((character) => {
    const line =
      score >= 20
        ? character.vibe === "supportive"
          ? "Okay that was actually kind of iconic."
          : character.vibe === "dramatic"
            ? `A tragedy in ${score} clicks.`
            : "You cooked. I'm filing a complaint."
        : score >= 10
          ? character.vibe === "supportive"
            ? "Solid effort!! Hydration check!!"
            : character.vibe === "dramatic"
              ? "I survived. Barely. Tell the press."
              : "Mid score. Rematch or you're scared."
          : character.vibe === "supportive"
            ? "It's okay!! We still like you!!"
            : character.vibe === "dramatic"
              ? "I lived. You missed your destiny."
              : "L. I'm living on this desktop now.";

    return buildReaction(character, "roundEnded", line, "character");
  });

  return { headline, score, reactions };
}

export function createReactionEngine(options: {
  characters: FriendCharacter[];
  onReaction: (reaction: Reaction) => void;
  playSounds?: boolean;
}) {
  const playSounds = options.playSounds ?? true;

  const emit = (reaction: Reaction | null) => {
    if (!reaction) return;
    if (playSounds) playReactionSound(reaction.sound);
    options.onReaction(reaction);
  };

  return {
    handleEvent(event: GameEvent) {
      if (event.type === "roundEnded") {
        const round = getRoundEndReaction(options.characters, event.score);
        round.reactions.forEach(emit);
        return round;
      }

      emit(getReactionById(options.characters, event.characterId, event.type));
      return null;
    },
    handleHit(characterId: string) {
      emit(getReactionById(options.characters, characterId, "hit"));
    },
    handleIdle(characterId: string) {
      emit(getReactionById(options.characters, characterId, "idle"));
    },
    handleRespawn(characterId: string) {
      emit(getReactionById(options.characters, characterId, "respawn"));
    },
    handleRoundEnded(score: number) {
      return getRoundEndReaction(options.characters, score);
    },
  };
}
