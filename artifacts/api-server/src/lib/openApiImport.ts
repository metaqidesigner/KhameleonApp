/**
 * Turns a real OpenAPI 3.x spec into real callable Claude tools - the
 * OpenAPI half of design-spec.md §16.6 ("pointing Khameleon at an external
 * service definition"). Deliberately scoped to JSON OpenAPI 3.x only for
 * this first version: YAML would need a new dependency, and Swagger 2.0's
 * different parameter/schema shape is a real, separate format, not a
 * detail - both are honest scope lines, not silently unsupported.
 *
 * Every function here is pure (no DB, no network except the one real fetch
 * in executeOperation) so the parsing/schema-building logic is directly
 * testable without a live API - see openApiImport.test.ts.
 */

import type Anthropic from "@anthropic-ai/sdk";

export class InvalidOpenApiSpecError extends Error {}

export interface ParsedOperationParam {
  name: string;
  in: "path" | "query";
  required: boolean;
  description?: string;
  /** Best-effort JSON Schema type from the spec's own parameter schema. */
  type: string;
}

export interface ParsedRequestBodySchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ParsedOperation {
  /** Unique within the spec - sanitized operationId, or a method_path fallback. */
  toolName: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** The raw OpenAPI path template, e.g. "/pets/{petId}". */
  path: string;
  summary: string;
  parameters: ParsedOperationParam[];
  requestBodySchema: ParsedRequestBodySchema | null;
}

export interface ParsedOpenApiSpec {
  title: string;
  baseUrl: string;
  operations: ParsedOperation[];
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/** Claude tool names must match ^[a-zA-Z0-9_-]{1,128}$. */
function sanitizeToolName(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+/, "");
  return (cleaned || "op").slice(0, 80);
}

/**
 * `specUrl`: the real URL the spec was fetched from, if any - needed
 * because a spec's own `servers[0].url` is legitimately allowed to be
 * relative (confirmed against a real spec during verification: the
 * actual Swagger Petstore reference spec's servers[0].url is literally
 * "/api/v3", not an absolute URL) and must be resolved against the
 * document's own location, same as the OpenAPI spec itself requires.
 * Pasted spec text has no such URL to resolve against - a relative
 * server URL there is rejected with a clear error instead of guessing.
 */
export function parseOpenApiSpec(raw: string, specUrl?: string): ParsedOpenApiSpec {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new InvalidOpenApiSpecError(
      "Not valid JSON. Only JSON OpenAPI 3.x specs are supported in this first version - export your spec as JSON, not YAML."
    );
  }

  const version = String(doc.openapi ?? "");
  if (!version.startsWith("3.")) {
    throw new InvalidOpenApiSpecError(
      `Only OpenAPI 3.x specs are supported (found "${doc.openapi ?? doc["swagger"] ?? "no version field"}"). Swagger 2.0 isn't supported yet.`
    );
  }

  const servers = doc.servers as Array<{ url?: string }> | undefined;
  const rawBaseUrl = servers?.[0]?.url;
  if (!rawBaseUrl) {
    throw new InvalidOpenApiSpecError("Spec has no servers[0].url - there's no real base URL to send requests to.");
  }

  let baseUrl: string;
  try {
    // Absolute already (http(s)://...) resolves to itself unchanged;
    // relative ("/api/v3") resolves against the document's own URL.
    baseUrl = specUrl ? new URL(rawBaseUrl, specUrl).toString() : new URL(rawBaseUrl).toString();
  } catch {
    throw new InvalidOpenApiSpecError(
      `servers[0].url ("${rawBaseUrl}") is relative, and no spec URL was available to resolve it against - paste the spec's absolute server URL, or import it by URL instead of pasted text.`
    );
  }
  baseUrl = baseUrl.replace(/\/$/, "");

  const paths = doc.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths || typeof paths !== "object" || Object.keys(paths).length === 0) {
    throw new InvalidOpenApiSpecError("Spec has no operations under paths.");
  }

  const operations: ParsedOperation[] = [];
  const usedNames = new Set<string>();

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of METHODS) {
      const op = pathItem?.[method] as Record<string, unknown> | undefined;
      if (!op) continue;

      const rawName = typeof op.operationId === "string" && op.operationId.trim() ? op.operationId : `${method}_${path}`;
      let toolName = sanitizeToolName(rawName);
      let unique = toolName;
      let n = 1;
      while (usedNames.has(unique)) unique = `${toolName}_${n++}`;
      usedNames.add(unique);

      const rawParams = (op.parameters as Array<Record<string, unknown>> | undefined) ?? [];
      const parameters: ParsedOperationParam[] = rawParams
        .filter((p) => p.in === "path" || p.in === "query")
        .map((p) => ({
          name: String(p.name),
          in: p.in as "path" | "query",
          required: p.in === "path" ? true : !!p.required,
          description: typeof p.description === "string" ? p.description : undefined,
          type: ((p.schema as Record<string, unknown> | undefined)?.type as string | undefined) ?? "string",
        }));

      let requestBodySchema: ParsedRequestBodySchema | null = null;
      const requestBody = op.requestBody as { content?: Record<string, { schema?: Record<string, unknown> }> } | undefined;
      const jsonSchema = requestBody?.content?.["application/json"]?.schema;
      if (jsonSchema && jsonSchema.type === "object") {
        requestBodySchema = {
          type: "object",
          properties: (jsonSchema.properties as Record<string, unknown>) ?? {},
          required: jsonSchema.required as string[] | undefined,
        };
      }

      operations.push({
        toolName: unique,
        method: method.toUpperCase() as ParsedOperation["method"],
        path,
        summary: (typeof op.summary === "string" && op.summary) || (typeof op.description === "string" && op.description) || `${method.toUpperCase()} ${path}`,
        parameters,
        requestBodySchema,
      });
    }
  }

  if (operations.length === 0) {
    throw new InvalidOpenApiSpecError("No GET/POST/PUT/PATCH/DELETE operations found under this spec's paths.");
  }

  const title = typeof (doc.info as Record<string, unknown> | undefined)?.title === "string"
    ? ((doc.info as Record<string, unknown>).title as string)
    : "Imported API";

  return { title, baseUrl, operations };
}

/** Builds the real Claude tool definition for one operation - the schema a model actually sees and fills in. */
export function operationToToolDefinition(integrationId: number, op: ParsedOperation): Anthropic.Messages.Tool {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const p of op.parameters) {
    properties[p.name] = { type: p.type, description: p.description ?? `${p.in} parameter` };
    if (p.required) required.push(p.name);
  }
  if (op.requestBodySchema) {
    for (const [key, schema] of Object.entries(op.requestBodySchema.properties)) {
      properties[key] = schema;
    }
    for (const key of op.requestBodySchema.required ?? []) required.push(key);
  }

  return {
    name: `ext_${integrationId}_${op.toolName}`,
    description: `[${op.method} ${op.path}] ${op.summary}`.slice(0, 1024),
    input_schema: { type: "object", properties, required },
  };
}

/** The `ext_<integrationId>_` prefix every custom-integration tool name carries - parsed back out in the dispatcher. */
export function parseCustomToolName(name: string): { integrationId: number; toolName: string } | null {
  const match = name.match(/^ext_(\d+)_(.+)$/);
  if (!match) return null;
  return { integrationId: Number(match[1]), toolName: match[2] };
}

/**
 * Makes the real HTTP call for a GET operation. Non-GET operations are
 * deliberately refused here, not gated - design-spec §16.4 requires a hard
 * confirm gate on every write action against a connected Integration, and
 * building a real per-operation confirm-gate UI for arbitrary imported
 * write operations is real, separate work (a dynamic payload-preview
 * surface, a pending-request list) that doesn't exist yet. Refusing
 * cleanly is the honest, safe scope line - never silently executing a
 * write with no gate at all.
 */
export async function executeOperation(
  baseUrl: string,
  op: ParsedOperation,
  input: Record<string, unknown>,
  authToken?: string
): Promise<string> {
  if (op.method !== "GET") {
    return (
      `This operation (${op.method} ${op.path}) would write or change data on the connected API. ` +
      "Real execution of write operations through an imported Integration isn't available yet - " +
      "describe the proposed action to the user instead of performing it."
    );
  }

  let path = op.path;
  const query = new URLSearchParams();
  for (const p of op.parameters) {
    const value = input[p.name];
    if (value === undefined || value === null) continue;
    if (p.in === "path") path = path.replace(`{${p.name}}`, encodeURIComponent(String(value)));
    else query.set(p.name, String(value));
  }

  const url = new URL(baseUrl.replace(/\/+$/, "") + path);
  for (const [key, value] of query) url.searchParams.set(key, value);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers["Authorization"] = authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;

  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  const truncated = text.length > 4000 ? `${text.slice(0, 4000)}\n\n[...truncated...]` : text;
  if (!res.ok) return `Error: HTTP ${res.status}\n${truncated}`;
  return truncated;
}
