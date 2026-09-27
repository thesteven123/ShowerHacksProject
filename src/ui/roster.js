/** Photo faces and bodies for the overlay. Game logic stays in the backend. */

const QUOTES = {
  chaotic: {
    idle: [
      "I'm not touching anything. I'm also touching everything.",
      "If you ignore me I will become the wallpaper.",
    ],
    hit: ["OW. You clicked me like a cookie banner.", "Rude."],
    respawn: ["I'm back and I'm worse.", "Death was mid. I'm clocking back in."],
  },
  dramatic: {
    idle: [
      "Do you hear that? That's the sound of being ignored.",
      "I am a limited-edition desktop moment.",
    ],
    hit: ["The AUDACITY. The DISRESPECT. The CLICK."],
    respawn: ["I have returned. Intermission is over."],
  },
  supportive: {
    idle: ["You're doing amazing. I'm just here being cute.", "Take a sip of water, bestie."],
    hit: ["Ow!! Still rooting for you though!!"],
    respawn: ["I'm okay!! Came back with snacks for the team."],
  },
};

function photoBody(id) {
  const slot = (file) => `./built/${id}/pipeline/${file}`;
  return {
    head: slot("2-portrait-64.png"),
    torso: slot("2-torso-slot.png"),
    armLeft: slot("3-right-upper-arm-slot.png"),
    forearmLeft: slot("4-right-forearm-slot.png"),
    handLeft: slot("5-right-hand-slot.png"),
    armRight: slot("6-left-upper-arm-slot.png"),
    forearmRight: slot("7-left-forearm-slot.png"),
    handRight: slot("8-left-hand-slot.png"),
    legLeft: slot("9-right-leg-slot.png"),
    footLeft: slot("10-right-foot-slot.png"),
    legRight: slot("11-left-leg-slot.png"),
    footRight: slot("12-left-foot-slot.png"),
  };
}

function friend(id, name, vibe, quotes) {
  return {
    id,
    name,
    imageUrl: `./built/${id}/${id}-portrait.png`,
    vibe,
    quotes,
    limbs: photoBody(id),
  };
}

/** Maanya, Kelvin, Philip, Steven — same order the desktop roster uses. */
export const frontendFriends = [
  friend("maanya-v3", "Maanya", "chaotic", {
    idle: ["I live here now.", "six seven", ...QUOTES.chaotic.idle],
    hit: QUOTES.chaotic.hit,
    respawn: QUOTES.chaotic.respawn,
  }),
  friend("kelvin-v3", "Kelvin", "supportive", {
    idle: ["Hitbox looks good from here.", "Frame-perfect idle.", ...QUOTES.supportive.idle],
    hit: ["That's a crit!", "Ouch — file a bug!", ...QUOTES.supportive.hit],
    respawn: ["Respawned with full HP.", ...QUOTES.supportive.respawn],
  }),
  friend("philip-v3", "Philip", "dramatic", QUOTES.dramatic),
  friend("steven-v3", "Steven", "chaotic", QUOTES.chaotic),
];

function personId(id) {
  return String(id || "").replace(/-v3$/, "");
}

/**
 * Keep backend friend records (quotes, vibe, id) and paint the frontend photos.
 * If the backend roster is still the demo names, use the four photo friends.
 */
export function friendsForFrontend(backendFriends) {
  if (!Array.isArray(backendFriends) || backendFriends.length === 0) return frontendFriends;
  const looks = new Map(frontendFriends.map((friend) => [personId(friend.id), friend]));
  let matched = 0;
  const painted = backendFriends.map((friend) => {
    const look = looks.get(personId(friend.id));
    if (!look) return friend;
    matched += 1;
    return {
      ...friend,
      name: friend.name || look.name,
      imageUrl: look.imageUrl,
      limbs: look.limbs,
    };
  });
  return matched ? painted : frontendFriends;
}
