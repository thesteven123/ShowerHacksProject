import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("tinyMenaces", {
  listFriends: () => ipcRenderer.invoke("friends:list"),
  getMode: () => ipcRenderer.invoke("mode:get"),
  getReaction: (characterId: string, event: string) =>
    ipcRenderer.invoke("reactions:get", characterId, event),
  onModeChange: (callback: (enabled: boolean) => void) => {
    ipcRenderer.on("mode:changed", (_event: IpcRendererEvent, enabled: boolean) => {
      callback(enabled);
    });
  },
});
