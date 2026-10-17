import { test } from "node:test";
import assert from "node:assert/strict";
import { isVerifiedPublisher, publisherOf, toDirectoryIntegration } from "./mcpRegistry.js";

test("verified only when the publisher owns the domain it runs on", () => {
  assert.equal(isVerifiedPublisher("com.notion/mcp", "https://mcp.notion.com/mcp"), true);
  assert.equal(isVerifiedPublisher("com.atlassian/atlassian-mcp-server", "https://mcp.atlassian.com/v2/mcp"), true);
  assert.equal(isVerifiedPublisher("io.github.upstash/context7", "https://mcp.context7.com/mcp"), false);
  assert.equal(isVerifiedPublisher("io.github.pipeworx-io/notion_connect", "https://gateway.pipeworx.io/notion_connect/mcp"), false);
  assert.equal(isVerifiedPublisher("com.notion/mcp", "https://evil-notion.com/mcp"), false);
});

test("someone's copy on a shared platform is never verified", () => {
  assert.equal(isVerifiedPublisher("ai.smithery/renCosta2025-context7fork", "https://server.smithery.ai/@renCosta2025/context7fork/mcp"), false);
});

test("publisher in plain words", () => {
  assert.equal(publisherOf("com.notion/mcp"), "notion.com");
  assert.equal(publisherOf("io.github.upstash/context7"), "GitHub user upstash");
});

test("only remotely reachable integrations are listed; required keys are flagged", () => {
  assert.equal(toDirectoryIntegration({ name: "x/local", remotes: [] }), null);
  assert.equal(toDirectoryIntegration({ name: "x/templ", remotes: [{ type: "streamable-http", url: "https://{tenant}.x.com/mcp" }] }), null);
  const d = toDirectoryIntegration({
    name: "com.example/mcp", description: "Example", remotes: [{ type: "streamable-http", url: "https://mcp.example.com/mcp", headers: [{ name: "Authorization", isRequired: true, description: "Your API key" }] }],
  })!;
  assert.deepEqual([d.title, d.verified, d.publisher, d.needsKey, d.keyHint], ["Example", true, "example.com", true, "Your API key"]);
});
