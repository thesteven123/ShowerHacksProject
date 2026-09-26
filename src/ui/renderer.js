const friendContainer = document.querySelector("#friends");
const modeStatus = document.querySelector("#mode-status");
const placements = [
  { left: "22%", top: "50%" },
  { left: "40%", top: "62%" },
  { left: "60%", top: "44%" },
  { left: "78%", top: "56%" },
];

const EFFECT_MS = 900;
const BUBBLE_MS = 2400;
const DOWN_MS = 650;
const RESPAWN_MS = 1200;
const IDLE_EVERY_MS = 5200;
const EFFECT_CLASSES = [
  "effect-shake",
  "effect-flash",
  "effect-sparkle",
  "effect-wobble",
  "effect-pop",
  "effect-dramatic-zoom",
  "effect-hearts",
  "effect-skull",
];

const vibeStyle = {
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

const fallbackFriends = [
  {
    id: "demo-alex",
    name: "Alex",
    imageUrl: "",
    vibe: "chaotic",
    quotes: { idle: ["six seven"], hit: ["Rude."], respawn: ["I'm back."] },
  },
  {
    id: "demo-blair",
    name: "Blair",
    imageUrl: "",
    vibe: "dramatic",
    quotes: { idle: ["The plot thickens."], hit: ["This is my origin story."], respawn: ["Act two."] },
  },
  {
    id: "demo-casey",
    name: "Casey",
    imageUrl: "",
    vibe: "supportive",
    quotes: { idle: ["You got this!"], hit: ["I meant to do that."], respawn: ["Still cheering."] },
  },
];

const actors = new Map();

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function doesSixSeven(friend) {
  return friend.id === "maanya" || friend.id === "ravi" || friend.id === "demo-alex";
}

function applyPhoto(node, url) {
  if (!node || !url) return;
  node.style.backgroundImage = `url("${url}")`;
  node.classList.add("has-photo");
}

function applyLimbs(el, friend) {
  const limbs = friend.limbs;
  if (!limbs) {
    if (friend.imageUrl) applyPhoto(el.querySelector(".head"), friend.imageUrl);
    return;
  }
  applyPhoto(el.querySelector(".head"), limbs.head);
  applyPhoto(el.querySelector(".torso"), limbs.torso);
  applyPhoto(el.querySelector(".arm.left"), limbs.armLeft);
  applyPhoto(el.querySelector(".arm.right"), limbs.armRight);
  applyPhoto(el.querySelector(".leg.left"), limbs.legLeft);
  applyPhoto(el.querySelector(".leg.right"), limbs.legRight);
}

function figureMarkup() {
  return `
    <div class="bubble"></div>
    <div class="figure" aria-hidden="true">
      <div class="head">
        <span class="eye left"></span>
        <span class="eye right"></span>
        <span class="mouth"></span>
      </div>
      <div class="torso">
        <span class="arm left">
          <span class="elbow"></span>
          <span class="forearm"><span class="hand"></span></span>
        </span>
        <span class="arm right">
          <span class="elbow"></span>
          <span class="forearm"><span class="hand"></span></span>
        </span>
      </div>
      <div class="legs">
        <span class="leg left"><span class="foot"></span></span>
        <span class="leg right"><span class="foot"></span></span>
      </div>
    </div>
  `;
}

function localReaction(friend, event) {
  const lines = friend.quotes?.[event] ?? [];
  const line = lines[Math.floor(Math.random() * Math.max(lines.length, 1))] || "...";
  const style = vibeStyle[friend.vibe]?.[event] ?? { effect: "shake", sound: "bonk" };
  return { line, effect: style.effect, sound: style.sound, event };
}

async function fetchReaction(friend, event) {
  try {
    if (window.tinyMenaces?.getReaction) {
      const reaction = await window.tinyMenaces.getReaction(friend.id, event);
      if (reaction) return reaction;
    }
  } catch (error) {
    console.warn("Could not load reaction from Electron, using local line.", error);
  }
  return localReaction(friend, event);
}

function startSixSevenChant(el) {
  const bubble = el.querySelector(".bubble");
  let saySix = true;
  const speak = () => {
    if (!bubble || el.dataset.busy === "1") return;
    bubble.textContent = saySix ? "six" : "seven";
    el.classList.add("show-bubble");
    saySix = !saySix;
  };
  speak();
  el._chant = window.setInterval(speak, 350);
}

function createCharacter(friend, index) {
  const character = document.createElement("button");
  character.type = "button";
  character.className = `gremlin roaming vibe-${friend.vibe}`;
  if (doesSixSeven(friend)) character.classList.add("antic-six-seven");
  character.dataset.id = friend.id;
  character.dataset.busy = "0";
  character.setAttribute("aria-label", "desktop menace");
  character.style.left = placements[index % placements.length].left;
  character.style.top = placements[index % placements.length].top;
  character.innerHTML = figureMarkup();
  applyLimbs(character, friend);
  character.addEventListener("click", (event) => {
    event.preventDefault();
    void handleHit(friend.id);
  });
  return character;
}

function applyReaction(el, reaction) {
  const bubble = el.querySelector(".bubble");
  el.classList.remove(...EFFECT_CLASSES);
  if (bubble && reaction.line) {
    bubble.textContent = reaction.line;
    el.classList.add("show-bubble");
  }
  if (reaction.effect) el.classList.add(`effect-${reaction.effect}`);
  if (typeof playReactionSound === "function" && reaction.sound) {
    playReactionSound(reaction.sound);
  }
}

function clearEffect(el) {
  el.classList.remove(...EFFECT_CLASSES);
}

function isBusy(el) {
  return el.dataset.busy === "1";
}

function setBusy(el, busy) {
  el.dataset.busy = busy ? "1" : "0";
}

async function handleHit(characterId) {
  if (!document.body.classList.contains("game-mode")) return;
  const actor = actors.get(characterId);
  if (!actor || isBusy(actor.el)) return;

  const { el, friend } = actor;
  setBusy(el, true);
  if (typeof unlockAudio === "function") unlockAudio();

  const hit = await fetchReaction(friend, "hit");
  applyReaction(el, hit);
  await wait(EFFECT_MS);
  clearEffect(el);
  el.classList.add("is-down");
  el.classList.remove("show-bubble");

  await wait(DOWN_MS);
  el.classList.remove("is-down");
  el.classList.add("is-respawning");

  const respawn = await fetchReaction(friend, "respawn");
  applyReaction(el, respawn);
  await wait(RESPAWN_MS);
  clearEffect(el);
  el.classList.remove("is-respawning");
  setBusy(el, false);
}

async function handleIdle(characterId) {
  const actor = actors.get(characterId);
  if (!actor || isBusy(actor.el)) return;

  const { el, friend } = actor;
  setBusy(el, true);
  const idle = await fetchReaction(friend, "idle");
  applyReaction(el, idle);
  await wait(BUBBLE_MS);
  clearEffect(el);
  if (!doesSixSeven(friend)) el.classList.remove("show-bubble");
  setBusy(el, false);
}

function startIdleLoop() {
  window.setInterval(() => {
    const ready = [...actors.values()].filter((actor) => !isBusy(actor.el));
    if (!ready.length) return;
    const actor = ready[Math.floor(Math.random() * ready.length)];
    void handleIdle(actor.friend.id);
  }, IDLE_EVERY_MS);
}

function updateMode(enabled) {
  document.body.classList.toggle("game-mode", enabled);
  if (enabled && typeof unlockAudio === "function") unlockAudio();
  if (modeStatus) {
    modeStatus.textContent = enabled
      ? "GAME MODE · click a gremlin · Ctrl/⌘ + Shift + M to return"
      : "TINY MENACES · Ctrl/⌘ + Shift + M to play";
  }
}

async function loadFriends() {
  try {
    if (window.tinyMenaces?.listFriends) {
      return await window.tinyMenaces.listFriends();
    }
  } catch (error) {
    console.warn("Could not load friends from Electron, using fallbacks.", error);
  }
  return fallbackFriends;
}

async function start() {
  if (!friendContainer) {
    console.error("Tiny Menaces: missing #friends container.");
    return;
  }

  updateMode(false);

  if (window.tinyMenaces?.onModeChange) {
    window.tinyMenaces.onModeChange(updateMode);
  }

  const friends = await loadFriends();
  const gameMode = (await window.tinyMenaces?.getMode?.()) ?? false;

  friends.forEach((friend, index) => {
    const character = createCharacter(friend, index);
    friendContainer.append(character);
    actors.set(friend.id, { el: character, friend });
    if (doesSixSeven(friend)) startSixSevenChant(character);
  });
  updateMode(gameMode);
  window.setTimeout(startIdleLoop, 1800);
}

start();
