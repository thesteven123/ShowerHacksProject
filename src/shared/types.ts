export type FriendCharacter = {
  id: string;
  name: string;
  imageUrl: string;
  vibe: "chaotic" | "dramatic" | "supportive";
  quotes: {
    idle: string[];
    hit: string[];
    respawn: string[];
  };
};

export type GameEvent =
  | { type: "hit"; characterId: string }
  | { type: "roundEnded"; score: number };
