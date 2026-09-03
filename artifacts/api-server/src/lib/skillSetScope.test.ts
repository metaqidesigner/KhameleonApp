import { test } from "node:test";
import assert from "node:assert/strict";
import { requiresHardGate, diffScope } from "./skillSetScope.js";

test("requiresHardGate: authored, no scope -> immediate install", () => {
  assert.equal(requiresHardGate({ sourceType: "authored", requestedTools: [], requestedIntegrationIds: [] }), false);
});

test("requiresHardGate: authored, requests a tool -> gated", () => {
  assert.equal(requiresHardGate({ sourceType: "authored", requestedTools: ["shell.readFile"], requestedIntegrationIds: [] }), true);
});

test("requiresHardGate: authored, requests an integration -> gated", () => {
  assert.equal(requiresHardGate({ sourceType: "authored", requestedTools: [], requestedIntegrationIds: ["gmail"] }), true);
});

test("requiresHardGate: github source with zero requested scope -> still gated (§15.5)", () => {
  assert.equal(requiresHardGate({ sourceType: "github", requestedTools: [], requestedIntegrationIds: [] }), true);
});

test("requiresHardGate: url and marketplace sources are also always gated", () => {
  assert.equal(requiresHardGate({ sourceType: "url", requestedTools: [], requestedIntegrationIds: [] }), true);
  assert.equal(requiresHardGate({ sourceType: "marketplace", requestedTools: [], requestedIntegrationIds: [] }), true);
});

test("diffScope: no change -> empty delta", () => {
  const d = diffScope(
    { requestedTools: ["a"], requestedIntegrationIds: ["gmail"] },
    { requestedTools: ["a"], requestedIntegrationIds: ["gmail"] },
  );
  assert.equal(d.isEmpty, true);
  assert.deepEqual(d.addedTools, []);
  assert.deepEqual(d.addedIntegrationIds, []);
});

test("diffScope: a removal only -> empty delta (removing scope never gates)", () => {
  const d = diffScope(
    { requestedTools: ["a", "b"], requestedIntegrationIds: [] },
    { requestedTools: ["a"], requestedIntegrationIds: [] },
  );
  assert.equal(d.isEmpty, true);
});

test("diffScope: a new tool added -> non-empty delta naming only the addition", () => {
  const d = diffScope(
    { requestedTools: ["a"], requestedIntegrationIds: [] },
    { requestedTools: ["a", "b"], requestedIntegrationIds: [] },
  );
  assert.equal(d.isEmpty, false);
  assert.deepEqual(d.addedTools, ["b"]);
});

test("diffScope: a new integration dependency added -> non-empty delta", () => {
  const d = diffScope(
    { requestedTools: [], requestedIntegrationIds: ["gmail"] },
    { requestedTools: [], requestedIntegrationIds: ["gmail", "slack"] },
  );
  assert.equal(d.isEmpty, false);
  assert.deepEqual(d.addedIntegrationIds, ["slack"]);
});
