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

/** Which of Khameleon's own tools a request seems to need. Pure - exported for testing. */
export function ownToolsFor(request: string): string[] {
  const r = request.toLowerCase();
  const tools: string[] = [];
  if (/\b(task|tasks|to-?do|remind|reminder|follow[- ]?up|deadline|due)\b/.test(r)) tools.push(...TASK_TOOLS);
  if (/https?:\/\/|\bwww\.|\bwebsite\b|\bweb ?page\b|\burl\b/.test(r)) tools.push(...WEB_TOOLS);
  return tools;
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 60);
}

export async function toolsForAnyAi(request: string): Promise<AnyAiTool[]> {
  const tools: AnyAiTool[] = [];

  for (const name of ownToolsFor(request)) {
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
