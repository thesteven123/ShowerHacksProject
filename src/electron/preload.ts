import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("tinyMenaces", {
  listFriends: () => ipcRenderer.invoke("friends:list"),
  getMode: () => ipcRenderer.invoke("mode:get"),
  setPetRegions: (regions: Array<{ x: number; y: number; width: number; height: number }>) =>
    ipcRenderer.send("pets:regions", regions),
  setPetDragging: (dragging: boolean) => ipcRenderer.send("pets:dragging", dragging),
  onModeChange: (callback: (enabled: boolean) => void) => {
    ipcRenderer.on("mode:changed", (_event: IpcRendererEvent, enabled: boolean) => {
      callback(enabled);
    });
  },
});
