import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen } from "electron";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { AvatarStore, MAX_AVATAR_PHOTO_BYTES } from "./avatarStore";
import { getReactionById } from "../reactions";
import { loadRoster } from "../shared/roster";
import type { FriendCharacter, GameEventType, Vibe } from "../shared/types";

const starterFriends = loadRoster();
const REACTION_EVENTS = new Set<GameEventType>(["idle", "hit", "respawn"]);
const MODE_HOTKEY = "CommandOrControl+Shift+M";
const AVATAR_MANAGER_HOTKEY = "CommandOrControl+Shift+A";
const QUIT_HOTKEY = "CommandOrControl+Shift+Q";
const VIBES = new Set<Vibe>(["chaotic", "dramatic", "supportive"]);
const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

let friends: FriendCharacter[] = starterFriends;
let avatarStore: AvatarStore | null = null;
let mainWindow: BrowserWindow | null = null;
let avatarManagerWindow: BrowserWindow | null = null;
let gameMode = false;
let petDragging = false;
let petRegions: Array<{ x: number; y: number; width: number; height: number }> = [];
let pointerTimer: NodeJS.Timeout | null = null;
let ignoringMouse: boolean | null = null;

async function refreshFriends(): Promise<void> {
  const custom = avatarStore ? await avatarStore.list() : [];
  const all = [...starterFriends, ...custom];
  const selectedId = avatarStore ? await avatarStore.getSelectedId() : null;
  const selectedIndex = all.findIndex((friend) => friend.id === selectedId);
  friends = selectedIndex < 0 ? all : [all[selectedIndex]!, ...all.filter((_, index) => index !== selectedIndex)];
}

function notifyFriendsChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("friends:changed");
}

async function managerRows() {
  const customIds = new Set((avatarStore ? await avatarStore.list() : []).map((friend) => friend.id));
  const selectedId = friends[0]?.id;
  return friends.map(({ id, name, imageUrl, vibe }) => ({
    id,
    name,
    imageUrl,
    vibe,
    custom: customIds.has(id),
    selected: id === selectedId,
  }));
}

if (process.platform === "win32") {
  app.commandLine.appendSwitch("enable-transparent-visuals");
}

function updateMousePassthrough(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const origin = mainWindow.getBounds();
  const cursor = screen.getCursorScreenPoint();
  const x = cursor.x - origin.x;
  const y = cursor.y - origin.y;
  const overPet = petRegions.some(
    (region) =>
      x >= region.x &&
      x <= region.x + region.width &&
      y >= region.y &&
      y <= region.y + region.height,
  );
  const shouldIgnore = !(gameMode || petDragging || overPet);
  if (shouldIgnore !== ignoringMouse) {
    mainWindow.setIgnoreMouseEvents(shouldIgnore, { forward: true });
    ignoringMouse = shouldIgnore;
  }
}

function setGameMode(enabled: boolean): void {
  gameMode = enabled;
  if (!mainWindow) return;
  updateMousePassthrough();
  mainWindow.webContents.send("mode:changed", enabled);
}

function targetWorkArea(): Electron.Rectangle {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}

function createWindow(): void {
  const workArea = targetWorkArea();
  const uiPath = path.join(__dirname, "../ui/index.html");
  if (!existsSync(uiPath)) {
    console.error(`UI not found at ${uiPath}. Run npm start so the UI is copied into dist/.`);
  }

  const window = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    hasShadow: false,
    thickFrame: false,
    resizable: false,
    movable: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = window;
  petRegions = [];
  petDragging = false;
  ignoringMouse = null;
  window.setAlwaysOnTop(true, "screen-saver");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  updateMousePassthrough();
  pointerTimer = setInterval(updateMousePassthrough, 33);
  window.loadFile(uiPath);
  window.webContents.on("did-start-loading", () => {
    petRegions = [];
    petDragging = false;
    updateMousePassthrough();
  });

  const reveal = (): void => {
    if (window.isDestroyed()) return;
    window.show();
    window.moveTop();
    ignoringMouse = null;
    updateMousePassthrough();
  };
  window.once("ready-to-show", reveal);
  window.webContents.once("did-finish-load", reveal);
  setTimeout(reveal, 800);

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
      if (pointerTimer) clearInterval(pointerTimer);
      pointerTimer = null;
      petRegions = [];
      petDragging = false;
      ignoringMouse = null;
    }
  });
}

function openAvatarManager(): void {
  if (avatarManagerWindow && !avatarManagerWindow.isDestroyed()) {
    avatarManagerWindow.show();
    avatarManagerWindow.focus();
    return;
  }
  const uiPath = path.join(__dirname, "../ui/avatar-manager.html");
  if (!existsSync(uiPath)) {
    console.error(`Avatar manager UI not found at ${uiPath}.`);
    return;
  }
  const restoreOverlay = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());
  mainWindow?.hide();
  const manager = new BrowserWindow({
    width: 760,
    height: 720,
    minWidth: 560,
    minHeight: 520,
    title: "Tiny Menaces · Manage avatars",
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#101a18",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  avatarManagerWindow = manager;
  manager.loadFile(uiPath);
  manager.once("ready-to-show", () => manager.show());
  manager.on("closed", () => {
    if (avatarManagerWindow === manager) avatarManagerWindow = null;
    if (restoreOverlay && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.moveTop();
      ignoringMouse = null;
      updateMousePassthrough();
    }
  });
}

app.whenReady().then(async () => {
  avatarStore = new AvatarStore(app.getPath("userData"));
  try {
    await refreshFriends();
  } catch (error) {
    console.error("Could not load custom avatars; using the starter roster.", error);
    friends = starterFriends;
  }
  ipcMain.handle("friends:list", () => friends);
  ipcMain.handle("mode:get", () => gameMode);
  ipcMain.handle("reactions:get", (_event, characterId: string, event: string) => {
    if (!REACTION_EVENTS.has(event as GameEventType)) return null;
    return getReactionById(friends, characterId, event as GameEventType);
  });
  ipcMain.on("pets:regions", (event, input: unknown) => {
    if (event.sender !== mainWindow?.webContents || !Array.isArray(input) || input.length > 20) return;
    const regions = input as Array<{ x: number; y: number; width: number; height: number }>;
    if (
      !regions.every(
        (region) =>
          region &&
          [region.x, region.y, region.width, region.height].every(Number.isFinite) &&
          region.width > 0 &&
          region.width <= 200 &&
          region.height > 0 &&
          region.height <= 240,
      )
    ) {
      return;
    }
    petRegions = regions;
    updateMousePassthrough();
  });
  ipcMain.on("pets:dragging", (event, dragging: unknown) => {
    if (event.sender !== mainWindow?.webContents || typeof dragging !== "boolean") return;
    petDragging = dragging;
    updateMousePassthrough();
  });
  ipcMain.on("avatars:open", (event) => {
    if (event.sender === mainWindow?.webContents) openAvatarManager();
  });
  ipcMain.handle("avatars:list", (event) => {
    if (event.sender !== avatarManagerWindow?.webContents) throw new Error("Avatar manager is not authorized.");
    return managerRows();
  });
  ipcMain.handle("avatars:create", async (event, input: unknown) => {
    if (event.sender !== avatarManagerWindow?.webContents || !avatarStore) {
      throw new Error("Avatar manager is not authorized.");
    }
    if (!input || typeof input !== "object") throw new Error("Enter a name and personality first.");
    const values = input as { name?: unknown; vibe?: unknown };
    const name = typeof values.name === "string" ? values.name.trim() : "";
    const vibe = values.vibe;
    if (!name || name.length > 32) {
      throw new Error("Name must be 1–32 characters.");
    }
    if (typeof vibe !== "string" || !VIBES.has(vibe as Vibe)) {
      throw new Error("Choose a personality.");
    }
    const manager = avatarManagerWindow;
    if (!manager || manager.isDestroyed()) throw new Error("Avatar manager closed.");
    const selection = await dialog.showOpenDialog(manager, {
      title: "Choose a friend photo",
      buttonLabel: "Create avatar",
      properties: ["openFile"],
      filters: [{ name: "Photos", extensions: ["jpg", "jpeg", "png", "webp", "avif"] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true };
    const photoPath = selection.filePaths[0];
    if (!PHOTO_EXTENSIONS.has(path.extname(photoPath).toLowerCase())) {
      throw new Error("Choose a JPG, PNG, WebP, or AVIF image.");
    }
    const photoStat = await stat(photoPath);
    if (!photoStat.isFile() || photoStat.size > MAX_AVATAR_PHOTO_BYTES) {
      throw new Error("Choose a photo smaller than 25 MB.");
    }
    const avatar = await avatarStore.createFromPhoto(await readFile(photoPath), { name, vibe: vibe as Vibe });
    await refreshFriends();
    notifyFriendsChanged();
    manager.webContents.send("avatars:changed");
    return { canceled: false, avatarId: avatar.id };
  });
  ipcMain.handle("avatars:remove", async (event, id: unknown) => {
    if (event.sender !== avatarManagerWindow?.webContents || !avatarStore || typeof id !== "string") {
      throw new Error("Avatar manager is not authorized.");
    }
    const removed = await avatarStore.remove(id);
    if (!removed) throw new Error("Only custom avatars can be removed.");
    await refreshFriends();
    notifyFriendsChanged();
    avatarManagerWindow?.webContents.send("avatars:changed");
    return managerRows();
  });
  ipcMain.handle("avatars:select", async (event, id: unknown) => {
    if (event.sender !== avatarManagerWindow?.webContents || !avatarStore || typeof id !== "string") {
      throw new Error("Avatar manager is not authorized.");
    }
    if (![...starterFriends, ...(await avatarStore.list())].some((friend) => friend.id === id)) {
      throw new Error("Avatar not found.");
    }
    await avatarStore.setSelectedId(id);
    await refreshFriends();
    notifyFriendsChanged();
    avatarManagerWindow?.webContents.send("avatars:changed");
    return managerRows();
  });

  const openOverlay = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  };
  if (process.platform === "win32") setTimeout(openOverlay, 300);
  else openOverlay();

  if (!globalShortcut.register(MODE_HOTKEY, () => setGameMode(!gameMode))) {
    console.warn(`Could not register game-mode hotkey: ${MODE_HOTKEY}`);
  }
  if (!globalShortcut.register(AVATAR_MANAGER_HOTKEY, openAvatarManager)) {
    console.warn(`Could not register avatar-manager hotkey: ${AVATAR_MANAGER_HOTKEY}`);
  }
  if (!globalShortcut.register(QUIT_HOTKEY, () => app.quit())) {
    console.warn(`Could not register quit hotkey: ${QUIT_HOTKEY}`);
  }

  app.on("activate", openOverlay);
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
