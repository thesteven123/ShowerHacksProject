import { DesktopWorld } from "../game-browser/simulation/index.js";
import { applyLimbs, doesSixSeven, figureMarkup } from "./figure.js";

const KICK_LINES = ["mine!", "yeet.", "got it.", "boop."];
const BUMP_LINES = ["oof.", "hey!", "watch it.", "ow."];
const SCORE_LINES = ["SCORE!", "board.", "that's game.", "easy."];
const SCORE_LINES_COMP = ["that's game.", "board.", "get cooked.", "mine forever."];

/** DOM adapter for the local simulation. OS/window input stays in Electron. */
export function createLivingWorld({ friends, bounds, personality, arena, enabled, notify, onRegions, onDragging, director, onSelectFriend, focusedFriendId }) {
  const focusId = focusedFriendId || friends[0]?.id;
  const personalities = focusId ? { [focusId]: personality } : {};
  const friendsById = new Map(friends.map(friend => [friend.id, friend]));
  const world = new DesktopWorld({ friends, bounds, personalities, director });
  const layer = document.createElement("div");
  layer.id = "living-world";
  layer.hidden = true;
  const propLayer = document.createElement("div");
  propLayer.id = "world-props";
  layer.append(propLayer);
  const hoopNode = document.createElement("div");
  hoopNode.className = "world-hoop";
  hoopNode.setAttribute("aria-label", "hoop");
  hoopNode.innerHTML = `<span class="world-hoop-rim"></span><span class="world-hoop-net"></span>`;
  propLayer.append(hoopNode);
  arena.append(layer);
  const actors = new Map();
  const props = new Map();
  const directSpeech = new Map();
  let dragging = null;
  let draggingBall = null;
  let lastRegionUpdate = -Infinity;
  let nextChantAt = 0;
  let nextTrashAt = 0;
  let focusedId = focusId;
  const lastTraits = new Map();
  const speechCooldownUntil = new Map();
  const dragOrigin = new Map();

  const pointFor = event => {
    const rect = arena.getBoundingClientRect();
    return { x: event.clientX - rect.left - arena.clientLeft, y: event.clientY - rect.top - arena.clientTop };
  };
  function pickLine(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
  }
  function blurt(actorId, text, durationMs = 1100) {
    const now = performance.now();
    if ((speechCooldownUntil.get(actorId) ?? 0) > now) return;
    speechCooldownUntil.set(actorId, now + 1500);
    directSpeech.set(actorId, { text, until: now + durationMs });
  }
  function spawnSparks(x, y, count = 4) {
    for (let i = 0; i < count; i++) {
      const spark = document.createElement("span");
      spark.className = "world-spark";
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 10 + Math.random() * 14;
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      spark.style.setProperty("--sx", `${Math.cos(angle) * dist}px`);
      spark.style.setProperty("--sy", `${Math.sin(angle) * dist}px`);
      propLayer.append(spark);
      setTimeout(() => spark.remove(), 420);
    }
  }
  function pulseBall(node, hard = false) {
    if (!node) return;
    node.classList.remove("ball-squash");
    void node.offsetWidth;
    node.classList.add("ball-squash");
    if (hard) node.classList.add("ball-squash-hard");
    setTimeout(() => node.classList.remove("ball-squash", "ball-squash-hard"), 220);
  }
  function makeActor(friend) {
    const node = document.createElement("div");
    node.className = `world-friend gremlin roaming vibe-${friend.vibe}`;
    node.dataset.actorId = friend.id;
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", `${friend.name}, desktop friend`);
    if (doesSixSeven(friend)) node.classList.add("antic-six-seven");
    node.innerHTML = figureMarkup();
    applyLimbs(node, friend);
    const bubble = document.createElement("div");
    bubble.className = "world-bubble";
    bubble.hidden = true;
    node.append(bubble);
    node.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !enabled() || !layer.classList.contains("active") || draggingBall) return;
      event.preventDefault(); event.stopPropagation();
      const position = world.snapshot().actors.find(actor => actor.id === friend.id).position;
      const point = pointFor(event);
      dragOrigin.set(friend.id, { ...point });
      dragging = {
        id: friend.id,
        pointerId: event.pointerId,
        offset: { x: position.x - point.x, y: position.y - point.y },
        moved: false,
        started: false,
      };
      node.setPointerCapture(event.pointerId);
    });
    node.addEventListener("pointermove", event => {
      if (dragging?.id !== friend.id || dragging.pointerId !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const point = pointFor(event);
      const origin = dragOrigin.get(friend.id);
      if (!dragging.started) {
        if (!origin || Math.hypot(point.x - origin.x, point.y - origin.y) <= 6) return;
        if (!world.startDrag(friend.id)) {
          dragging = null;
          dragOrigin.delete(friend.id);
          return;
        }
        dragging.started = true;
        dragging.moved = true;
        onDragging?.(true);
      }
      world.dragTo({ x: point.x + dragging.offset.x, y: point.y + dragging.offset.y });
      render();
    });
    const release = event => {
      if (dragging?.id !== friend.id || dragging.pointerId !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const point = pointFor(event);
      const wasClick = !dragging.started;
      if (dragging.started) {
        world.dragTo({ x: point.x + dragging.offset.x, y: point.y + dragging.offset.y });
        world.releaseDrag();
        onDragging?.(false);
      } else if (wasClick) {
        onSelectFriend?.(friend.id);
      }
      dragging = null;
      dragOrigin.delete(friend.id);
      render(true);
    };
    node.addEventListener("pointerup", release);
    node.addEventListener("pointercancel", release);
    node.addEventListener("lostpointercapture", () => {
      if (dragging?.id !== friend.id) return;
      if (dragging.started) {
        world.releaseDrag();
        onDragging?.(false);
      }
      dragging = null;
      dragOrigin.delete(friend.id);
      render(true);
    });
    actors.set(friend.id, { node, bubble }); layer.append(node);
  }
  friends.forEach(makeActor);

  function bindBallNode(node, propId) {
    node.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !enabled() || !layer.classList.contains("active") || dragging) return;
      if (!world.startBallDrag(propId)) return;
      event.preventDefault(); event.stopPropagation();
      const ball = world.snapshot().props.find(prop => prop.id === propId);
      if (!ball) return;
      const point = pointFor(event);
      draggingBall = { id: propId, pointerId: event.pointerId, offset: { x: ball.position.x - point.x, y: ball.position.y - point.y } };
      node.classList.add("dragging");
      node.setPointerCapture(event.pointerId);
      onDragging?.(true);
      render(true);
    });
    node.addEventListener("pointermove", event => {
      if (draggingBall?.id !== propId || draggingBall.pointerId !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const point = pointFor(event);
      world.dragBallTo({ x: point.x + draggingBall.offset.x, y: point.y + draggingBall.offset.y });
      render();
    });
    const releaseBall = event => {
      if (draggingBall?.id !== propId || draggingBall.pointerId !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const point = pointFor(event);
      world.dragBallTo({ x: point.x + draggingBall.offset.x, y: point.y + draggingBall.offset.y });
      draggingBall = null;
      node.classList.remove("dragging");
      world.releaseBallDrag();
      pulseBall(node, true);
      render(true);
      onDragging?.(false);
    };
    node.addEventListener("pointerup", releaseBall);
    node.addEventListener("pointercancel", releaseBall);
    node.addEventListener("lostpointercapture", () => {
      if (draggingBall?.id !== propId) return;
      draggingBall = null;
      node.classList.remove("dragging");
      world.releaseBallDrag();
      render(true);
      onDragging?.(false);
    });
  }

  world.subscribe(event => {
    if (event.type === "scene") {
      directSpeech.clear();
      notify(event);
    }
    if (event.type === "propAdded" || event.type === "propsChanged") render();
    if (event.type === "ballKicked") {
      if (typeof playSound === "function") playSound(event.strength > 320 ? "bonk" : "pop");
      const node = props.get(event.propId);
      pulseBall(node, event.strength > 320);
      const ball = world.snapshot().props.find(prop => prop.id === event.propId);
      if (ball) spawnSparks(ball.position.x, ball.position.y, event.strength > 320 ? 6 : 4);
      if (event.actorId) blurt(event.actorId, pickLine(KICK_LINES));
      render();
    }
    if (event.type === "ballBounced") {
      const node = props.get(event.propId);
      pulseBall(node, event.impact > 200);
      const ball = world.snapshot().props.find(prop => prop.id === event.propId);
      if (ball && event.impact > 80) spawnSparks(ball.position.x, ball.position.y, 3);
      render();
    }
    if (event.type === "actorsBumped") {
      if (typeof playSound === "function") playSound("oof");
      for (const id of event.actorIds) blurt(id, pickLine(BUMP_LINES), 900);
      render();
    }
    if (event.type === "goalScored") {
      if (!world.goalsAreEnabled?.() && !world.snapshot().hoop) {
        render();
        return;
      }
      const snap = world.snapshot();
      if (!snap.hoop) { render(); return; }
      hoopNode.classList.remove("hoop-score");
      void hoopNode.offsetWidth;
      hoopNode.classList.add("hoop-score");
      setTimeout(() => hoopNode.classList.remove("hoop-score"), 420);
      spawnSparks(snap.hoop.x + snap.hoop.width / 2, snap.hoop.y + snap.hoop.height / 2, 8);
      if (typeof playSound === "function") playSound("cheer");
      if (event.scorerId) {
        const scorer = snap.actors.find(actor => actor.id === event.scorerId);
        const lines = scorer && scorer.personality.competitive >= 7 ? SCORE_LINES_COMP : SCORE_LINES;
        blurt(event.scorerId, pickLine(lines), 1600);
      }
      notify?.(event);
      render();
    }
  });

  function speak(actorId, text, durationMs = 2600) {
    if (!actors.has(actorId) || typeof text !== "string" || !text.trim()) return false;
    directSpeech.set(actorId, { text: text.slice(0, 120), until: performance.now() + durationMs });
    render();
    return true;
  }

  function render(forceRegions = false) {
    const state = world.snapshot();
    const now = performance.now();
    const outbreak = state.actors.some(actor => actor.personality.brainrot >= 10);
    for (const actor of state.actors) {
      const entry = actors.get(actor.id);
      const previous = lastTraits.get(actor.id);
      const traits = actor.personality;
      if (previous && !outbreak) {
        if (previous.brainrot < 9 && traits.brainrot === 9)
          directSpeech.set(actor.id, { text: "67?", until: now + 1100 });
        if (previous.chaos < 10 && traits.chaos === 10)
          directSpeech.set(actor.id, { text: "I CAN'T STOP", until: now + 1400 });
        if (previous.competitive < 10 && traits.competitive === 10)
          directSpeech.set(actor.id, { text: "start soccer. i'll cook.", until: now + 1600 });
        if (previous.friendliness < 10 && traits.friendliness === 10)
          directSpeech.set(actor.id, { text: "come here.", until: now + 1400 });
        if (previous.friendliness > 0 && traits.friendliness === 0)
          directSpeech.set(actor.id, { text: "give me space.", until: now + 1400 });
      }
      lastTraits.set(actor.id, { ...traits });
      entry.node.classList.toggle("antic-six-seven", outbreak || doesSixSeven(friendsById.get(actor.id)));
      entry.node.classList.toggle("brainrot-max", outbreak);
      entry.node.classList.toggle("chaos-max", !outbreak && traits.chaos >= 10);
      entry.node.classList.toggle("locked-in", !outbreak && traits.competitive >= 10);
      entry.node.classList.toggle("clumped", !outbreak && traits.friendliness >= 10);
      entry.node.classList.toggle("loner", !outbreak && traits.friendliness <= 0);
      const chaos = traits.chaos;
      entry.node.style.setProperty("--step-rate", `${(0.95 - chaos * 0.06).toFixed(2)}s`);
      entry.node.style.setProperty("--move-rate", `${(1.35 - chaos * 0.08).toFixed(2)}s`);
      entry.node.style.left = `${actor.position.x}px`;
      entry.node.style.top = `${actor.position.y}px`;
      entry.node.dataset.activity = actor.activity;
      entry.node.classList.toggle("focused-friend", actor.id === focusedId);
      const speech = directSpeech.get(actor.id);
      if (speech && speech.until <= now) directSpeech.delete(actor.id);
      const line = speech?.until > now ? speech.text : state.scene?.lines.find(item => item.speakerId === actor.id)?.text;
      entry.bubble.textContent = line ?? "";
      entry.bubble.hidden = !line;
      entry.bubble.classList.toggle("bubble-left", actor.position.x > state.bounds.width - 190);
      entry.bubble.classList.toggle("bubble-below", actor.position.y < 180);
    }
    if (outbreak && now >= nextChantAt) {
      if (typeof playSound === "function") playSound("giggle");
      const until = now + 1900;
      for (const actor of state.actors)
        directSpeech.set(actor.id, { text: "SIX SEVEN. 6️⃣ 7️⃣", until });
      nextChantAt = now + 2200;
      for (const actor of state.actors) {
        const entry = actors.get(actor.id);
        entry.bubble.textContent = "SIX SEVEN. 6️⃣ 7️⃣";
        entry.bubble.hidden = false;
      }
    }
    if (!outbreak) nextChantAt = 0;
    if (!outbreak && now >= nextTrashAt) {
      const nag = state.actors.find(actor => actor.personality.competitive >= 10);
      if (nag) {
        blurt(nag.id, pickLine(["start soccer.", "hoop time.", "i'm waiting."]), 1400);
        nextTrashAt = now + 4200;
      }
    }
    hoopNode.hidden = !state.hoop;
    if (state.hoop) {
      hoopNode.style.left = `${state.hoop.x}px`;
      hoopNode.style.top = `${state.hoop.y}px`;
      hoopNode.style.width = `${state.hoop.width}px`;
      hoopNode.style.height = `${state.hoop.height}px`;
    }
    const visibleProps = state.props.filter(prop => prop.type === "ball");
    const current = new Set(visibleProps.map(prop => prop.id));
    for (const [id, node] of props) if (!current.has(id)) { node.remove(); props.delete(id); }
    for (const prop of visibleProps) {
      let node = props.get(prop.id);
      if (!node) {
        node = document.createElement("div");
        node.className = `world-prop world-prop-${prop.type}`;
        node.setAttribute("aria-label", `virtual ${prop.type}`);
        bindBallNode(node, prop.id);
        propLayer.append(node); props.set(prop.id, node);
      }
      const speed = Math.hypot(prop.velocity.x, prop.velocity.y);
      node.style.left = `${prop.position.x}px`;
      node.style.top = `${prop.position.y}px`;
      node.style.setProperty("--roll", `${prop.spin ?? 0}deg`);
      node.classList.toggle("ball-rolling", speed > 40);
      node.classList.toggle("dragging", draggingBall?.id === prop.id);
    }
    if (onRegions && !layer.hidden && (forceRegions || now - lastRegionUpdate >= 80)) {
      onRegions([...actors.values()].map(({ node }) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      }));
      lastRegionUpdate = now;
    }
    return state;
  }
  function setFocusedFriend(friendId) {
    if (!friendsById.has(friendId)) return false;
    focusedId = friendId;
    render(true);
    return true;
  }
  function visible(show) {
    if (layer.hidden === !show) return;
    layer.classList.toggle("active", show);
    layer.hidden = !show;
    if (show) render(true);
    else onRegions?.([]);
  }
  render();
  return { world, visible, render, speak, setFocusedFriend };
}
