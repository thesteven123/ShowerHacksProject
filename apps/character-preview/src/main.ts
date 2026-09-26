import type { FriendCharacter } from "@tiny-menaces/shared";
import {
  advanceEntity,
  drawEntity,
  hitTest,
  playClip,
  type SpriteEntity,
} from "./spriteRenderer";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} missing (${res.status})`);
  return res.json() as Promise<T>;
}

async function loadRoster(includeDevMocks: boolean): Promise<FriendCharacter[]> {
  const roster = await fetchJson<FriendCharacter[]>("/characters.json");
  if (!includeDevMocks) return roster;
  try {
    const mocks = await fetchJson<FriendCharacter[]>("/mockCharacters.json");
    return [...roster, ...mocks];
  } catch {
    return roster;
  }
}

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const rosterSelect = document.getElementById("roster") as HTMLSelectElement;
const clipSelect = document.getElementById("clip") as HTMLSelectElement;
const devMocksCheckbox = document.getElementById("dev-mocks") as HTMLInputElement;
const quoteEl = document.getElementById("quote")!;
const statusEl = document.getElementById("status")!;

let characters: FriendCharacter[] = [];
let entity: SpriteEntity;

function pickQuote(c: FriendCharacter, kind: keyof FriendCharacter["quotes"]): string {
  const list = c.quotes[kind];
  return list[Math.floor(Math.random() * list.length)] ?? "…";
}

function syncRosterUI() {
  rosterSelect.innerHTML = "";
  for (const c of characters) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    rosterSelect.appendChild(opt);
  }
  const current = characters[0];
  if (!current) {
    statusEl.textContent = "No characters in roster — run face-crop:avatar with --roster";
    return;
  }
  entity = {
    character: current,
    x: canvas.width / 2,
    y: canvas.height / 2 + 40,
    clip: "idle",
    frameIndex: 0,
    clipElapsed: 0,
    clipDone: false,
  };
  playClip(entity, "idle");
  quoteEl.textContent = `"${pickQuote(current, "idle")}"`;
}

async function reloadCharacters() {
  characters = await loadRoster(devMocksCheckbox.checked);
  syncRosterUI();
}

rosterSelect.addEventListener("change", () => {
  const c = characters.find((x) => x.id === rosterSelect.value);
  if (!c || !entity) return;
  entity.character = c;
  playClip(entity, clipSelect.value as SpriteEntity["clip"]);
  quoteEl.textContent = `"${pickQuote(c, "idle")}"`;
});

clipSelect.addEventListener("change", () => {
  playClip(entity, clipSelect.value as SpriteEntity["clip"]);
});

devMocksCheckbox.addEventListener("change", () => {
  void reloadCharacters().catch((err) => {
    statusEl.textContent = String(err);
  });
});

canvas.addEventListener("click", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
  if (hitTest(entity, x, y)) {
    playClip(entity, "hit");
    quoteEl.innerHTML = `<span class="hit">HIT</span> — "${pickQuote(entity.character, "hit")}"`;
    statusEl.textContent = "Hitbox OK — Person 3 can reuse hitTest() from spriteRenderer.ts";
    window.setTimeout(() => {
      playClip(entity, "respawn");
      quoteEl.textContent = `"${pickQuote(entity.character, "respawn")}"`;
      window.setTimeout(() => playClip(entity, "idle"), 400);
    }, 350);
  }
});

document.getElementById("upload")!.addEventListener("change", () => {
  statusEl.textContent =
    "Upload runs in Node via createCharacterFromPhoto(); use face-crop:avatar --roster after adding crops.";
});

let last = performance.now();
function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (entity) {
    advanceEntity(entity, dt);
    if (entity.clip === "idle" || entity.clip === "walk") {
      entity.x += Math.sin(now / 500) * 0.4;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    void drawEntity(ctx, entity);
  }
  requestAnimationFrame(loop);
}

reloadCharacters()
  .then(() => {
    requestAnimationFrame(loop);
  })
  .catch((err) => {
    statusEl.textContent = String(err);
  });
