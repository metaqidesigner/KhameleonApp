/**
 * Microsoft 365 Copilot as a chat engine (docs/khami-design.md: the main AI
 * whenever the organisation provides it). Uses Microsoft's Copilot Chat API
 * - still a preview ("/beta", Microsoft: not supported for production) -
 * which needs a work account with a Microsoft 365 Copilot licence and
 * admin-approved read permissions (COPILOT_SCOPES).
 *
 * The API takes one message per call and keeps its own conversations, with
 * no system prompt or tools. So each Khameleon turn starts a fresh Copilot
 * conversation and passes Khameleon's instructions (incl. any picked skill)
 * and the earlier turns as "additional context". Pure helpers are exported
 * for testing; askCopilot does the network calls.
 */
import { getFreshToken } from "./oauthTokens.js";

export const COPILOT_TENANT = "organizations"; // work or school accounts only
export const COPILOT_SCOPES = [
  "https://graph.microsoft.com/Sites.Read.All",
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/People.Read.All",
  "https://graph.microsoft.com/OnlineMeetingTranscript.Read.All",
  "https://graph.microsoft.com/Chat.Read",
  "https://graph.microsoft.com/ChannelMessage.Read.All",
  "https://graph.microsoft.com/ExternalItem.Read.All",
  "https://graph.microsoft.com/User.Read",
  "offline_access",
].join(" ");

const GRAPH = "https://graph.microsoft.com/beta/copilot/conversations";
const MAX_HISTORY_CHARS = 8000;

export interface CopilotTurn { role: "user" | "assistant"; content: string }

export function buildCopilotChatBody(system: string, messages: CopilotTurn[], timeZone: string) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  const earlier = messages.slice(0, lastUser ? messages.lastIndexOf(lastUser) : messages.length);
  const additionalContext: { text: string }[] = [];
  if (system.trim()) additionalContext.push({ text: `Instructions for this answer:\n${system.trim()}` });
  if (earlier.length) {
    const history = earlier.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
    additionalContext.push({ text: `Earlier in this conversation:\n${history.slice(-MAX_HISTORY_CHARS)}` });
  }
  return {
    message: { text: lastUser?.content ?? "" },
    ...(additionalContext.length ? { additionalContext } : {}),
    locationHint: { timeZone },
  };
}

/** Copilot marks up names and citations (<Person>…</Person>, [^1^]); show plain text. */
export function cleanCopilotText(text: string): string {
  return text
    .replace(/<\/?(Person|Event|File|Email|Chat|Meeting|Site|Message)>/g, "")
    .replace(/\[\^\d+\^\]/g, "")
    .trim();
}

/** The reply is the newest message after the user's own echoed message. */
export function extractCopilotReply(conversation: { messages?: { text?: string }[] }): string {
  const msgs = conversation.messages ?? [];
  const reply = msgs.length > 1 ? msgs[msgs.length - 1] : undefined;
  return cleanCopilotText(reply?.text ?? "");
}

export interface CopilotOptions {
  /** For tests: a stand-in that behaves like Microsoft's API (lib/copilotChat.test.ts). */
  baseUrl?: string;
  getToken?: () => Promise<string>;
}

export async function askCopilot(system: string, messages: CopilotTurn[], opts: CopilotOptions = {}): Promise<{ content: string; latencyMs: number }> {
  const t0 = Date.now();
  const GRAPH_URL = opts.baseUrl ?? GRAPH;
  let token: string;
  try {
    token = await (opts.getToken ?? (() => getFreshToken("copilot")))();
  } catch {
    throw new Error("Microsoft 365 Copilot isn't connected. Connect it from Integrations with a work account that has a Copilot licence.");
  }
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const created = await fetch(GRAPH_URL, { method: "POST", headers, body: "{}" });
  if (created.status === 403) throw new Error("Microsoft says this account can't use Copilot here - it needs a Microsoft 365 Copilot licence and your IT admin's approval.");
  if (!created.ok) throw new Error(`Copilot couldn't start a conversation (HTTP ${created.status}).`);
  const { id } = await created.json() as { id: string };

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const res = await fetch(`${GRAPH_URL}/${encodeURIComponent(id)}/chat`, {
    method: "POST", headers, body: JSON.stringify(buildCopilotChatBody(system, messages, timeZone)),
  });
  if (!res.ok) throw new Error(`Copilot didn't answer (HTTP ${res.status}).`);
  const conversation = await res.json() as { messages?: { text?: string }[] };
  return { content: extractCopilotReply(conversation), latencyMs: Date.now() - t0 };
}
