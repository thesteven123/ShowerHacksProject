import type { Antic, FriendCharacter, GameEventType, Vibe } from "../shared/types";

const ANTICS: Record<Vibe, Record<GameEventType, Antic[]>> = {
  chaotic: {
    idle: [
      {
        id: "moonwalk",
        label: "moonwalks over your homework",
        vibe: "chaotic",
        event: "idle",
        effect: "wobble",
        sound: "giggle",
      },
      {
        id: "desk-surf",
        label: "surfs your taskbar like a skateboard",
        vibe: "chaotic",
        event: "idle",
        effect: "wobble",
        sound: "pop",
      },
      {
        id: "icon-shuffle",
        label: "is rearranging your icons for vibes",
        vibe: "chaotic",
        event: "idle",
        effect: "shake",
        sound: "giggle",
      },
      {
        id: "steal-cursor",
        label: "is trying to steal your cursor",
        vibe: "chaotic",
        event: "idle",
        effect: "wobble",
        sound: "giggle",
      },
      {
        id: "keyboard-smash",
        label: "is smash-dancing on the keyboard",
        vibe: "chaotic",
        event: "idle",
        effect: "shake",
        sound: "bonk",
      },
      {
        id: "six-seven",
        label: "is doing the 6-7 dance",
        vibe: "chaotic",
        event: "idle",
        effect: "wobble",
        sound: "giggle",
      },
    ],
    hit: [
      {
        id: "spin-out",
        label: "spins out like a crashed tab",
        vibe: "chaotic",
        event: "hit",
        effect: "shake",
        sound: "bonk",
      },
      {
        id: "rage-kick",
        label: "kicks the air and misses on purpose",
        vibe: "chaotic",
        event: "hit",
        effect: "shake",
        sound: "oof",
      },
    ],
    respawn: [
      {
        id: "desk-surf",
        label: "slides back onto the desktop worse",
        vibe: "chaotic",
        event: "respawn",
        effect: "pop",
        sound: "pop",
      },
      {
        id: "moonwalk",
        label: "moonwalks out of the recycle bin",
        vibe: "chaotic",
        event: "respawn",
        effect: "pop",
        sound: "giggle",
      },
    ],
  },
  dramatic: {
    idle: [
      {
        id: "monologue",
        label: "is monologuing at the wallpaper",
        vibe: "dramatic",
        event: "idle",
        effect: "dramatic-zoom",
        sound: "dramatic",
      },
      {
        id: "spotlight",
        label: "found a spotlight that does not exist",
        vibe: "dramatic",
        event: "idle",
        effect: "flash",
        sound: "dramatic",
      },
      {
        id: "slow-clap",
        label: "slow-claps your unread emails",
        vibe: "dramatic",
        event: "idle",
        effect: "wobble",
        sound: "gasp",
      },
      {
        id: "curtain-call",
        label: "takes a bow for an audience of zero",
        vibe: "dramatic",
        event: "idle",
        effect: "dramatic-zoom",
        sound: "dramatic",
      },
    ],
    hit: [
      {
        id: "faint",
        label: "faints in 4K",
        vibe: "dramatic",
        event: "hit",
        effect: "flash",
        sound: "gasp",
      },
      {
        id: "tragic-fall",
        label: "does a tragic fall, then checks if you saw",
        vibe: "dramatic",
        event: "hit",
        effect: "skull",
        sound: "dramatic",
      },
      {
        id: "dramatic-point",
        label: "points at you like a courtroom drama",
        vibe: "dramatic",
        event: "hit",
        effect: "flash",
        sound: "gasp",
      },
    ],
    respawn: [
      {
        id: "curtain-call",
        label: "returns for an unearned encore",
        vibe: "dramatic",
        event: "respawn",
        effect: "dramatic-zoom",
        sound: "dramatic",
      },
      {
        id: "spotlight",
        label: "respawns directly into the spotlight",
        vibe: "dramatic",
        event: "respawn",
        effect: "flash",
        sound: "gasp",
      },
    ],
  },
  supportive: {
    idle: [
      {
        id: "hype-dance",
        label: "is doing a tiny hype dance for you",
        vibe: "supportive",
        event: "idle",
        effect: "hearts",
        sound: "cheer",
      },
      {
        id: "water-break",
        label: "is reminding you to drink water, with jazz hands",
        vibe: "supportive",
        event: "idle",
        effect: "wobble",
        sound: "pop",
      },
      {
        id: "pep-talk",
        label: "is giving the desktop a pep talk",
        vibe: "supportive",
        event: "idle",
        effect: "hearts",
        sound: "cheer",
      },
      {
        id: "air-hug",
        label: "air-hugs the nearest window",
        vibe: "supportive",
        event: "idle",
        effect: "hearts",
        sound: "giggle",
      },
    ],
    hit: [
      {
        id: "thumbs-up",
        label: "gets hit and still throws a thumbs up",
        vibe: "supportive",
        event: "hit",
        effect: "sparkle",
        sound: "oof",
      },
      {
        id: "victory-wiggle",
        label: "wiggles like that was a high five",
        vibe: "supportive",
        event: "hit",
        effect: "sparkle",
        sound: "cheer",
      },
    ],
    respawn: [
      {
        id: "snack-run",
        label: "comes back with snacks for the team",
        vibe: "supportive",
        event: "respawn",
        effect: "pop",
        sound: "pop",
      },
      {
        id: "hype-dance",
        label: "respawns mid-hype-dance",
        vibe: "supportive",
        event: "respawn",
        effect: "hearts",
        sound: "cheer",
      },
    ],
  },
};

const SIX_SEVEN: Antic = {
  id: "six-seven",
  label: "is doing the 6-7 dance",
  vibe: "chaotic",
  event: "idle",
  effect: "wobble",
  sound: "giggle",
};

export function pickAntic(character: FriendCharacter, event: GameEventType): Antic {
  if ((character.id === "ravi" || character.id === "maanya" || character.id === "demo-alex") && event === "idle") {
    return SIX_SEVEN;
  }

  const pool = ANTICS[character.vibe][event];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function listAntics(vibe?: Vibe): Antic[] {
  const vibes: Vibe[] = vibe ? [vibe] : ["chaotic", "dramatic", "supportive"];
  return vibes.flatMap((item) =>
    (["idle", "hit", "respawn"] as const).flatMap((event) => ANTICS[item][event]),
  );
}
