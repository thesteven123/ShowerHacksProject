import { DesktopWorld } from "../game-browser/simulation/index.js";

/** DOM adapter for the local simulation. OS/window input stays in Electron. */
export function createLivingWorld({ friends, bounds, personality, arena, enabled, notify, onRegions, onDragging, director }) {
  const personalities = { [friends[0].id]: personality };
  const world = new DesktopWorld({ friends, bounds, personalities, director });
  const layer = document.createElement("div");
  layer.id = "living-world";
  layer.hidden = true;
  const propLayer = document.createElement("div");
  propLayer.id = "world-props";
  layer.append(propLayer);
  arena.append(layer);
  const actors = new Map();
  const props = new Map();
  const directSpeech = new Map();
  let dragging = null;
  let lastRegionUpdate = -Infinity;

  const pointFor = event => {
    const rect = arena.getBoundingClientRect();
    return { x: event.clientX - rect.left - arena.clientLeft, y: event.clientY - rect.top - arena.clientTop };
  };
  function makeActor(friend) {
    const node = document.createElement("div");
    node.className = `world-friend vibe-${friend.vibe}`;
    node.dataset.actorId = friend.id;
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", `${friend.name}, desktop friend`);
    const face = document.createElement("div"); face.className = "world-face";
    if (friend.imageUrl) {
      const image = document.createElement("img"); image.src = friend.imageUrl; image.alt = ""; face.append(image);
    } else face.textContent = friend.name.trim()[0]?.toUpperCase() ?? "?";
    const body = document.createElement("div"); body.className = "world-body";
    const legs = document.createElement("div"); legs.className = "world-legs";
    const label = document.createElement("span"); label.className = "world-label"; label.textContent = friend.name;
    const bubble = document.createElement("div"); bubble.className = "world-bubble"; bubble.hidden = true;
    node.append(face, body, legs, label, bubble);
    node.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !enabled() || !layer.classList.contains("active")) return;
      if (!world.startDrag(friend.id)) return;
      event.preventDefault(); event.stopPropagation();
      const position = world.snapshot().actors.find(actor => actor.id === friend.id).position;
      const point = pointFor(event);
      dragging = { id: friend.id, pointerId: event.pointerId, offset: { x: position.x - point.x, y: position.y - point.y } };
      node.setPointerCapture(event.pointerId);
      onDragging?.(true);
      render(true);
    });
    node.addEventListener("pointermove", event => {
      if (dragging?.id !== friend.id || dragging.pointerId !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const point = pointFor(event);
      world.dragTo({ x: point.x + dragging.offset.x, y: point.y + dragging.offset.y });
      render();
    });
    const release = event => {
      if (dragging?.id !== friend.id || dragging.pointerId !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const point = pointFor(event);
      world.dragTo({ x: point.x + dragging.offset.x, y: point.y + dragging.offset.y });
      dragging = null;
      world.releaseDrag();
      render(true);
      onDragging?.(false);
    };
    node.addEventListener("pointerup", release);
    node.addEventListener("pointercancel", release);
    node.addEventListener("lostpointercapture", () => {
      if (dragging?.id !== friend.id) return;
      dragging = null;
      world.releaseDrag();
      render(true);
      onDragging?.(false);
    });
    actors.set(friend.id, { node, bubble }); layer.append(node);
  }
  friends.forEach(makeActor);

  world.subscribe(event => {
    if (event.type === "scene") {
      directSpeech.clear();
      notify(event);
    }
    if (event.type === "propAdded" || event.type === "propsChanged") render();
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
    for (const actor of state.actors) {
      const entry = actors.get(actor.id);
      entry.node.style.left = `${actor.position.x}px`;
      entry.node.style.top = `${actor.position.y}px`;
      entry.node.dataset.activity = actor.activity;
      const speech = directSpeech.get(actor.id);
      if (speech && speech.until <= now) directSpeech.delete(actor.id);
      const line = speech?.until > now ? speech.text : state.scene?.lines.find(item => item.speakerId === actor.id)?.text;
      entry.bubble.textContent = line ?? "";
      entry.bubble.hidden = !line;
      entry.bubble.classList.toggle("bubble-left", actor.position.x > state.bounds.width - 190);
      entry.bubble.classList.toggle("bubble-below", actor.position.y < 180);
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
        node.textContent = "●";
        propLayer.append(node); props.set(prop.id, node);
      }
      node.style.left = `${prop.position.x}px`;
      node.style.top = `${prop.position.y}px`;
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
  function visible(show) {
    if (layer.hidden === !show) return;
    layer.classList.toggle("active", show);
    layer.hidden = !show;
    if (show) render(true);
    else onRegions?.([]);
  }
  render();
  return { world, visible, render, speak };
}
