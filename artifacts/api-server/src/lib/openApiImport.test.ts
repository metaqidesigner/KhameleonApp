/**
 * Unit tests for the real OpenAPI 3.x parsing/schema-building/dispatch
 * logic - design-spec.md §16.6. Pure functions, no DB/network except
 * executeOperation's one real fetch call (tested against a local HTTP
 * server, not a live API).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  parseOpenApiSpec,
  operationToToolDefinition,
  parseCustomToolName,
  executeOperation,
  InvalidOpenApiSpecError,
  type ParsedOperation,
} from "./openApiImport.js";

const PETSTORE_SPEC = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "Petstore" },
  servers: [{ url: "https://api.example.com/v1" }],
  paths: {
    "/pets": {
      get: {
        operationId: "listPets",
        summary: "List all pets",
        parameters: [{ name: "limit", in: "query", required: false, schema: { type: "integer" } }],
      },
      post: {
        operationId: "createPet",
        summary: "Create a pet",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
            },
          },
        },
      },
    },
    "/pets/{petId}": {
      get: {
        operationId: "getPet",
        summary: "Get a pet by id",
        parameters: [{ name: "petId", in: "path", required: true, schema: { type: "string" } }],
      },
    },
  },
});

test("parseOpenApiSpec extracts the real base URL and every operation", () => {
  const parsed = parseOpenApiSpec(PETSTORE_SPEC);
  assert.equal(parsed.title, "Petstore");
  assert.equal(parsed.baseUrl, "https://api.example.com/v1");
  assert.equal(parsed.operations.length, 3);
  assert.deepEqual(parsed.operations.map((o) => o.toolName).sort(), ["createPet", "getPet", "listPets"]);
});

test("parseOpenApiSpec marks path parameters as required regardless of the spec's own required field", () => {
  const parsed = parseOpenApiSpec(PETSTORE_SPEC);
  const getPet = parsed.operations.find((o) => o.toolName === "getPet")!;
  assert.deepEqual(getPet.parameters, [{ name: "petId", in: "path", required: true, description: undefined, type: "string" }]);
});

test("parseOpenApiSpec captures a JSON request body's schema for a write operation", () => {
  const parsed = parseOpenApiSpec(PETSTORE_SPEC);
  const createPet = parsed.operations.find((o) => o.toolName === "createPet")!;
  assert.equal(createPet.method, "POST");
  assert.deepEqual(createPet.requestBodySchema, { type: "object", properties: { name: { type: "string" } }, required: ["name"] });
});

test("parseOpenApiSpec de-duplicates operationIds that collide", () => {
  const spec = JSON.stringify({
    openapi: "3.0.0",
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/a": { get: { operationId: "doThing" } },
      "/b": { get: { operationId: "doThing" } },
    },
  });
  const parsed = parseOpenApiSpec(spec);
  assert.deepEqual(parsed.operations.map((o) => o.toolName).sort(), ["doThing", "doThing_1"]);
});

test("parseOpenApiSpec rejects non-JSON input with a clear, honest error", () => {
  assert.throws(() => parseOpenApiSpec("openapi: 3.0.0\npaths: {}"), InvalidOpenApiSpecError);
});

test("parseOpenApiSpec rejects Swagger 2.0 (not yet supported) rather than silently misparsing it", () => {
  const swagger2 = JSON.stringify({ swagger: "2.0", paths: { "/x": { get: {} } } });
  assert.throws(() => parseOpenApiSpec(swagger2), InvalidOpenApiSpecError);
});

test("parseOpenApiSpec rejects a spec with no servers[0].url", () => {
  const spec = JSON.stringify({ openapi: "3.0.0", paths: { "/x": { get: {} } } });
  assert.throws(() => parseOpenApiSpec(spec), InvalidOpenApiSpecError);
});

test("parseOpenApiSpec resolves a relative servers[0].url against the spec's own URL - found for real against the live Swagger Petstore reference spec, whose servers[0].url is literally \"/api/v3\"", () => {
  const spec = JSON.stringify({
    openapi: "3.0.0",
    servers: [{ url: "/api/v3" }],
    paths: { "/pets": { get: { operationId: "listPets" } } },
  });
  const parsed = parseOpenApiSpec(spec, "https://petstore3.swagger.io/api/v3/openapi.json");
  assert.equal(parsed.baseUrl, "https://petstore3.swagger.io/api/v3");
});

test("parseOpenApiSpec rejects a relative servers[0].url when there's no spec URL to resolve it against (pasted text)", () => {
  const spec = JSON.stringify({
    openapi: "3.0.0",
    servers: [{ url: "/api/v3" }],
    paths: { "/pets": { get: { operationId: "listPets" } } },
  });
  assert.throws(() => parseOpenApiSpec(spec), InvalidOpenApiSpecError);
});

test("parseOpenApiSpec leaves an already-absolute servers[0].url unchanged", () => {
  const parsed = parseOpenApiSpec(PETSTORE_SPEC);
  assert.equal(parsed.baseUrl, "https://api.example.com/v1");
});

test("parseOpenApiSpec rejects a spec with no operations", () => {
  const spec = JSON.stringify({ openapi: "3.0.0", servers: [{ url: "https://api.example.com" }], paths: {} });
  assert.throws(() => parseOpenApiSpec(spec), InvalidOpenApiSpecError);
});

test("operationToToolDefinition builds a real Claude tool name scoped to the integration id", () => {
  const op: ParsedOperation = {
    toolName: "getPet", method: "GET", path: "/pets/{petId}", summary: "Get a pet",
    parameters: [{ name: "petId", in: "path", required: true, type: "string" }],
    requestBodySchema: null,
  };
  const tool = operationToToolDefinition(42, op);
  assert.equal(tool.name, "ext_42_getPet");
  assert.match(tool.description!, /GET \/pets\/\{petId\}/);
  assert.deepEqual(tool.input_schema, {
    type: "object",
    properties: { petId: { type: "string", description: "path parameter" } },
    required: ["petId"],
  });
});

test("operationToToolDefinition merges request-body properties into the tool's top-level schema", () => {
  const op: ParsedOperation = {
    toolName: "createPet", method: "POST", path: "/pets", summary: "Create",
    parameters: [],
    requestBodySchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  };
  const tool = operationToToolDefinition(1, op);
  assert.deepEqual(tool.input_schema.properties, { name: { type: "string" } });
  assert.deepEqual(tool.input_schema.required, ["name"]);
});

test("parseCustomToolName round-trips the integration id and operation tool name", () => {
  assert.deepEqual(parseCustomToolName("ext_7_getPet"), { integrationId: 7, toolName: "getPet" });
});

test("parseCustomToolName returns null for a name that isn't one of ours", () => {
  assert.equal(parseCustomToolName("read_file"), null);
  assert.equal(parseCustomToolName("ext_notanumber_getPet"), null);
});

test("executeOperation refuses to run a write operation - §16.4 requires a hard gate this dispatcher doesn't have yet", async () => {
  const op: ParsedOperation = { toolName: "createPet", method: "POST", path: "/pets", summary: "Create", parameters: [], requestBodySchema: null };
  const result = await executeOperation("https://api.example.com", op, {});
  assert.match(result, /would write or change data/);
  assert.match(result, /isn't available yet/);
});

test("executeOperation makes a real GET request, substituting path params and adding query params", async () => {
  let receivedUrl = "";
  let receivedAuth = "";
  const server = createServer((req, res) => {
    receivedUrl = req.url ?? "";
    receivedAuth = req.headers.authorization ?? "";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: "p1", name: "Rex" }));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const op: ParsedOperation = {
      toolName: "getPet", method: "GET", path: "/pets/{petId}", summary: "Get",
      parameters: [
        { name: "petId", in: "path", required: true, type: "string" },
        { name: "verbose", in: "query", required: false, type: "boolean" },
      ],
      requestBodySchema: null,
    };
    const result = await executeOperation(`http://localhost:${port}`, op, { petId: "p1", verbose: true }, "secret-token");
    assert.equal(receivedUrl, "/pets/p1?verbose=true");
    assert.equal(receivedAuth, "Bearer secret-token");
    assert.match(result, /Rex/);
  } finally {
    server.close();
  }
});

test("executeOperation surfaces a non-2xx response honestly instead of throwing or hiding it", async () => {
  const server = createServer((_req, res) => { res.writeHead(404); res.end("not found"); });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const op: ParsedOperation = { toolName: "getPet", method: "GET", path: "/pets/missing", summary: "Get", parameters: [], requestBodySchema: null };
    const result = await executeOperation(`http://localhost:${port}`, op, {});
    assert.match(result, /Error: HTTP 404/);
  } finally {
    server.close();
  }
});
