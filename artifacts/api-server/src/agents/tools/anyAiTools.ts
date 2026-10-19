/**
 * Tools for any AI (docs/khami-design.md): the tools Khameleon itself runs
 * on behalf of Khami, GPT or Gemini - so Integrations aren't Claude-only.
 *
 * - Integrations: imported OpenAPI operations (ext_*) and MCP servers
 *   (mcp_<id>_<tool>, via Khameleon's own MCP client).
 * - A small, safe set of Khameleon's own tools (tasks, web fetch) - offered
 *   only when the request looks like it needs them, so ordinary questions
 *   stay quick on a small offline brain. Shell/file tools are never offered.
 */
import { desktopOnline } from "../../lib/desktopLink.js";
import { currentSkill } from "../../lib/skillContext.js";
import { TOOL_DEFINITIONS } from "./definitions.js";
import { dispatchTool } from "./dispatcher.js";
import { getCustomToolDefinitions, isCustomToolName, dispatchCustomTool, getMcpIntegrations } from "./customIntegrations.js";
import { listMcpTools, callMcpTool } from "../../lib/mcpClient.js";
import { logger } from "../../lib/logger.js";

export interface AnyAiTool {
  name: string;
  description: string;
  /** JSON Schema of the input. */
  parameters: Record<string, unknown>;
  run: (input: Record<string, unknown>) => Promise<string>;
}

const TASK_TOOLS = ["create_task", "list_tasks", "update_task"];
const WEB_TOOLS = ["fetch_url"];
const CALENDAR_TOOLS = ["get_calendar"];
const PREP_TOOLS = ["prepare_meeting_brief"];
const INBOX_TOOLS = ["check_inbox"];
const DESKTOP_TOOLS = ["desktop_apps", "desktop_files"];
const LOGIN_TOOLS = ["sign_in_with_saved_login"];

/** Which of Khameleon's own tools a request seems to need. Pure - exported for testing. */
export function ownToolsFor(request: string): string[] {
  const r = request.toLowerCase();
  const tools: string[] = [];
  if (/\b(task|tasks|to-?do|remind|reminder|follow[- ]?up|deadline|due)\b/.test(r)) tools.push(...TASK_TOOLS);
  if (/https?:\/\/|\bwww\.|\bwebsite\b|\bweb ?page\b|\burl\b/.test(r)) tools.push(...WEB_TOOLS);
  if (/\b(calendar|diary|meetings?|schedule|agenda|appointments?|free|busy|available|this (morning|afternoon|evening)|tomorrow|next week|this week|what'?s on)\b/.test(r)) tools.push(...CALENDAR_TOOLS);
  if (/\b(sign|log)\s?-?(in|on)\b|\blogin\b|\bportal\b/.test(r)) tools.push(...LOGIN_TOOLS, ...DESKTOP_TOOLS);
  if (/\b(open|launch|quit|close|observe|control|type|click|window|app|excel|word|outlook|teams|slack|safari|chrome|youtube|folder|files?|downloads|desktop|move .+ to|trash|sort my)\b/.test(r)) tools.push(...DESKTOP_TOOLS);
  if (/\b(inbox|e-?mails?|mail|urgent|unread|reply to anything|anyone (waiting|chasing))\b/.test(r) && !/\b(draft|write|send|polish)\b/.test(r)) tools.push(...INBOX_TOOLS);
  if (/\b(prep|prepare|brief|briefing)\b/.test(r) && /\b(meeting|call|catch[- ]?up|\d{1,2}(:\d{2})?\s*(am|pm)|\d{1,2}[:.]\d{2}|with)\b/.test(r)) tools.push(...PREP_TOOLS);
  return tools;
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 60);
}

export async function toolsForAnyAi(request: string): Promise<AnyAiTool[]> {
  const tools: AnyAiTool[] = [];

  // A skill with a saved login always gets the sign-in tool (Build 7).
  const wanted = new Set(ownToolsFor(request));
  if (currentSkill()?.loginVaultItemId) for (const n of [...LOGIN_TOOLS, ...DESKTOP_TOOLS]) wanted.add(n);
  for (const name of wanted) {
    // Desktop tools only while the desktop app is connected (lib/desktopLink.ts).
    if ((DESKTOP_TOOLS.includes(name) || LOGIN_TOOLS.includes(name)) && !desktopOnline()) continue;
    const def = TOOL_DEFINITIONS.find(d => d.name === name);
    if (def) tools.push({ name, description: def.description ?? name, parameters: def.input_schema as Record<string, unknown>, run: input => dispatchTool(name, input) });
  }

  const custom = await getCustomToolDefinitions().catch(() => []);
  for (const def of custom) {
    if (!isCustomToolName(def.name)) continue;
    tools.push({ name: def.name, description: def.description ?? def.name, parameters: def.input_schema as Record<string, unknown>, run: input => dispatchCustomTool(def.name, input) });
  }

  const servers = await getMcpIntegrations().catch(() => []);
  await Promise.all(servers.map(async server => {
    try {
      for (const t of await listMcpTools(server)) {
        tools.push({
          name: safeName(`mcp_${server.id}_${t.name}`),
          description: `${server.name}: ${t.description ?? t.name}`.slice(0, 500),
          parameters: t.inputSchema,
          run: input => callMcpTool(server, t.name, input),
        });
      }
    } catch (err) {
      // One unreachable integration (e.g. offline) must not stop the others.
      logger.warn({ err, integration: server.name }, "MCP integration unavailable");
    }
  }));

  return tools;
}
