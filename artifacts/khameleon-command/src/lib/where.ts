/**
 * Where Khami (and the server) runs, for honest wording (pre-launch review,
 * 2026-10-20): "on this computer" for a personal install, "on your
 * organisation's Khameleon server" when the organisation runs one. Things the
 * desktop app does itself (the detection log, Capture snapshots, typing saved
 * logins) are always on this computer and keep saying so.
 */
function serverIsLocal(): boolean {
  try {
    const api = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL, window.location.href) : new URL(window.location.href);
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(api.hostname);
  } catch {
    return true;
  }
}

export const KHAMI_HOME = serverIsLocal() ? "on this computer" : "on your organisation's Khameleon server";
