import {
  GameSystem,
  CONFIG,
  PERSONALITY_KEYS,
  randomPersonality,
  frameFor,
  hitboxFor,
  contains,
} from "../game-browser/game/index.js";
import { mockFriends } from "../game-browser/shared/mockFriends.js";
import { applyLimbs, doesSixSeven, figureMarkup } from "./figure.js";
import { createLivingWorld } from "./living-world.js";

const $ = (id) => document.getElementById(id);
const bridge = window.tinyMenaces;
document.body.classList.toggle("preview", !bridge);
const labels = {
  chaos: ["Chaos", "Calm routines → spontaneous antics"],
  brainrot: ["Brainrot", "Ordinary → very online"],
  competitive: ["Competitive", "Easygoing → always wants a rematch"],
  friendliness: ["Friendliness", "Reserved → loves company"],
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
let pendingAction = null;
const arena = $("arena"),
  target = $("target");

async function react(character, event, anger = 0) {
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
      localStorage.setItem(`tiny-menaces:world:v1:${saveKey}`, JSON.stringify(livingWorld.world.exportSave()));
  } catch {
    /* Storage is optional; the game remains playable. */
  }
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
function setMode(enabled) {
  engine.setInteractive(enabled);
  if (livingWorld && !enabled) livingWorld.world.setPaused(false);
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
    void react(character, "hit", current.state.anger);
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
    };
    // The multi-friend world owns autonomous companion dialogue. Keep only
    // player-triggered actions from the single-target game system here.
    if (!livingWorld || current.round || event.behavior === pendingAction) {
      if (event.behavior === "idle") void react(character, "idle");
      else say(reactions[event.behavior] || event.behavior);
    }
  } else if (event.type === "levelUp")
    toast(
      `Level ${event.level}! ${event.unlocked.length ? `Unlocked: ${event.unlocked.join(", ")}` : "Your friendship has history."}`,
    );
  else if (event.type === "roundAborted")
    toast("Round stopped. Unfinished rounds don't award XP.");
  else if (event.type === "roundCompleted") {
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
  const items = [
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
  $("result-comment").textContent =
    result.shots === 0
      ? "“Thanks for choosing peace.”"
      : result.accuracy >= 0.7
        ? "“Okay, you win. We're still friends though, right?”"
        : "“Were you aiming at me or decorating the desktop?”";
  $("result-context").textContent =
    `${result.difficulty.toUpperCase()} · Starting anger ${Math.round(result.startingAnger)}/100 · Anger changes target speed.`;
}
function render() {
  if (!engine) return;
  const state = engine.snapshot(),
    playing = !!state.round;
  document.body.classList.toggle("playing", playing);
  document.body.classList.toggle("result-visible", !!state.result);
  livingWorld?.visible(!playing && !state.result);
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
    "difficulty",
  ])
    $(id).disabled = !state.interactive || playing;
  for (const key of PERSONALITY_KEYS)
    $(`trait-${key}`).disabled = !state.interactive || playing;
  $("bark").disabled =
    !state.interactive || playing || !state.state.unlocks.includes("bark");
  $("say67").disabled =
    !state.interactive || playing || !state.state.unlocks.includes("say67");
  $("again").disabled = !state.interactive;
  $("arena-eyebrow").textContent = playing
    ? "AIM CHALLENGE / 30 SECONDS"
    : "COMPANION MODE";
  $("arena-title").textContent = playing
    ? "You can run. You can also bark."
    : "A little company. A little chaos.";
  $("play-tip").textContent = playing
    ? "Click your friend. Taunt windows give +5. Anger makes them faster."
    : "Pet your friend. Let them wander. See what happens.";
  if (playing) {
    $("time").textContent = (state.round.remainingMs / 1000).toFixed(1);
    $("score").textContent = state.round.score;
    $("streak").textContent = state.round.streak;
    $("accuracy").textContent = state.round.shots
      ? `${Math.round((state.round.hits / state.round.shots) * 100)}%`
      : "—";
  }
  const entity = state.round?.target || state.companion,
    layout = engine.layout;
  target.hidden = (!playing && !!livingWorld) || !!state.result || entity.phase === "hidden";
  target.dataset.phase = entity.phase;
  target.dataset.clip = entity.clip;
  target.dataset.taunt = String(entity.taunting);
  target.style.transform = `translate(${entity.x - layout.anchor.x * entity.scale}px, ${entity.y - layout.anchor.y * entity.scale}px) scale(${entity.scale})`;
  if (spriteUrl)
    target.querySelector(".sprite-art").style.backgroundPosition =
      `${-frameFor(entity.clip, entity.clipTimeMs, layout) * layout.frameWidth}px 0px`;
  $("taunt-badge").hidden = !playing || !entity.taunting;
  $("speech").style.left =
    `${Math.max(8, Math.min(arena.clientWidth - 228, entity.x - 50))}px`;
  $("speech").style.top =
    `${Math.max(12, entity.y - layout.anchor.y * entity.scale - 58)}px`;
  $("speech").hidden = !playing || performance.now() >= speechUntil || !!state.result;
  if (state.result && JSON.stringify(state.result) !== renderedResultKey) {
    resultView(state.result);
    renderedResultKey = JSON.stringify(state.result);
  }
  if (livingWorld && !playing && !state.result) {
    const worldState = livingWorld.render();
    $("world-count").textContent = `${worldState.actors.length} friends · ${worldState.props.filter(prop => prop.type === "ball").length} balls`;
    $("drop-ball").disabled = !state.interactive || worldState.props.length >= 12;
    $("undo-prop").disabled = !state.interactive || worldState.props.length === 0;
    $("clean-props").disabled = !state.interactive || worldState.props.length === 0;
  }
}
async function start() {
  const friends = bridge ? await bridge.listFriends() : mockFriends,
    friend = friends[0];
  if (!friend)
    throw new Error(
      "No friend available. The game needs at least one character.",
    );
  engine = new GameSystem({
    character: friend,
    bounds: { width: arena.clientWidth, height: arena.clientHeight },
  });
  saveKey = `tiny-menaces:pet:v1:${friend.id}`;
  try {
    const saved = localStorage.getItem(saveKey);
    if (saved) engine.importSave(JSON.parse(saved));
  } catch {
    /* Use fresh state if saved data is unavailable or invalid. */
  }
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
  });
  try {
    const stored = localStorage.getItem(`tiny-menaces:world:v1:${saveKey}`);
    if (stored) livingWorld.world.importSave(JSON.parse(stored));
  } catch { /* The local simulation starts fresh if saved data is unavailable. */ }
  livingWorld.world.setPersonality(friend.id, engine.snapshot().personality);
  engine.subscribe(handleEvent);
  $("friend-name").textContent = friend.name;
  const initials = friend.name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  $("friend-avatar").textContent = initials;
  const targetArt = target.querySelector(".placeholder-art");
  if (targetArt) {
    targetArt.innerHTML = figureMarkup();
    targetArt.classList.add("roaming", `vibe-${friend.vibe}`);
    if (doesSixSeven(friend)) targetArt.classList.add("antic-six-seven");
    applyLimbs(targetArt, friend);
  }
  target.setAttribute("aria-label", `${friend.name}, your desktop friend`);
  $("mode-toggle").hidden = !!bridge;
  $("manage-avatars").hidden = !bridge;
  $("manage-avatars").addEventListener("click", () => bridge?.openAvatarManager());
  $("mode-help").textContent = bridge
    ? "⌘ / Ctrl + Shift + M to interact · + A to manage avatars · + Q to quit"
    : "Browser preview · “Go quiet” simulates desktop mode";
  $("mode-toggle").addEventListener("click", () =>
    setMode(!engine.snapshot().interactive),
  );
  $("randomize").addEventListener("click", () => editor(randomPersonality()));
  $("save-personality").addEventListener("click", () => {
    const values = Object.fromEntries(
      PERSONALITY_KEYS.map((key) => [key, Number($(`trait-${key}`).value)]),
    );
    if (engine.setPersonality(values)) {
      livingWorld.world.setPersonality(friend.id, values);
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
    livingWorld.world.addProp("ball", { x: arena.clientWidth / 2, y: arena.clientHeight * 0.7 });
    save();
    render();
  });
  $("clean-props").addEventListener("click", () => { livingWorld.world.cleanDesktop(); save(); render(); });
  function begin() {
    if (engine.startRound("aim-challenge", $("difficulty").value)) {
      livingWorld.world.setPaused(true);
      speechUntil = 0;
      render();
      resizePending = true;
    }
  }
  $("start").addEventListener("click", begin);
  $("again").addEventListener("click", begin);
  $("stop").addEventListener("click", () => {
    engine.abortRound();
    livingWorld.world.setPaused(false);
    render();
    resizePending = true;
  });
  $("back").addEventListener("click", () => {
    engine.dismissResult();
    livingWorld.world.setPaused(false);
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
    if (event.button !== 0 || event.target.closest("button, #results")) return;
    engine.tick();
    const snapshot = engine.snapshot(),
      point = pointFor(event);
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
    bridge.onFriendsChange?.(() => window.location.reload());
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
