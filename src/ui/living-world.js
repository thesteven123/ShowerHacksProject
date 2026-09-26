import { DesktopWorld } from "../game-browser/simulation/index.js";

/** DOM adapter for the local simulation. OS/window input stays in Electron. */
export function createLivingWorld({ friends, bounds, personality, arena, enabled, notify }) {
  const personalities = { [friends[0].id]: personality };
  const world = new DesktopWorld({ friends, bounds, personalities });
  const layer = document.createElement("div");
  layer.id = "living-world";
  const propLayer = document.createElement("div");
  propLayer.id = "world-props";
  layer.append(propLayer);
  arena.append(layer);
  const actors = new Map();
  const props = new Map();
  let dragging = null;

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
      dragging = friend.id;
      node.setPointerCapture(event.pointerId);
      world.dragTo(pointFor(event));
      render();
    });
    node.addEventListener("pointermove", event => {
      if (dragging !== friend.id) return;
      event.preventDefault(); event.stopPropagation();
      world.dragTo(pointFor(event)); render();
    });
    const release = event => {
      if (dragging !== friend.id) return;
      event.stopPropagation(); dragging = null;
      world.dragTo(pointFor(event)); world.releaseDrag(); render();
    };
    node.addEventListener("pointerup", release);
    node.addEventListener("pointercancel", release);
    actors.set(friend.id, { node, bubble }); layer.append(node);
  }
  friends.forEach(makeActor);

  world.subscribe(event => {
    if (event.type === "scene") notify(event);
    if (event.type === "propAdded" || event.type === "propsChanged") render();
  });

  function render() {
    const state = world.snapshot();
    for (const actor of state.actors) {
      const entry = actors.get(actor.id);
      entry.node.style.left = `${actor.position.x}px`;
      entry.node.style.top = `${actor.position.y}px`;
      entry.node.dataset.activity = actor.activity;
      const line = state.scene?.lines.find(item => item.speakerId === actor.id)?.text;
      entry.bubble.textContent = line ?? "";
      entry.bubble.hidden = !line;
    }
    const current = new Set(state.props.map(prop => prop.id));
    for (const [id, node] of props) if (!current.has(id)) { node.remove(); props.delete(id); }
    for (const prop of state.props) {
      let node = props.get(prop.id);
      if (!node) {
        node = document.createElement("div");
        node.className = `world-prop world-prop-${prop.type}`;
        node.setAttribute("aria-label", `virtual ${prop.type}`);
        node.textContent = prop.type === "note" ? "HEY!" : prop.type === "paper" ? "◌" : "●";
        propLayer.append(node); props.set(prop.id, node);
      }
      node.style.left = `${prop.position.x}px`;
      node.style.top = `${prop.position.y}px`;
    }
    return state;
  }
  function visible(show) { layer.classList.toggle("active", show); layer.hidden = !show; }
  render();
  return { world, visible, render };
}
