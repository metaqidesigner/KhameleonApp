import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "../lib/returnTo.js";

test("after signing in, users go back to the Khameleon page they came from - never another site", () => {
  assert.equal(safeReturnTo("http://localhost:5173/settings?x=1", "localhost:4001"), "http://localhost:5173");
  assert.equal(safeReturnTo("https://khameleon.acme.co.uk/", "khameleon.acme.co.uk"), "https://khameleon.acme.co.uk");
  assert.equal(safeReturnTo("https://evil.example.com/", "khameleon.acme.co.uk"), "");
  assert.equal(safeReturnTo("javascript:alert(1)", "localhost:4001"), "");
  assert.equal(safeReturnTo(undefined, "localhost:4001"), "");
});
