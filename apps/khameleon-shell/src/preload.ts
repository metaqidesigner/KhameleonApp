import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("khameleon", {
  runCommand: (text: string) => ipcRenderer.invoke("khameleon:command", text),
  // Separate from runCommand on purpose - never touches cloud Claude (see
  // main.ts's handler comment, Cross-App Control Phase 3).
  readDocumentLocally: (filePath: string, question: string) =>
    ipcRenderer.invoke("khameleon:read-document-locally", filePath, question),
  extractReceiptLocally: (filePath: string) =>
    ipcRenderer.invoke("khameleon:extract-receipt-locally", filePath),
});
