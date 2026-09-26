import type { FriendCharacter } from "../shared/types";

const placeholder = (seed: string) =>
  `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;

/** Three fake friends so P3/P4/P5 can build before photo upload exists. */
export const MOCK_FRIENDS: FriendCharacter[] = [
  {
    id: "ravi",
    name: "Ravi",
    imageUrl: placeholder("RaviChaos"),
    vibe: "chaotic",
    quotes: {
      idle: [
        "I'm not touching anything. I'm also touching everything.",
        "Group chat energy: ungovernable.",
        "If you ignore me I will become the wallpaper.",
        "Currently committing crimes against productivity.",
        "I live here now. This is my desk.",
        "Don't look at me. I'm doing a bit.",
        "six seven",
        "It's 6-7. I don't make the rules.",
      ],
      hit: [
        "OW. You clicked me like a cookie banner.",
        "RUDENESS. I was mid-bit.",
        "That's assault. I'm texting the group chat.",
        "Bro I just got here.",
        "You missed my good side. Somehow.",
        "I hope your cursor cramps.",
        "Was that your final form? Weak.",
      ],
      respawn: [
        "I'm back and I'm worse.",
        "Death was mid. I'm clocking back in.",
        "You thought that was a kill? Cute.",
        "Respawned. Still not doing my homework.",
        "I crawled out of the recycle bin for this.",
      ],
    },
  },
  {
    id: "lila",
    name: "Lila",
    imageUrl: placeholder("LilaDrama"),
    vibe: "dramatic",
    quotes: {
      idle: [
        "Do you hear that? That's the sound of being ignored.",
        "I am a limited-edition desktop moment.",
        "The lighting in this room is a personal attack.",
        "I'm not lurking. I'm present.",
        "Someone dim the icons. I'm about to monologue.",
        "This wallpaper does not understand my brand.",
      ],
      hit: [
        "The AUDACITY. The DISRESPECT. The CLICK.",
        "I died as I lived: overreacting.",
        "Tell my story. Make it longer.",
        "This is the assassination of the century.",
        "I cannot BELIEVE you'd do this in front of my pixels.",
        "A lesser icon would have crumbled. I merely... crumbled.",
        "Note to self: trust no mouse.",
      ],
      respawn: [
        "I have returned. Intermission is over.",
        "Death? A plot twist. I'm the main character.",
        "Stand back. The sequel just dropped.",
        "They tried to close my tab. Fools.",
        "Bow. Or don't. I'll still make it about me.",
      ],
    },
  },
  {
    id: "noah",
    name: "Noah",
    imageUrl: placeholder("NoahHype"),
    vibe: "supportive",
    quotes: {
      idle: [
        "You're doing amazing. I'm just here being cute.",
        "Take a sip of water, bestie.",
        "I believe in you. And also in chaos.",
        "If you need a hype man I am already on the desktop.",
        "Love the focus. Hate that I have to be a target.",
        "Whenever you're ready. I already clapped.",
      ],
      hit: [
        "Okay okay! Love the enthusiasm!! Maybe less murder tho.",
        "That's fair. I would also click me.",
        "Ow!! Still rooting for you though!!",
        "Hit received. Friendship remains intact.",
        "You got me!! Proud of your aim tbh.",
        "Ouch with love. 10/10 click.",
        "I'm down but I'm not mad. I'm impressed.",
      ],
      respawn: [
        "I'm okay!! Came back with snacks for the team.",
        "Round two, let's GO. I believe in us.",
        "Respawned and I brought pep talks.",
        "That was a great shot. Please never do it again. Or do.",
        "Back!! Miss me? I missed me.",
      ],
    },
  },
];

export function friendById(
  characters: FriendCharacter[],
  id: string,
): FriendCharacter | undefined {
  return characters.find((friend) => friend.id === id);
}
