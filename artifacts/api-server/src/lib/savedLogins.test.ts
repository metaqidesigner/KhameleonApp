import { test } from "node:test";
import assert from "node:assert/strict";
import { matchLogin } from "./savedLogins.js";

const items = [{ id: 1, name: "Supplier portal" }, { id: 2, name: "Bank (business)" }, { id: 3, name: "Payroll system" }];

test("finds the saved login the skill or AI means", () => {
  assert.equal(matchLogin(items, "Supplier portal")?.id, 1);
  assert.equal(matchLogin(items, "supplier")?.id, 1);
  assert.equal(matchLogin(items, "the payroll login")?.id, 3);
  assert.equal(matchLogin(items, "", 2)?.id, 2, "the skill's linked login when no name is given");
  assert.equal(matchLogin(items, "Netflix"), null);
});
