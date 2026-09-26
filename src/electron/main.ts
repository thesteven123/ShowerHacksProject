import { app, BrowserWindow, globalShortcut, ipcMain, screen } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { mockFriends } from "../shared/mockFriends";

const MODE_HOTKEY = "CommandOrControl+Shift+M";
const QUIT_HOTKEY = "CommandOrControl+Shift+Q";

let mainWindow: BrowserWindow | null = null;
let gameMode = false;
let petDragging = false;
let petRegions: Array<{ x: number; y: number; width: number; height: number }> = [];
let pointerTimer: NodeJS.Timeout | null = null;
let ignoringMouse: boolean | null = null;

if (process.platform === "win32") {
  app.commandLine.appendSwitch("enable-transparent-visuals");
}

function updateMousePassthrough(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const origin = mainWindow.getBounds();
  const cursor = screen.getCursorScreenPoint();
  const x = cursor.x - origin.x;
  const y = cursor.y - origin.y;
  const overPet = petRegions.some(region =>
    x >= region.x && x <= region.x + region.width &&
    y >= region.y && y <= region.y + region.height,
  );
  // In quiet mode, only visible pets accept input; the rest of the desktop stays usable.
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

app.whenReady().then(() => {
  ipcMain.handle("friends:list", () => mockFriends);
  ipcMain.handle("mode:get", () => gameMode);
  ipcMain.on("pets:regions", (event, input: unknown) => {
    if (event.sender !== mainWindow?.webContents || !Array.isArray(input) || input.length > 20) return;
    const regions = input as Array<{ x: number; y: number; width: number; height: number }>;
    if (!regions.every(region => region && [region.x, region.y, region.width, region.height].every(Number.isFinite) && region.width > 0 && region.width <= 200 && region.height > 0 && region.height <= 240)) return;
    petRegions = regions;
    updateMousePassthrough();
  });
  ipcMain.on("pets:dragging", (event, dragging: unknown) => {
    if (event.sender !== mainWindow?.webContents || typeof dragging !== "boolean") return;
    petDragging = dragging;
    updateMousePassthrough();
  });
  const openOverlay = (): void => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  };
  if (process.platform === "win32") setTimeout(openOverlay, 300);
  else openOverlay();

  if (!globalShortcut.register(MODE_HOTKEY, () => setGameMode(!gameMode))) {
    console.warn(`Could not register game-mode hotkey: ${MODE_HOTKEY}`);
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
