const friendContainer = document.querySelector("#friends");
const modeStatus = document.querySelector("#mode-status");
const placements = [
  { left: "18%", top: "37%" },
  { left: "48%", top: "57%" },
  { left: "78%", top: "37%" },
];

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function createCharacter(friend, index) {
  const character = document.createElement("article");
  character.className = `character vibe-${friend.vibe}`;
  character.setAttribute("aria-label", `${friend.name}, ${friend.vibe} demo character`);
  character.style.left = placements[index % placements.length].left;
  character.style.top = placements[index % placements.length].top;
  character.style.setProperty("--drift-delay", `${index * -0.8}s`);

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  if (friend.imageUrl) {
    const image = document.createElement("img");
    image.src = friend.imageUrl;
    image.alt = "";
    avatar.append(image);
  } else {
    avatar.textContent = initials(friend.name);
  }

  const name = document.createElement("strong");
  name.textContent = friend.name;
  const quote = document.createElement("span");
  quote.className = "quote";
  quote.textContent = friend.quotes.idle[0] ?? "";

  character.append(avatar, name, quote);
  return character;
}

function updateMode(enabled) {
  document.body.classList.toggle("game-mode", enabled);
  modeStatus.textContent = enabled
    ? "GAME MODE · clicks enabled · Ctrl/⌘ + Shift + M to return"
    : "TINY MENACES · Ctrl/⌘ + Shift + M to play";
}

async function start() {
  window.tinyMenaces.onModeChange(updateMode);
  const [friends, gameMode] = await Promise.all([
    window.tinyMenaces.listFriends(),
    window.tinyMenaces.getMode(),
  ]);
  friends.forEach((friend, index) => {
    friendContainer.append(createCharacter(friend, index));
  });
  updateMode(gameMode);
}

start();
