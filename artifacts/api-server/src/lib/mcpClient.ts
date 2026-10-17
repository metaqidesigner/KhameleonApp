/**
 * Khameleon talking to MCP integrations itself (docs/khami-design.md):
 * Claude's connectors become Khameleon Integrations that work with any AI -
 * Khami offline, GPT, Gemini - not only through Claude's built-in support.
 * Uses the official MCP SDK (MIT). Connections are reused for a few minutes.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export interface McpServer {
  url: string;
  token?: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

const IDLE_MS = 5 * 60 * 1000;
const clients = new Map<string, { client: Promise<Client>; timer: NodeJS.Timeout }>();

async function connect(server: McpServer): Promise<Client> {
  const headers = server.token ? { Authorization: `Bearer ${server.token}` } : undefined;
  const url = new URL(server.url);
  const client = new Client({ name: "khameleon", version: "1.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
    return client;
  } catch {
    // Older servers only speak the SSE transport.
    const fallback = new Client({ name: "khameleon", version: "1.0.0" });
    await fallback.connect(new SSEClientTransport(url, { requestInit: { headers } }));
    return fallback;
  }
}

function clientFor(server: McpServer): Promise<Client> {
  const key = `${server.url}|${server.token ?? ""}`;
  const existing = clients.get(key);
  if (existing) {
    existing.timer.refresh();
    return existing.client;
  }
  const client = connect(server);
  const timer = setTimeout(() => {
    clients.delete(key);
    client.then(c => c.close()).catch(() => undefined);
  }, IDLE_MS);
  timer.unref();
  clients.set(key, { client, timer });
  client.catch(() => clients.delete(key));
  return client;
}

export async function listMcpTools(server: McpServer): Promise<McpTool[]> {
  const res = await (await clientFor(server)).listTools();
  return res.tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema as Record<string, unknown> }));
}

/** Calls a tool and flattens its result to text for the AI. */
export async function callMcpTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<string> {
  const res = await (await clientFor(server)).callTool({ name, arguments: args });
  const parts = Array.isArray(res.content) ? res.content : [];
  const text = parts
    .map((p: { type?: string; text?: string }) => (p.type === "text" ? p.text ?? "" : `[${p.type ?? "content"}]`))
    .join("\n")
    .trim();
  if (res.isError) throw new Error(text || "The integration reported an error.");
  return text || "(no content)";
}
