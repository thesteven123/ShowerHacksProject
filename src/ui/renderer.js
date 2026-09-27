import {
  GameSystem,
  CONFIG,
  PERSONALITY_KEYS,
  randomPersonality,
  frameFor,
  hitboxFor,
  contains,
} from "../game-browser/game/index.js";
import { applyLimbs, doesSixSeven, figureMarkup } from "./figure.js";
import { createLivingWorld } from "./living-world.js";
import { friendsForFrontend } from "./roster.js";

const $ = (id) => document.getElementById(id);
const bridge = window.tinyMenaces;
const VIBE_SOUNDS = {
  chaotic: { idle: "giggle", hit: "bonk", respawn: "pop" },
  dramatic: { idle: "dramatic", hit: "gasp", respawn: "dramatic" },
  supportive: { idle: "cheer", hit: "oof", respawn: "cheer" },
};
const ACTION_SOUNDS = {
  pet: "cheer",
  greet: "giggle",
  dance: "giggle",
  bark: "bonk",
  say67: "giggle",
  taunt: "gasp",
  "soccer-goal": "cheer",
};
window.addEventListener(
  "pointerdown",
  () => {
    if (typeof unlockAudio === "function") unlockAudio();
  },
  { capture: true },
);
document.body.classList.toggle("preview", !bridge);
const labels = {
  chaos: ["Chaos", "Calm routines → max it, they ricochet"],
  brainrot: ["Brainrot", "Ordinary → all the way up, they 67"],
  competitive: ["Competitive", "Easygoing → max it, they hunt harder in soccer"],
  friendliness: ["Friendliness", "Keep away → they clump up"],
};
let engine,
  spriteUrl = null,
  speechUntil = 0,
  noticeUntil = 0,
  hitUntil = 0,
  renderedResultKey = null;
let lastSave = 0,
  resizePending = true,
  saveKey;
let livingWorld;
let friendsReleased = new URLSearchParams(location.search).get("pop") === "1";
let pendingAction = null;
let lastGameId = "aim-challenge";
let rosterFriends = [];
let aimPreyId = null;
let soccerLayer = null;
let soccerFriendArt = null;
let soccerBallNode = null;
let soccerHoopNode = null;
let soccerDrag = null;
const arena = $("arena"),
  target = $("target");

function paintAimTarget(friend) {
  const targetArt = target.querySelector(".placeholder-art");
  if (!targetArt || !friend) return;
  targetArt.className = `placeholder-art roaming vibe-${friend.vibe}`;
  targetArt.innerHTML = figureMarkup();
  if (doesSixSeven(friend)) targetArt.classList.add("antic-six-seven");
  applyLimbs(targetArt, friend);
  target.setAttribute("aria-label", `${friend.name}, your desktop friend`);
}
function paintSoccerFriend(friend) {
  if (!soccerFriendArt || !friend) return;
  soccerFriendArt.className = `soccer-friend world-friend roaming vibe-${friend.vibe}`;
  soccerFriendArt.innerHTML = figureMarkup();
  if (doesSixSeven(friend)) soccerFriendArt.classList.add("antic-six-seven");
  applyLimbs(soccerFriendArt, friend);
  soccerFriendArt.setAttribute("aria-label", `${friend.name}, soccer`);
}
function paintAvatar(friend) {
  const avatar = $("friend-avatar");
  if (!avatar || !friend) return;
  avatar.textContent = "";
  avatar.title = friend.name;
  avatar.setAttribute("aria-label", `${friend.name}'s face`);
  if (friend.imageUrl) {
    avatar.style.backgroundImage = `url("${friend.imageUrl}")`;
    avatar.classList.add("has-face");
  } else {
    avatar.style.backgroundImage = "";
    avatar.classList.remove("has-face");
    avatar.textContent = friend.name.slice(0, 1).toUpperCase();
  }
}
function syncCrew(friends, activeId) {
  const crew = $("crew");
  if (!crew) return;
  crew.replaceChildren(
    ...friends.map((friend) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "crew-card";
      card.dataset.friendId = friend.id;
      card.setAttribute("aria-label", `${friend.name}, face and body`);
      card.setAttribute("aria-pressed", String(friend.id === activeId));
      if (friend.id === activeId) card.classList.add("selected");
      const stage = document.createElement("span");
      stage.className = "crew-stage";
      stage.innerHTML = figureMarkup();
      applyLimbs(stage, friend);
      const name = document.createElement("span");
      name.className = "crew-name";
      name.textContent = friend.name;
      card.append(stage, name);
      card.addEventListener("click", () => switchFriend(friend.id));
      return card;
    }),
  );
}
function petSaveKey(friendId) {
  return `tiny-menaces:pet:v1:${friendId}`;
}
function worldSaveKey(friendId) {
  return `tiny-menaces:world:v1:${petSaveKey(friendId)}`;
}
function loadPetSave(friendId) {
  try {
    const saved = localStorage.getItem(petSaveKey(friendId));
    if (saved) engine.importSave(JSON.parse(saved));
  } catch {
    /* Fresh state if saved data is unavailable or invalid. */
  }
}
function populateFriendSelect(friends, activeId) {
  const select = $("friend-select");
  if (!select) return;
  select.replaceChildren(
    ...friends.map((friend) => {
      const option = document.createElement("option");
      option.value = friend.id;
      option.textContent = friend.name;
      return option;
    }),
  );
  select.value = activeId;
  syncCrew(friends, activeId);
}
function updateFriendChrome(friend) {
  populateFriendSelect(rosterFriends, friend.id);
  paintAvatar(friend);
  paintAimTarget(friend);
  paintSoccerFriend(friend);
  livingWorld?.setFocusedFriend(friend.id);
}
function switchFriend(friendId) {
  if (!engine || !friendId) return false;
  const state = engine.snapshot();
  if (state.round || state.result) {
    toast("Finish or leave the round before switching friends.");
    populateFriendSelect(rosterFriends, state.character.id);
    return false;
  }
  if (friendId === state.character.id) {
    livingWorld?.setFocusedFriend(friendId);
    populateFriendSelect(rosterFriends, friendId);
    return true;
  }
  if (!rosterFriends.some((friend) => friend.id === friendId)) return false;
  save();
  if (!engine.selectFriend(friendId)) {
    populateFriendSelect(rosterFriends, state.character.id);
    return false;
  }
  saveKey = petSaveKey(friendId);
  loadPetSave(friendId);
  const next = engine.snapshot();
  livingWorld?.world.setPersonality(friendId, next.personality);
  editor(next.personality);
  updateFriendChrome(next.character);
  try {
    localStorage.setItem("tiny-menaces:active-friend", friendId);
  } catch {
    /* Preference is optional. */
  }
  save();
  render();
  return true;
}

function syncAimPrey(state) {
  if (!state.round || state.round.gameId !== "aim-challenge" || !state.round.preyId) {
    aimPreyId = null;
    return;
  }
  if (state.round.preyId === aimPreyId) return;
  aimPreyId = state.round.preyId;
  const prey =
    rosterFriends.find((friend) => friend.id === aimPreyId) || state.character;
  paintAimTarget(prey);
}

function ensureSoccerLayer(friend) {
  if (soccerLayer) return;
  soccerLayer = document.createElement("div");
  soccerLayer.id = "soccer-layer";
  soccerLayer.hidden = true;
  soccerHoopNode = document.createElement("div");
  soccerHoopNode.className = "world-hoop";
  soccerHoopNode.innerHTML = `<span class="world-hoop-rim"></span><span class="world-hoop-net"></span>`;
  soccerBallNode = document.createElement("div");
  soccerBallNode.className = "world-prop world-prop-ball soccer-ball";
  soccerFriendArt = document.createElement("div");
  soccerFriendArt.className = "soccer-friend world-friend roaming";
  soccerFriendArt.innerHTML = figureMarkup();
  if (friend) paintSoccerFriend(friend);
  soccerLayer.append(soccerHoopNode, soccerBallNode, soccerFriendArt);
  arena.append(soccerLayer);

  soccerLayer.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !engine) return;
    const snap = engine.snapshot();
    if (snap.round?.gameId !== "soccer") return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointForArena(event);
    const kind = event.target.closest(".soccer-ball")
      ? "ball"
      : event.target.closest(".soccer-friend")
        ? "friend"
        : null;
    if (kind && engine.arenaPointerDown(kind, point)) {
      soccerDrag = { pointerId: event.pointerId };
      soccerLayer.setPointerCapture(event.pointerId);
    } else {
      engine.shoot(point);
    }
    render();
  });
  soccerLayer.addEventListener("pointermove", (event) => {
    if (!soccerDrag || soccerDrag.pointerId !== event.pointerId) return;
    engine.arenaPointerMove(pointForArena(event));
    render();
  });
  const endSoccerDrag = (event) => {
    if (!soccerDrag || soccerDrag.pointerId !== event.pointerId) return;
    engine.arenaPointerUp(pointForArena(event));
    soccerDrag = null;
    render();
  };
  soccerLayer.addEventListener("pointerup", endSoccerDrag);
  soccerLayer.addEventListener("pointercancel", endSoccerDrag);
}

function pointForArena(event) {
  const rect = arena.getBoundingClientRect();
  return {
    x: event.clientX - rect.left - arena.clientLeft,
    y: event.clientY - rect.top - arena.clientTop,
  };
}

function renderSoccer(state) {
  const soccer = state.round?.gameId === "soccer" ? state.round.soccer : null;
  if (!soccerLayer) return;
  soccerLayer.hidden = !soccer;
  document.body.classList.toggle("soccer-playing", Boolean(soccer));
  if (!soccer) return;
  soccerHoopNode.style.left = `${soccer.hoop.x}px`;
  soccerHoopNode.style.top = `${soccer.hoop.y}px`;
  soccerHoopNode.style.width = `${soccer.hoop.width}px`;
  soccerHoopNode.style.height = `${soccer.hoop.height}px`;
  if (soccer.goals > (soccerHoopNode.dataset.goals | 0)) {
    soccerHoopNode.classList.remove("hoop-score");
    void soccerHoopNode.offsetWidth;
    soccerHoopNode.classList.add("hoop-score");
  }
  soccerHoopNode.dataset.goals = String(soccer.goals);
  soccerFriendArt.style.left = `${soccer.friend.x}px`;
  soccerFriendArt.style.top = `${soccer.friend.y}px`;
  soccerFriendArt.dataset.activity = soccer.friend.activity;
  if (soccer.ball) {
    soccerBallNode.hidden = false;
    soccerBallNode.style.left = `${soccer.ball.x}px`;
    soccerBallNode.style.top = `${soccer.ball.y}px`;
    soccerBallNode.style.setProperty("--roll", `${soccer.ball.spin}deg`);
  } else {
    soccerBallNode.hidden = true;
  }
}

function reactionSound(friend, event, anger = 0) {
  if (event === "hit" && anger >= 80) return "dramatic";
  if (event === "hit" && anger >= 30) return "oof";
  return VIBE_SOUNDS[friend?.vibe]?.[event] || (event === "hit" ? "bonk" : "pop");
}
async function react(character, event, anger = 0) {
  if (typeof playSound === "function") playSound(reactionSound(character, event, anger));
  if (event === "hit" && anger >= 80) {
    say("okay bet. RAGE MODE.");
    return;
  }
  if (event === "hit" && anger >= 30) {
    say("bro stop 😭");
    return;
  }
  try {
    if (bridge?.getReaction) {
      const reaction = await bridge.getReaction(character.id, event);
      if (reaction?.line) {
        say(reaction.line);
        return;
      }
    }
  } catch {
    /* Fall through to the character's own quotes. */
  }
  say(character.quotes?.[event]?.[0] || (event === "hit" ? "Rude." : "Just vibing."));
}

function toast(text) {
  $("notice").textContent = text;
  $("notice").hidden = false;
  noticeUntil = performance.now() + 3200;
}
function say(text) {
  if (livingWorld && engine && !engine.snapshot().round) {
    livingWorld.speak(engine.snapshot().character.id, text);
    speechUntil = 0;
    $("speech").hidden = true;
    return;
  }
  $("speech").textContent = text;
  $("speech").hidden = false;
  speechUntil = performance.now() + 2600;
}
function save() {
  try {
    localStorage.setItem(saveKey, JSON.stringify(engine.exportSave()));
    if (livingWorld)
      localStorage.setItem(worldSaveKey(engine.snapshot().character.id), JSON.stringify(livingWorld.world.exportSave()));
  } catch {
    /* Storage is optional; the game remains playable. */
  }
}
function currentPersonality() {
  return Object.fromEntries(
    PERSONALITY_KEYS.map((key) => [key, Number($(`trait-${key}`).value)]),
  );
}
function applyPersonalityLive() {
  if (!engine) return false;
  const values = currentPersonality();
  const friendId = engine.snapshot().character.id;
  if (livingWorld && !livingWorld.world.setPersonality(friendId, values)) return false;
  return engine.setPersonality(values);
}
function editor(personality) {
  for (const key of PERSONALITY_KEYS) {
    let input = $(`trait-${key}`);
    if (!input) {
      const row = document.createElement("div");
      row.className = "trait";
      const label = document.createElement("label");
      label.htmlFor = `trait-${key}`;
      label.append(document.createTextNode(labels[key][0]));
      const output = document.createElement("output");
      output.id = `trait-value-${key}`;
      label.append(output);
      input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = "10";
      input.step = "1";
      input.id = `trait-${key}`;
      input.addEventListener("input", () => {
        output.textContent = `${input.value} / 10`;
        applyPersonalityLive();
      });
      const description = document.createElement("small");
      description.textContent = labels[key][1];
      row.append(label, input, description);
      $("personality-controls").append(row);
    }
    input.value = personality[key];
    $(`trait-value-${key}`).textContent = `${personality[key]} / 10`;
  }
}
function releaseFriends() {
  if (friendsReleased || !livingWorld || !engine) return;
  friendsReleased = true;
  document.body.classList.remove("awaiting-continue");
  const gate = $("continue-gate");
  if (gate) gate.hidden = true;
  const state = engine.snapshot();
  if (!state.round && !state.result) livingWorld.world.setPaused(false);
  render();
}
function setMode(enabled) {
  if (enabled && typeof unlockAudio === "function") unlockAudio();
  engine.setInteractive(enabled);
  if (livingWorld && !friendsReleased) livingWorld.world.setPaused(true);
  else if (livingWorld && !enabled) livingWorld.world.setPaused(false);
  document.body.classList.toggle("quiet", !enabled);
  $("mode-status").textContent = enabled
    ? "INTERACTIVE · MAKE SOME TROUBLE"
    : "QUIET MODE · JUST HANGING OUT";
  $("mode-toggle").textContent = enabled ? "Go quiet" : "Interact";
  render();
}
function handleEvent(event) {
  const current = engine.snapshot(),
    character = current.character;
  if (event.type === "hit") {
    const position = current.round.target;
    $("hit-effect").style.left = `${position.x + 15}px`;
    $("hit-effect").style.top = `${position.y - 115}px`;
    $("hit-effect").hidden = false;
    hitUntil = performance.now() + 450;
    const prey =
      rosterFriends.find((friend) => friend.id === event.characterId) || character;
    void react(prey, "hit", current.state.anger);
  } else if (event.type === "respawn") {
    const who =
      rosterFriends.find((friend) => friend.id === event.characterId) || character;
    void react(who, "respawn");
  } else if (event.type === "behavior") {
    const reactions = {
      pet: "okay… you're my favorite ♡",
      greet: "hey. you doing okay?",
      idle: character.quotes.idle[0] || "Just vibing.",
      dance: "*a deeply unnecessary little dance*",
      bark: "WOOF. woof woof.",
      say67: "SIX SEVEN. 6️⃣ 7️⃣",
      taunt:
        current.personality.competitive >= 6
          ? "can't catch me. +5 if you can."
          : "a little break. don't you dare.",
      "soccer-goal":
        current.personality.competitive >= 7 ? "BOARD." : "score!",
    };
    // The multi-friend world owns autonomous companion dialogue. Keep only
    // player-triggered actions from the single-target game system here.
    if (!livingWorld || current.round || event.behavior === pendingAction) {
      if (event.behavior === "idle") void react(character, "idle");
      else {
        if (typeof playSound === "function") playSound(ACTION_SOUNDS[event.behavior] || "pop");
        say(reactions[event.behavior] || event.behavior);
      }
    }
  } else if (event.type === "levelUp") {
    if (typeof playSound === "function") playSound("cheer");
    toast(
      `Level ${event.level}! ${event.unlocked.length ? `Unlocked: ${event.unlocked.join(", ")}` : "Your friendship has history."}`,
    );
  }
  else if (event.type === "roundAborted")
    toast("Round stopped. Unfinished rounds don't award XP.");
  else if (event.type === "roundCompleted") {
    if (typeof playSound === "function") playSound("cheer");
    resultView(event.result);
    renderedResultKey = JSON.stringify(event.result);
  }
  if (["stateChanged", "roundCompleted", "levelUp"].includes(event.type))
    save();
  window.dispatchEvent(
    new CustomEvent("tiny-menaces:event", { detail: event }),
  );
}
function resultView(result) {
  $("result-score").textContent = result.score;
  const soccer = result.gameId === "soccer";
  const items = soccer
    ? [
        [result.hits, "Goals"],
        [result.shots, "Kicks"],
        [result.bestStreak, "Best streak"],
        [
          result.accuracy === null ? "—" : `${Math.round(result.accuracy * 100)}%`,
          "Finish rate",
        ],
        [`+${CONFIG.xpPerRound + result.hits * CONFIG.xpPerHit}`, "XP earned"],
      ]
    : [
        [
          result.accuracy === null ? "—" : `${Math.round(result.accuracy * 100)}%`,
          "Accuracy",
        ],
        [result.hits, "Hits"],
        [result.misses, "Misses"],
        [
          result.averageHitMs === null
            ? "—"
            : `${(result.averageHitMs / 1000).toFixed(2)}s`,
          "Average time to hit",
        ],
        [result.bestStreak, "Best streak"],
        [`+${CONFIG.xpPerRound + result.hits * CONFIG.xpPerHit}`, "XP earned"],
      ];
  $("result-grid").replaceChildren(
    ...items.map(([value, name]) => {
      const card = document.createElement("div"),
        strong = document.createElement("strong"),
        label = document.createElement("span");
      strong.textContent = value;
      label.textContent = name;
      card.append(strong, label);
      return card;
    }),
  );
  $("result-comment").textContent = soccer
    ? result.hits === 0
      ? "“Airball era. Rematch?”"
      : result.hits >= 3
        ? "“Okay, board owned.”"
        : "“Decent shift. Still not enough.”"
    : result.shots === 0
      ? "“Thanks for choosing peace.”"
      : result.accuracy >= 0.7
        ? "“Okay, you win. We're still friends though, right?”"
        : "“Were you aiming at me or decorating the desktop?”";
  $("result-context").textContent = soccer
    ? `${result.difficulty.toUpperCase()} · Competitive ${result.personality.competitive}/10 · Drag friend or ball, bank the hoop.`
    : `${result.difficulty.toUpperCase()} · Starting anger ${Math.round(result.startingAnger)}/100 · They dodge the cursor. Anger makes that faster.`;
}
function render() {
  if (!engine) return;
  const state = engine.snapshot(),
    playing = !!state.round;
  document.body.classList.toggle("playing", playing);
  document.body.classList.toggle("result-visible", !!state.result);
  document.body.classList.toggle("awaiting-continue", !friendsReleased);
  livingWorld?.visible(friendsReleased && !playing && !state.result);
  document.body.classList.toggle(
    "urgent",
    playing && state.round.remainingMs <= 5000,
  );
  $("hud").hidden = !playing;
  $("results").hidden = !state.result;
  $("level").textContent = `Level ${state.state.level}`;
  $("xp").value = state.state.xp % CONFIG.xpPerLevel;
  $("xp-label").textContent =
    `${state.state.xp % CONFIG.xpPerLevel} / ${CONFIG.xpPerLevel} XP`;
  for (const name of ["friendship", "anger"]) {
    $(name).value = state.state[name];
    $(`${name}-value`).textContent = Math.round(state.state[name]);
  }
  $("mode-status").textContent = !friendsReleased
    ? "CONTINUE · FRIENDS ARE WAITING"
    : state.interactive
      ? "INTERACTIVE · MAKE SOME TROUBLE"
      : "QUIET MODE · JUST HANGING OUT";
  $("mood").textContent =
    state.state.anger >= 80
      ? "Rage mode. You've been warned."
      : state.state.anger >= 30
        ? "A little annoyed. Still your friend."
        : state.state.friendship >= 50
          ? "Your little shadow."
          : "Just happy to be here.";
  $("friendship-hint").textContent =
    state.state.friendship >= 50
      ? "Cursor following unlocked. Move your mouse nearby."
      : "A little kindness goes a long way. Cursor following unlocks at 50.";
  for (const id of [
    "pet",
    "randomize",
    "save-personality",
    "start",
    "start-soccer",
    "difficulty",
    "friend-select",
  ])
    $(id).disabled = !friendsReleased || !state.interactive || playing;
  for (const key of PERSONALITY_KEYS)
    $(`trait-${key}`).disabled = !friendsReleased || !state.interactive || playing;
  $("bark").disabled =
    !friendsReleased || !state.interactive || playing || !state.state.unlocks.includes("bark");
  $("say67").disabled =
    !friendsReleased || !state.interactive || playing || !state.state.unlocks.includes("say67");
  $("again").disabled = !state.interactive;
  const soccer = playing && state.round.gameId === "soccer";
  $("arena-eyebrow").textContent = !friendsReleased
    ? "HOLD FOR CONTINUE"
    : playing
      ? soccer
        ? "SOCCER / 30 SECONDS"
        : "AIM CHALLENGE / 30 SECONDS"
      : "COMPANION MODE";
  $("arena-title").textContent = !friendsReleased
    ? "They're waiting off-screen."
    : playing
      ? soccer
        ? "Bank it. Competitive friends want that hoop."
        : "They see the cursor. They do not like it."
      : "A little company. A little chaos.";
  $("play-tip").textContent = !friendsReleased
    ? "Continue to let Maanya, Kelvin, Philip, and Steven onto the desktop."
    : playing
      ? soccer
        ? "Drag your friend or the ball. Score in the top-right hoop. Competitive = hungrier."
        : "Click anyone. After each hit a different friend can spawn. Taunts are +5."
      : "Pet your friend. Let them wander. See what happens.";
  if (playing) {
    $("time").textContent = (state.round.remainingMs / 1000).toFixed(1);
    $("score").textContent = state.round.score;
    $("streak").textContent = state.round.streak;
    $("accuracy").textContent = soccer
      ? `${state.round.hits} goals`
      : state.round.shots
        ? `${Math.round((state.round.hits / state.round.shots) * 100)}%`
        : "—";
  }
  syncAimPrey(state);
  const entity = state.round?.target || state.companion,
    layout = engine.layout;
  target.hidden =
    !friendsReleased ||
    soccer ||
    (!playing && !!livingWorld) ||
    !!state.result ||
    entity.phase === "hidden";
  target.dataset.phase = entity.phase;
  target.dataset.clip = entity.clip;
  target.dataset.taunt = String(entity.taunting);
  target.style.transform = `translate(${entity.x - layout.anchor.x * entity.scale}px, ${entity.y - layout.anchor.y * entity.scale}px) scale(${entity.scale})`;
  if (spriteUrl)
    target.querySelector(".sprite-art").style.backgroundPosition =
      `${-frameFor(entity.clip, entity.clipTimeMs, layout) * layout.frameWidth}px 0px`;
  $("taunt-badge").hidden = !playing || soccer || !entity.taunting;
  $("speech").style.left =
    `${Math.max(8, Math.min(arena.clientWidth - 228, entity.x - 50))}px`;
  $("speech").style.top =
    `${Math.max(12, entity.y - layout.anchor.y * entity.scale - 58)}px`;
  $("speech").hidden = !playing || soccer || performance.now() >= speechUntil || !!state.result;
  if (state.result && JSON.stringify(state.result) !== renderedResultKey) {
    resultView(state.result);
    renderedResultKey = JSON.stringify(state.result);
  }
  if (livingWorld && !playing && !state.result) {
    const worldState = livingWorld.render();
    $("world-count").textContent = `${worldState.actors.length} friends · ${worldState.props.filter(prop => prop.type === "ball").length} balls`;
    $("drop-ball").disabled = !friendsReleased || !state.interactive || worldState.props.length >= 12;
    $("undo-prop").disabled = !friendsReleased || !state.interactive || worldState.props.length === 0;
    $("clean-props").disabled = !friendsReleased || !state.interactive || worldState.props.length === 0;
  }
  renderSoccer(state);
}
async function start() {
  let backendFriends = null;
  if (bridge?.listFriends) {
    try {
      backendFriends = await bridge.listFriends();
    } catch {
      backendFriends = null;
    }
  }
  const friends = friendsForFrontend(backendFriends);
  if (!friends.length)
    throw new Error(
      "No friend available. The game needs at least one character.",
    );
  let preferredId = null;
  try {
    preferredId = localStorage.getItem("tiny-menaces:active-friend");
  } catch {
    /* Preference is optional. */
  }
  const friend =
    friends.find((entry) => entry.id === preferredId) || friends[0];
  rosterFriends = friends;
  engine = new GameSystem({
    character: friend,
    roster: friends,
    bounds: { width: arena.clientWidth, height: arena.clientHeight },
  });
  saveKey = petSaveKey(friend.id);
  loadPetSave(friend.id);
  editor(engine.snapshot().personality);
  livingWorld = createLivingWorld({
    friends,
    bounds: { width: arena.clientWidth, height: arena.clientHeight },
    personality: engine.snapshot().personality,
    arena,
    enabled: () => engine.snapshot().interactive || !!bridge,
    notify: () => save(),
    onRegions: bridge?.setPetRegions,
    onDragging: bridge?.setPetDragging,
    onSelectFriend: (friendId) => switchFriend(friendId),
    focusedFriendId: friend.id,
  });
  try {
    const stored = localStorage.getItem(worldSaveKey(friend.id));
    if (stored) livingWorld.world.importSave(JSON.parse(stored));
  } catch { /* The local simulation starts fresh if saved data is unavailable. */ }
  livingWorld.world.setPersonality(friend.id, engine.snapshot().personality);
  livingWorld.world.setPaused(true);
  livingWorld.visible(false);
  ensureSoccerLayer(friend);
  engine.subscribe(handleEvent);
  updateFriendChrome(friend);
  $("friend-select").addEventListener("change", (event) => {
    switchFriend(event.target.value);
  });
  $("mode-toggle").hidden = !!bridge;
  $("mode-help").textContent = bridge
    ? "⌘ / Ctrl + Shift + M to interact · ⌘ / Ctrl + Shift + Q to quit"
    : "Browser preview · “Go quiet” simulates desktop mode";
  $("mode-toggle").addEventListener("click", () =>
    setMode(!engine.snapshot().interactive),
  );
  $("randomize").addEventListener("click", () => {
    editor(randomPersonality());
    applyPersonalityLive();
  });
  $("save-personality").addEventListener("click", () => {
    if (applyPersonalityLive()) {
      save();
      toast("Personality saved. Same friend, their own kind of chaos.");
    }
  });
  for (const action of ["pet", "bark", "say67"])
    $(action).addEventListener("click", () => {
      pendingAction = action;
      const outcome = engine.perform(action);
      pendingAction = null;
      if (!outcome.accepted) toast(outcome.reason);
      render();
    });
  $("undo-prop").addEventListener("click", () => { livingWorld.world.undoProp(); save(); render(); });
  $("drop-ball").addEventListener("click", () => {
    if (typeof playSound === "function") playSound("pop");
    livingWorld.world.addProp("ball", {
      x: arena.clientWidth / 2,
      y: Math.min(120, arena.clientHeight * 0.18),
    });
    save();
    render();
  });
  $("clean-props").addEventListener("click", () => { livingWorld.world.cleanDesktop(); save(); render(); });
  function begin(gameId = lastGameId) {
    lastGameId = gameId;
    if (engine.startRound(gameId, $("difficulty").value)) {
      livingWorld.world.cleanDesktop();
      livingWorld.world.setPaused(true);
      speechUntil = 0;
      save();
      render();
      resizePending = true;
    }
  }
  $("start").addEventListener("click", () => begin("aim-challenge"));
  $("start-soccer").addEventListener("click", () => begin("soccer"));
  $("again").addEventListener("click", () => begin(lastGameId));
  $("continue-friends").addEventListener("click", releaseFriends);
  $("stop").addEventListener("click", () => {
    engine.abortRound();
    if (friendsReleased) livingWorld.world.setPaused(false);
    soccerDrag = null;
    render();
    resizePending = true;
  });
  $("back").addEventListener("click", () => {
    engine.dismissResult();
    if (friendsReleased) livingWorld.world.setPaused(false);
    render();
  });
  function pointFor(event) {
    const rect = arena.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - arena.clientLeft,
      y: event.clientY - rect.top - arena.clientTop,
    };
  }
  arena.addEventListener("pointermove", (event) =>
    engine.setPointer(pointFor(event)),
  );
  arena.addEventListener("pointerleave", () => engine.setPointer(null));
  arena.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, #results, #soccer-layer")) return;
    engine.tick();
    const snapshot = engine.snapshot(),
      point = pointFor(event);
    if (snapshot.round?.gameId === "soccer") return;
    if (snapshot.round) engine.shoot(point);
    else if (
      !livingWorld &&
      !snapshot.result &&
      contains(point, hitboxFor(snapshot.companion, engine.layout))
    )
      engine.perform("pet");
    render();
  });
  new ResizeObserver(() => {
    resizePending = true;
  }).observe(arena);
  if (bridge) {
    let changed = false;
    bridge.onModeChange((enabled) => {
      changed = true;
      setMode(enabled);
    });
    const initial = await bridge.getMode();
    if (!changed) setMode(initial);
  } else setMode(true);
  // Explicit adapter for the future sprite contract; do not assume its URL field name.
  window.tinyMenacesGame = {
    system: engine,
    world: livingWorld.world,
    speak: (actorId, text) => livingWorld.speak(actorId, text),
    async setSprite(sheetUrl) {
      const image = new Image();
      image.src = sheetUrl;
      await image.decode();
      if (image.naturalWidth !== 1008 || image.naturalHeight !== 108)
        throw new Error("Expected a 1008×108 v0.1 sprite strip");
      spriteUrl = sheetUrl;
      const art = target.querySelector(".sprite-art");
      art.style.backgroundImage = `url(${JSON.stringify(sheetUrl)})`;
      art.hidden = false;
      target.querySelector(".placeholder-art").hidden = true;
    },
  };
  // Person 3 owns motion/gameplay. Sprites stay Person 4's CSS figures + Person 2 photo limbs.
  window.addEventListener(
    "pagehide",
    () => {
      save();
      engine.destroy();
    },
    { once: true },
  );
  function frame(now) {
    if (resizePending && arena.clientWidth && arena.clientHeight) {
      engine.setBounds({
        width: arena.clientWidth,
        height: arena.clientHeight,
      });
      livingWorld.world.setBounds({ width: arena.clientWidth, height: arena.clientHeight });
      resizePending = false;
    }
    if (!friendsReleased) livingWorld.world.setPaused(true);
    engine.tick();
    livingWorld.world.tick(now);
    render();
    if (now >= noticeUntil) $("notice").hidden = true;
    if (now >= hitUntil) $("hit-effect").hidden = true;
    if (now - lastSave >= 1000) {
      save();
      lastSave = now;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
start().catch((error) => {
  console.error(error);
  $("mode-status").textContent = "Unable to load friend";
  toast(error.message);
});
