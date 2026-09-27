import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("tinyMenaces", {
  listFriends: () => ipcRenderer.invoke("friends:list"),
  getMode: () => ipcRenderer.invoke("mode:get"),
  getReaction: (characterId: string, event: string) =>
    ipcRenderer.invoke("reactions:get", characterId, event),
  openAvatarManager: () => ipcRenderer.send("avatars:open"),
  listAvatars: () => ipcRenderer.invoke("avatars:list"),
  createAvatar: (input: { name: string; vibe: string }) => ipcRenderer.invoke("avatars:create", input),
  removeAvatar: (id: string) => ipcRenderer.invoke("avatars:remove", id),
  selectAvatar: (id: string) => ipcRenderer.invoke("avatars:select", id),
  setPetRegions: (regions: Array<{ x: number; y: number; width: number; height: number }>) =>
    ipcRenderer.send("pets:regions", regions),
  setPetDragging: (dragging: boolean) => ipcRenderer.send("pets:dragging", dragging),
  onModeChange: (callback: (enabled: boolean) => void) => {
    ipcRenderer.on("mode:changed", (_event: IpcRendererEvent, enabled: boolean) => {
      callback(enabled);
    });
  },
  onFriendsChange: (callback: () => void) => {
    ipcRenderer.on("friends:changed", () => callback());
  },
  onAvatarChange: (callback: () => void) => {
    ipcRenderer.on("avatars:changed", () => callback());
  },
});
