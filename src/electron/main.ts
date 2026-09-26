import { app, BrowserWindow, globalShortcut, ipcMain, screen } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { mockFriends } from "../shared/mockFriends";

const MODE_HOTKEY = "CommandOrControl+Shift+M";
const QUIT_HOTKEY = "CommandOrControl+Shift+Q";

let mainWindow: BrowserWindow | null = null;
let gameMode = false;

if (process.platform === "win32") {
  app.commandLine.appendSwitch("enable-transparent-visuals");
}

function setGameMode(enabled: boolean): void {
  gameMode = enabled;
  if (!mainWindow) return;
  mainWindow.setIgnoreMouseEvents(!enabled, { forward: true });
  mainWindow.webContents.send("mode:changed", enabled);
}

function targetWorkArea(): Electron.Rectangle {
  const point = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(point).workArea;
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
  window.setAlwaysOnTop(true, "screen-saver");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.loadFile(uiPath);

  const reveal = (): void => {
    if (window.isDestroyed()) return;
    window.show();
    window.moveTop();
    window.setIgnoreMouseEvents(!gameMode, { forward: true });
  };
  window.once("ready-to-show", reveal);
  window.webContents.once("did-finish-load", reveal);
  setTimeout(reveal, 800);

  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
}

app.whenReady().then(() => {
  ipcMain.handle("friends:list", () => mockFriends);
  ipcMain.handle("mode:get", () => gameMode);

  const openOverlay = (): void => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  };
  if (process.platform === "win32") {
    setTimeout(openOverlay, 300);
  } else {
    openOverlay();
  }

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
