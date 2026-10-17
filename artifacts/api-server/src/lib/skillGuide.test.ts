import { test } from "node:test";
import assert from "node:assert/strict";
import { testSkillMatch, draftStepsPrompt, extractSteps } from "./skillGuide.js";

const installed = [{ name: "Invoice check", description: "Checks an invoice's details before it's paid or entered.", content: "" }];

test("says when a typical request would pick the new skill", () => {
  const r = testSkillMatch({ name: "Supplier statement reconciliation", description: "Matches a supplier statement against our ledger and lists differences." }, "Reconcile this supplier statement against the ledger", installed);
  assert.equal(r.isThisSkill, true);
  assert.deepEqual(r.suggestWords, []);
});

test("when it wouldn't be picked, suggests words from the request", () => {
  const r = testSkillMatch({ name: "Month end", description: "Closing tasks." }, "Help me prepare the accruals journal", installed);
  assert.equal(r.isThisSkill, false);
  assert.ok(r.suggestWords.includes("accruals") && r.suggestWords.includes("journal"));
});

test("draft prompt carries the guidelines and the task; steps are extracted from a chatty reply", () => {
  const p = draftStepsPrompt("1. Write clear steps.", { name: "X", description: "Y", task: "copy totals into the portal" });
  assert.match(p, /Write clear steps/);
  assert.match(p, /copy totals into the portal/);
  assert.equal(extractSteps("Sure! Here you go:\n1. Open the sheet.\n2. Copy the totals.\nHope that helps!"), "1. Open the sheet.\n2. Copy the totals.");
});
