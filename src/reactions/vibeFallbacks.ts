import type { GameEventType, ReactionEffect, ReactionSound, Vibe } from "../shared/types";

export const vibeFallbacks: Record<Vibe, Record<GameEventType, string[]>> = {
  chaotic: {
    idle: [
      "I'm not touching anything. I'm also touching everything.",
      "If you ignore me I will become the wallpaper.",
      "Currently committing crimes against productivity.",
    ],
    hit: [
      "OW. You clicked me like a cookie banner.",
      "That's assault. I'm texting the group chat.",
      "I hope your cursor cramps.",
    ],
    respawn: [
      "I'm back and I'm worse.",
      "Death was mid. I'm clocking back in.",
      "You thought that was a kill? Cute.",
    ],
  },
  dramatic: {
    idle: [
      "Do you hear that? That's the sound of being ignored.",
      "I am a limited-edition desktop moment.",
      "I'm not lurking. I'm present.",
    ],
    hit: [
      "The AUDACITY. The DISRESPECT. The CLICK.",
      "I died as I lived: overreacting.",
      "This is the assassination of the century.",
    ],
    respawn: [
      "I have returned. Intermission is over.",
      "Death? A plot twist. I'm the main character.",
      "Stand back. The sequel just dropped.",
    ],
  },
  supportive: {
    idle: [
      "You're doing amazing. I'm just here being cute.",
      "Take a sip of water, bestie.",
      "If you need a hype man I am already on the desktop.",
    ],
    hit: [
      "Okay okay! Love the enthusiasm!! Maybe less murder tho.",
      "Ow!! Still rooting for you though!!",
      "Hit received. Friendship remains intact.",
    ],
    respawn: [
      "I'm okay!! Came back with snacks for the team.",
      "Round two, let's GO. I believe in us.",
      "Respawned and I brought pep talks.",
    ],
  },
};

const vibeStyle: Record<
  Vibe,
  Record<GameEventType, { effect: ReactionEffect; sound: ReactionSound }>
> = {
  chaotic: {
    idle: { effect: "wobble", sound: "giggle" },
    hit: { effect: "shake", sound: "bonk" },
    respawn: { effect: "pop", sound: "pop" },
  },
  dramatic: {
    idle: { effect: "dramatic-zoom", sound: "dramatic" },
    hit: { effect: "flash", sound: "gasp" },
    respawn: { effect: "skull", sound: "dramatic" },
  },
  supportive: {
    idle: { effect: "hearts", sound: "cheer" },
    hit: { effect: "sparkle", sound: "oof" },
    respawn: { effect: "hearts", sound: "cheer" },
  },
};

export function styleFor(vibe: Vibe, event: GameEventType): {
  effect: ReactionEffect;
  sound: ReactionSound;
} {
  return vibeStyle[vibe][event];
}
