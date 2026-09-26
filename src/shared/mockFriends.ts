import type { FriendCharacter } from "./types";

export const mockFriends: FriendCharacter[] = [
  {
    id: "demo-alex",
    name: "Alex",
    imageUrl: "",
    vibe: "chaotic",
    quotes: {
      idle: ["I live here now."],
      hit: ["Rude."],
      respawn: ["I'm back."],
    },
  },
  {
    id: "demo-blair",
    name: "Blair",
    imageUrl: "",
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
    imageUrl: "",
    vibe: "supportive",
    quotes: {
      idle: ["You got this!"],
      hit: ["I meant to do that."],
      respawn: ["Still cheering."],
    },
  },
];
