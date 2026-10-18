import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("khameleon", {
  runCommand: (text: string) => ipcRenderer.invoke("khameleon:command", text),
  // Separate from runCommand on purpose - never touches cloud Claude (see
  // main.ts's handler comment, Cross-App Control Phase 3).
  readDocumentLocally: (filePath: string, question: string) =>
    ipcRenderer.invoke("khameleon:read-document-locally", filePath, question),
  extractReceiptLocally: (filePath: string) =>
    ipcRenderer.invoke("khameleon:extract-receipt-locally", filePath),
  // Overlay layout plumbing (docs/build-review.md, Build 2 step a). Read by
  // artifacts/khameleon-command/src/lib/desktopBridge.ts.
  overlay: {
    setInteractive: (interactive: boolean) => ipcRenderer.send("khameleon:overlay:set-interactive", interactive),
    openClassicWindow: () => ipcRenderer.send("khameleon:overlay:open-classic"),
    hide: () => ipcRenderer.send("khameleon:overlay:hide"),
  },
  // Capture (src/capture.ts): record a task to turn into a skill.
  capture: {
    status: () => ipcRenderer.invoke("khameleon:capture:status"),
    start: () => ipcRenderer.invoke("khameleon:capture:start"),
    pause: () => ipcRenderer.invoke("khameleon:capture:pause"),
    resume: () => ipcRenderer.invoke("khameleon:capture:resume"),
    note: (text: string) => ipcRenderer.invoke("khameleon:capture:note", text),
    stop: () => ipcRenderer.invoke("khameleon:capture:stop"),
    discard: () => ipcRenderer.invoke("khameleon:capture:discard"),
    openSnapshotSettings: () => ipcRenderer.invoke("khameleon:capture:open-settings"),
    onUpdate: (listener: (status: unknown) => void) => {
      const handler = (_e: unknown, status: unknown) => listener(status);
      ipcRenderer.on("khameleon:capture:update", handler);
      return () => { ipcRenderer.removeListener("khameleon:capture:update", handler); };
    },
  },
  // Saved desktop choices: which layout starts, follow-me vs main screen.
  prefs: {
    get: () => ipcRenderer.invoke("khameleon:prefs:get"),
    set: (patch: Record<string, unknown>) => ipcRenderer.invoke("khameleon:prefs:set", patch),
  },
});
