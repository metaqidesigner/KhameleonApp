import { test } from "node:test";
import assert from "node:assert/strict";
import { isSchedulerRequestAuthorized } from "./scheduler.js";

test("no admin key configured -> open to any request (single-user default)", () => {
  assert.equal(isSchedulerRequestAuthorized("", ""), true);
  assert.equal(isSchedulerRequestAuthorized("", "Bearer garbage"), true);
});

test("admin key configured, no header -> rejected", () => {
  assert.equal(isSchedulerRequestAuthorized("secret123", ""), false);
});

test("admin key configured, wrong token -> rejected", () => {
  assert.equal(isSchedulerRequestAuthorized("secret123", "Bearer wrong"), false);
});

test("admin key configured, wrong scheme -> rejected", () => {
  assert.equal(isSchedulerRequestAuthorized("secret123", "Basic secret123"), false);
});

test("admin key configured, correct bearer token -> authorized", () => {
  assert.equal(isSchedulerRequestAuthorized("secret123", "Bearer secret123"), true);
});
