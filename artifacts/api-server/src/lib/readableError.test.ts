import { test } from "node:test";
import assert from "node:assert/strict";
import { readableError } from "./readableError.js";

test("pulls the message out of a provider error", () => {
  const raw = '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."},"request_id":"req_1"}';
  assert.equal(readableError(raw), "Your credit balance is too low to access the Anthropic API.");
});

test("leaves plain errors alone", () => {
  assert.equal(readableError("Anthropic API key not configured"), "Anthropic API key not configured");
});
