const friendContainer = document.querySelector("#friends");
const modeStatus = document.querySelector("#mode-status");
const placements = [
  { left: "30%", top: "50%" },
  { left: "50%", top: "62%" },
  { left: "72%", top: "44%" },
];

const fallbackFriends = [
  { id: "demo-alex", name: "Alex", imageUrl: "", vibe: "chaotic" },
  { id: "demo-blair", name: "Blair", imageUrl: "", vibe: "dramatic" },
  { id: "demo-casey", name: "Casey", imageUrl: "", vibe: "supportive" },
];

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

function createCharacter(friend, index) {
  const character = document.createElement("button");
  character.type = "button";
  character.className = `gremlin roaming vibe-${friend.vibe}`;
  if (friend.vibe === "chaotic") character.classList.add("antic-six-seven");
  character.dataset.id = friend.id;
  character.setAttribute("aria-label", "desktop menace");
  character.style.left = placements[index % placements.length].left;
  character.style.top = placements[index % placements.length].top;
  character.innerHTML = figureMarkup();
  return character;
}

function startSixSevenChant(el) {
  const bubble = el.querySelector(".bubble");
  let saySix = true;
  const speak = () => {
    if (!bubble) return;
    bubble.textContent = saySix ? "six" : "seven";
    el.classList.add("show-bubble");
    saySix = !saySix;
  };
  speak();
  window.setInterval(speak, 350);
}

function updateMode(enabled) {
  document.body.classList.toggle("game-mode", enabled);
  if (modeStatus) {
    modeStatus.textContent = enabled
      ? "GAME MODE · clicks enabled · Ctrl/⌘ + Shift + M to return"
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
    if (friend.vibe === "chaotic") startSixSevenChant(character);
  });
  updateMode(gameMode);
}

start();
