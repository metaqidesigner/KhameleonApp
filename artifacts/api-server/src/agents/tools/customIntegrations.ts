/**
 * Bridges the real, DB-stored custom Integrations (lib/openApiImport.ts's
 * parsed OpenAPI operations, and MCP server configs) into the real
 * agentic tool-calling loop (gateway.ts). Kept separate from
 * openApiImport.ts so that file can stay pure/DB-free and directly
 * testable - this file is the DB+decryption glue around it.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { BetaRequestMCPServerURLDefinition } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { db } from "@workspace/db";
import { customIntegrationsTable, type CustomIntegration } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { decrypt } from "../../lib/crypto.js";
import { getCurrentUserId } from "../../lib/requestContext.js";
import { operationToToolDefinition, executeOperation, parseCustomToolName, type ParsedOperation } from "../../lib/openApiImport.js";
import { logger } from "../../lib/logger.js";

function ownedScope(column: typeof customIntegrationsTable.userId) {
  const userId = getCurrentUserId();
  return userId === undefined ? isNull(column) : eq(column, userId);
}

async function enabledIntegrationsOfType(sourceType: "openapi" | "mcp"): Promise<CustomIntegration[]> {
  return db
    .select()
    .from(customIntegrationsTable)
    .where(and(eq(customIntegrationsTable.sourceType, sourceType), eq(customIntegrationsTable.enabled, true), ownedScope(customIntegrationsTable.userId)));
}

/** Real tool definitions for every connected OpenAPI integration's operations - merged into TOOL_DEFINITIONS in gateway.ts. */
export async function getCustomToolDefinitions(): Promise<Anthropic.Messages.Tool[]> {
  const rows = await enabledIntegrationsOfType("openapi");
  const defs: Anthropic.Messages.Tool[] = [];
  for (const row of rows) {
    if (!row.operations) continue;
    let ops: ParsedOperation[];
    try {
      ops = JSON.parse(row.operations) as ParsedOperation[];
    } catch {
      logger.warn({ integrationId: row.id }, "Custom integration has unparseable cached operations, skipping");
      continue;
    }
    for (const op of ops) defs.push(operationToToolDefinition(row.id, op));
  }
  return defs;
}

/** True if `name` is one of ours (ext_<id>_...) - lets gateway.ts route dispatch without a DB round-trip for every other tool call. */
export function isCustomToolName(name: string): boolean {
  return parseCustomToolName(name) !== null;
}

export async function dispatchCustomTool(name: string, input: Record<string, unknown>): Promise<string> {
  const parsed = parseCustomToolName(name);
  if (!parsed) throw new Error(`Unknown tool: '${name}'.`);

  const [row] = await db
    .select()
    .from(customIntegrationsTable)
    .where(and(eq(customIntegrationsTable.id, parsed.integrationId), ownedScope(customIntegrationsTable.userId)))
    .limit(1);
  if (!row || row.sourceType !== "openapi" || !row.enabled) {
    throw new Error("This Integration is no longer connected.");
  }
  if (!row.operations || !row.baseUrl) throw new Error("This Integration has no usable operations.");

  const ops = JSON.parse(row.operations) as ParsedOperation[];
  const op = ops.find((o) => o.toolName === parsed.toolName);
  if (!op) throw new Error(`Operation '${parsed.toolName}' no longer exists on this Integration.`);

  const authToken = row.encryptedAuthToken ? decrypt(row.encryptedAuthToken) : undefined;
  return executeOperation(row.baseUrl, op, input, authToken);
}

/** Real MCP server configs for every connected MCP integration - passed as `mcp_servers` to Claude's beta Messages API, which handles the entire MCP protocol (discovery + tool calls) server-side. */
export async function getMcpServerConfigs(): Promise<BetaRequestMCPServerURLDefinition[]> {
  const rows = await enabledIntegrationsOfType("mcp");
  return rows
    .filter((r) => !!r.sourceUrl)
    .map((r) => ({
      type: "url" as const,
      name: r.name,
      url: r.sourceUrl as string,
      authorization_token: r.encryptedAuthToken ? decrypt(r.encryptedAuthToken) : undefined,
    }));
}
