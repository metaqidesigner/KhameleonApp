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
    openInputSettings: () => ipcRenderer.invoke("khameleon:capture:open-input-settings"),
    onUpdate: (listener: (status: unknown) => void) => {
      const handler = (_e: unknown, status: unknown) => listener(status);
      ipcRenderer.on("khameleon:capture:update", handler);
      return () => { ipcRenderer.removeListener("khameleon:capture:update", handler); };
    },
  },
  // Email assistant (src/emailWatch.ts): the open email window, its glow, and reading it.
  email: {
    get: () => ipcRenderer.invoke("khameleon:email:get"),
    setGlow: (state: string | null) => ipcRenderer.invoke("khameleon:email:glow", state),
    readOpenEmail: () => ipcRenderer.invoke("khameleon:email:read"),
    copyText: (text: string) => ipcRenderer.invoke("khameleon:clipboard:write", text),
    onUpdate: (listener: (email: unknown) => void) => {
      const handler = (_e: unknown, email: unknown) => listener(email);
      ipcRenderer.on("khameleon:email:update", handler);
      return () => { ipcRenderer.removeListener("khameleon:email:update", handler); };
    },
  },
  // Desktop link (src/desktopLink.ts): the pairing code the signed-in window registers with the server.
  desktopLink: {
    code: () => ipcRenderer.invoke("khameleon:desktop:code"),
  },
  // Automatic task detection (src/detection.ts): status, Pause, "Not this one", Delete my history.
  detection: {
    status: () => ipcRenderer.invoke("khameleon:detection:status"),
    pause: (paused: boolean) => ipcRenderer.invoke("khameleon:detection:pause", paused),
    silence: (id: string) => ipcRenderer.invoke("khameleon:detection:silence", id),
    deleteHistory: () => ipcRenderer.invoke("khameleon:detection:delete-history"),
    onUpdate: (listener: (status: unknown) => void) => {
      const handler = (_e: unknown, status: unknown) => listener(status);
      ipcRenderer.on("khameleon:detection:update", handler);
      return () => { ipcRenderer.removeListener("khameleon:detection:update", handler); };
    },
  },
  // Mac permissions (first-run setup).
  permissions: {
    status: () => ipcRenderer.invoke("khameleon:permissions:status"),
    allowAccessibility: () => ipcRenderer.invoke("khameleon:permissions:allow-accessibility"),
    openAccessibility: () => ipcRenderer.invoke("khameleon:permissions:open-accessibility"),
  },
  // The all-in-one app's own data (src/localServer.ts): the recovery key and removing everything.
  data: {
    builtIn: () => ipcRenderer.invoke("khameleon:data:built-in"),
    folder: () => ipcRenderer.invoke("khameleon:data:folder"),
    recoveryKey: () => ipcRenderer.invoke("khameleon:data:recovery-key"),
    saveRecoveryKey: () => ipcRenderer.invoke("khameleon:data:save-recovery-key"),
    useRecoveryKey: (text: string) => ipcRenderer.invoke("khameleon:data:use-recovery-key", text),
    removeAll: () => ipcRenderer.invoke("khameleon:data:remove-all"),
  },
  // Saved desktop choices: which layout starts, follow-me vs main screen.
  prefs: {
    get: () => ipcRenderer.invoke("khameleon:prefs:get"),
    set: (patch: Record<string, unknown>) => ipcRenderer.invoke("khameleon:prefs:set", patch),
  },
});
