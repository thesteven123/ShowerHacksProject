const api = window.tinyMenaces;
const form = document.querySelector("#avatar-form");
const nameInput = document.querySelector("#avatar-name");
const list = document.querySelector("#avatar-list");
const count = document.querySelector("#avatar-count");
const status = document.querySelector("#manager-status");
const createButton = document.querySelector("#create-avatar");

function showStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.error = String(isError);
}

function initials(name) {
  return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function makeAvatarCard(avatar) {
  const card = document.createElement("article");
  card.className = "avatar-card";
  card.setAttribute("role", "listitem");

  const picture = document.createElement("div");
  picture.className = "avatar-image";
  picture.textContent = initials(avatar.name);
  if (avatar.imageUrl) {
    const image = document.createElement("img");
    image.src = avatar.imageUrl;
    image.alt = `${avatar.name} avatar`;
    image.addEventListener("error", () => image.remove(), { once: true });
    picture.replaceChildren(image);
  }

  const details = document.createElement("div");
  details.className = "avatar-details";
  const name = document.createElement("h3");
  name.className = "avatar-name";
  name.textContent = avatar.name;
  const kind = document.createElement("p");
  kind.className = "avatar-kind";
  kind.textContent = `${avatar.custom ? "Uploaded avatar" : "Starter avatar · protected"} · ${avatar.vibe}`;
  details.append(name, kind);

  const actions = document.createElement("div");
  actions.className = "avatar-actions";
  const useButton = document.createElement("button");
  useButton.type = "button";
  useButton.className = "use-button";
  useButton.textContent = avatar.selected ? "Using in game" : "Use in game";
  useButton.disabled = avatar.selected;
  useButton.addEventListener("click", async () => {
    useButton.disabled = true;
    try {
      await api.selectAvatar(avatar.id);
      showStatus(`${avatar.name} is now the featured friend.`);
      await loadAvatars();
    } catch (error) {
      showStatus(error.message || "Could not select that avatar.", true);
      useButton.disabled = false;
    }
  });
  actions.append(useButton);

  if (avatar.custom) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async () => {
      if (!window.confirm(`Remove ${avatar.name}? Its generated files will be deleted from this computer.`)) return;
      removeButton.disabled = true;
      try {
        await api.removeAvatar(avatar.id);
        showStatus(`${avatar.name} was removed.`);
        await loadAvatars();
      } catch (error) {
        showStatus(error.message || "Could not remove that avatar.", true);
        removeButton.disabled = false;
      }
    });
    actions.append(removeButton);
  }

  card.append(picture, details, actions);
  return card;
}

async function loadAvatars() {
  list.replaceChildren();
  try {
    const avatars = await api.listAvatars();
    count.textContent = `${avatars.length} total`;
    if (!avatars.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No avatars yet. Add a friend with the form above.";
      list.append(empty);
      return;
    }
    for (const avatar of avatars) list.append(makeAvatarCard(avatar));
  } catch (error) {
    count.textContent = "";
    showStatus(error.message || "Could not load avatars.", true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    showStatus("Enter a name first.", true);
    nameInput.focus();
    return;
  }
  createButton.disabled = true;
  createButton.textContent = "Choose a photo…";
  showStatus("Choose one clear face photo in the file picker.");
  try {
    const result = await api.createAvatar({ name, vibe: document.querySelector("#avatar-vibe").value });
    if (result?.canceled) {
      showStatus("Canceled. Nothing was added.");
    } else {
      showStatus("Avatar created and added to your desktop world.");
      form.reset();
      await loadAvatars();
    }
  } catch (error) {
    showStatus(error.message || "Could not create that avatar.", true);
  } finally {
    createButton.disabled = false;
    createButton.textContent = "Choose photo & create avatar";
  }
});

document.querySelector("#close-manager").addEventListener("click", () => window.close());
api.onAvatarChange?.(() => loadAvatars());
loadAvatars();
