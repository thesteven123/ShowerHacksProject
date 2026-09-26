import { app, BrowserWindow, globalShortcut, ipcMain, screen } from "electron";
import path from "node:path";
import { mockFriends } from "../shared/mockFriends";

const MODE_HOTKEY = "CommandOrControl+Shift+M";
const QUIT_HOTKEY = "CommandOrControl+Shift+Q";

let mainWindow: BrowserWindow | null = null;
let gameMode = false;

function setGameMode(enabled: boolean): void {
  gameMode = enabled;
  if (!mainWindow) return;
  mainWindow.setIgnoreMouseEvents(!enabled, { forward: true });
  mainWindow.webContents.send("mode:changed", enabled);
}

function createWindow(): void {
  const { workArea } = screen.getPrimaryDisplay();
  const window = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = window;
  window.setAlwaysOnTop(true, "screen-saver");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setIgnoreMouseEvents(!gameMode, { forward: true });
  window.loadFile(path.join(__dirname, "../ui/index.html"));
  window.once("ready-to-show", () => window.showInactive());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
}

app.whenReady().then(() => {
  ipcMain.handle("friends:list", () => mockFriends);
  ipcMain.handle("mode:get", () => gameMode);
  createWindow();

  if (!globalShortcut.register(MODE_HOTKEY, () => setGameMode(!gameMode))) {
    console.warn(`Could not register game-mode hotkey: ${MODE_HOTKEY}`);
  }
  if (!globalShortcut.register(QUIT_HOTKEY, () => app.quit())) {
    console.warn(`Could not register quit hotkey: ${QUIT_HOTKEY}`);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
