/**
 * Where to send the user after they sign in: the Khameleon page they
 * started from (in development the app and this server are on different
 * addresses - landing on the server's own address showed "not found").
 * Only this computer or this server's own address is accepted, so the
 * sign-in can't be used to bounce someone to another site.
 */
export function safeReturnTo(candidate: string | undefined, serverHost: string | undefined): string {
  if (!candidate) return "";
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    const sameServer = !!serverHost && u.host === serverHost;
    return local || sameServer ? u.origin : "";
  } catch {
    return "";
  }
}
