import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("khameleon", {
  runCommand: (text: string) => ipcRenderer.invoke("khameleon:command", text),
});
