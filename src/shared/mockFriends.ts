import type { FriendCharacter } from "./types";

const face = (seed: string) =>
  `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;

export const mockFriends: FriendCharacter[] = [
  {
    id: "demo-alex",
    name: "Alex",
    imageUrl: face("AlexChaos"),
    vibe: "chaotic",
    quotes: {
      idle: ["I live here now.", "six seven", "It's 6-7. I don't make the rules."],
      hit: ["Rude."],
      respawn: ["I'm back."],
    },
  },
  {
    id: "demo-blair",
    name: "Blair",
    imageUrl: face("BlairDrama"),
    vibe: "dramatic",
    quotes: {
      idle: ["The plot thickens."],
      hit: ["This is my origin story."],
      respawn: ["Act two."],
    },
  },
  {
    id: "demo-casey",
    name: "Casey",
    imageUrl: face("CaseyHype"),
    vibe: "supportive",
    quotes: {
      idle: ["You got this!"],
      hit: ["I meant to do that."],
      respawn: ["Still cheering."],
    },
  },
];
