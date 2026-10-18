import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestSkillSetForTaskSync } from "./skillSetSuggester.js";

const candidates = [
  { id: 1, name: "Supplier statement reconciliation", description: "Matches a supplier statement against the ledger and lists differences." },
  { id: 2, name: "Meeting minutes", description: "Writes minutes from meeting notes: decisions, actions, owners." },
];

test("suggests the skill that fits a new task, by plain word matching", () => {
  const s = suggestSkillSetForTaskSync({ title: "Reconcile Acme supplier statement", description: "September" }, candidates);
  assert.equal(s?.skillSetId, 1);
  assert.match(s!.reason, /Supplier statement reconciliation/);
  assert.equal(suggestSkillSetForTaskSync({ title: "Write up minutes from the board meeting", description: "" }, candidates)?.skillSetId, 2);
});

test("suggests nothing for unrelated tasks", () => {
  assert.equal(suggestSkillSetForTaskSync({ title: "Book dentist", description: "" }, candidates), null);
  assert.equal(suggestSkillSetForTaskSync({ title: "Reconcile", description: "" }, []), null);
});
