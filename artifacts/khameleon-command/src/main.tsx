import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Installability-only service worker for the Mobile Morning Briefing PWA
// (public/sw.js) - a no-op for the rest of the app, registered globally
// since the install prompt criteria apply to the whole origin either way.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
