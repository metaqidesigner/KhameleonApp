import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClassificationRequest, parseClassification } from "./commandClassifier.js";

test("buildClassificationRequest: cheap by construction - tiny max_tokens", () => {
  const req = buildClassificationRequest("what's 15% of 340?");
  assert.equal(req.maxTokens, 8);
  assert.equal(req.userMessage, "what's 15% of 340?");
  assert.match(req.system, /SIMPLE/);
  assert.match(req.system, /COMPLEX/);
});

test("parseClassification: exact SIMPLE -> simple", () => {
  assert.equal(parseClassification("SIMPLE"), "simple");
});

test("parseClassification: lowercase/whitespace variants still parse as simple", () => {
  assert.equal(parseClassification("  simple\n"), "simple");
  assert.equal(parseClassification("Simple."), "simple");
});

test("parseClassification: exact COMPLEX -> complex", () => {
  assert.equal(parseClassification("COMPLEX"), "complex");
});

test("parseClassification: garbage/empty/ambiguous response fails toward complex (the capable path)", () => {
  assert.equal(parseClassification(""), "complex");
  assert.equal(parseClassification("I'm not sure"), "complex");
  assert.equal(parseClassification("SIMPLEX"), "complex"); // must not substring-match SIMPLE
});
