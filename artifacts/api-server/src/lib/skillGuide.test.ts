import { test } from "node:test";
import assert from "node:assert/strict";
import { testSkillMatch, draftStepsPrompt, extractSteps, capturePrompt, parseCaptureDraft } from "./skillGuide.js";

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

test("capture prompt lists the recorded windows, notes and screen text in order", () => {
  const p = capturePrompt("1. Be clear.", [
    { app: "Microsoft Excel", title: "March statement.xlsx", note: "these are the supplier totals", text: "Invoice 101 1,200.00" },
    { app: "Google Chrome", title: "Payments - Supplier portal" },
  ]);
  assert.match(p, /1\. In Microsoft Excel - March statement\.xlsx\n   The user noted: these are the supplier totals\n   Visible on screen: Invoice 101/);
  assert.match(p, /2\. In Google Chrome - Payments - Supplier portal/);
  assert.match(p, /NAME:/);
});

test("reads the drafted name, description and steps, even with extra chatter", () => {
  const d = parseCaptureDraft("Here's your skill!\n**NAME:** Supplier payment entry\nDESCRIPTION: Enters supplier totals from a spreadsheet into the payments portal.\nSTEPS:\n1. Open the statement.\n2. Copy the totals (check this).\nLet me know!");
  assert.deepEqual(d, {
    name: "Supplier payment entry",
    description: "Enters supplier totals from a spreadsheet into the payments portal.",
    steps: "1. Open the statement.\n2. Copy the totals (check this).",
  });
});

test("recorded clicks and typing are described in plain words, passwords never", async () => {
  const { describeAction, capturePrompt } = await import("./skillGuide.js");
  assert.equal(describeAction({ type: "click", label: "Save", role: "AXButton" }), 'clicked "Save" (button)');
  assert.equal(describeAction({ type: "type", label: "Amount", text: "4200" }), 'typed "4200" into "Amount"');
  assert.match(describeAction({ type: "secure", label: "Password" }), /not recorded/);
  const p = capturePrompt("", [{ app: "Excel", title: "Ledger", actions: [{ type: "click", label: "Save", role: "AXButton" }] }]);
  assert.match(p, /What they did: clicked "Save" \(button\)/);
});
