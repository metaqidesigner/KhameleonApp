import { test } from "node:test";
import assert from "node:assert/strict";
import { undoPlanFor } from "./receiptUndo.js";

const base = { canUndo: true, undone: false };

test("skill install -> uninstall; connection -> disconnect", () => {
  assert.deepEqual(undoPlanFor({ ...base, category: "skill_set_install", target: "Invoice check" }), { kind: "uninstall-skill", skillName: "Invoice check" });
  assert.deepEqual(undoPlanFor({ ...base, category: "integration_connect", target: "microsoft" }), { kind: "disconnect", provider: "microsoft" });
});

test("nothing to undo when not undoable, already undone, no target, or unknown kind", () => {
  assert.equal(undoPlanFor({ ...base, canUndo: false, category: "skill_set_install", target: "x" }), null);
  assert.equal(undoPlanFor({ ...base, undone: true, category: "skill_set_install", target: "x" }), null);
  assert.equal(undoPlanFor({ ...base, category: "skill_set_install", target: null }), null);
  assert.equal(undoPlanFor({ ...base, category: "email_sent", target: "a@b.com" }), null);
});
