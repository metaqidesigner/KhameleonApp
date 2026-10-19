import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSections, procedureSteps, skillSteps, pickSection, compareSteps, contradictionPrompt, parseContradictions, similarity, worthAsking } from "./procedures.js";

const MANUAL = `Finance Procedures Manual

1 Purpose
This manual sets out how the finance team works.

3.1 Purchase invoices
1. Check the invoice matches the purchase order.
2. Enter the invoice in the purchase ledger.
3. Invoices over £5,000 must be approved by the Finance Manager before payment.

3.2 Supplier statement reconciliation
1. Obtain the supplier statement for the month.
2. Export the supplier's account from the purchase ledger.
3. Match each invoice on the statement to the ledger by invoice number.
4. List any invoices missing from the ledger or with different amounts.
5. Email the supplier to request copies of missing invoices.
6. Record the reconciliation in the month-end checklist.

EXPENSES
Claims must be submitted within 30 days with receipts.`;

test("splits a manual into its sections by heading", () => {
  const s = splitSections(MANUAL);
  const ids = s.map(x => x.id);
  assert.ok(ids.includes("3.1") && ids.includes("3.2"), ids.join(","));
  assert.equal(s.find(x => x.id === "3.2")!.heading, "Supplier statement reconciliation");
  assert.ok(s.some(x => x.heading === "EXPENSES"));
  // PDF text: no blank line before an ALL-CAPS heading
  const pdfLike = splitSections("3.2 Statements\n1. Obtain the statement.\n2. Match invoices.\nEXPENSES\nClaims within 30 days.");
  assert.deepEqual(pdfLike.map(x => x.heading), ["Statements", "EXPENSES"]);
  assert.deepEqual(splitSections("Just one paragraph of text with no headings at all."), [{ id: "all", heading: "Whole document", text: "Just one paragraph of text with no headings at all." }]);
});

test("reads a section's numbered steps, and a skill's steps", () => {
  const sec = splitSections(MANUAL).find(x => x.id === "3.2")!;
  const p = procedureSteps(sec.text);
  assert.equal(p.length, 6);
  assert.match(p[2], /^Match each invoice/);
  assert.deepEqual(skillSteps("When asked:\n1. Do A.\n2) Do B.\nNotes"), ["Do A.", "Do B."]);
});

test("picks the procedure section that fits the skill", () => {
  const doc = { id: 1, sections: splitSections(MANUAL) };
  const pick = pickSection({ name: "Supplier statement reconciliation", description: "Match a supplier statement to the ledger", content: "1. Get the statement\n2. Match invoices to the ledger" }, [doc]);
  assert.equal(pick?.section.id, "3.2");
  assert.equal(pickSection({ name: "Book a meeting room", description: "Reserve a room", content: "1. Open the room calendar" }, [doc]), null);
});

test("a skill that follows the procedure matches", () => {
  const proc = procedureSteps(splitSections(MANUAL).find(x => x.id === "3.2")!.text);
  const r = compareSteps([
    "Obtain the supplier statement for the month.",
    "Export the supplier account from the purchase ledger.",
    "Match each statement invoice to the ledger by invoice number.",
    "List invoices missing from the ledger or with different amounts.",
    "Email the supplier requesting copies of the missing invoices.",
    "Record the reconciliation in the month-end checklist.",
  ], proc);
  assert.equal(r.status, "matches");
  assert.equal(r.firstDifference, null);
  assert.equal(r.steps[2].match?.procStep, 3);
});

test("flags missing, extra and out-of-order steps, quoting the procedure", () => {
  const proc = procedureSteps(splitSections(MANUAL).find(x => x.id === "3.2")!.text);
  const r = compareSteps([
    "Export the supplier account from the purchase ledger.",
    "Obtain the supplier statement for the month.",
    "Match each statement invoice to the ledger by invoice number.",
    "Print everything and file it in the blue folder.",
    "Email the supplier requesting copies of the missing invoices.",
  ], proc);
  assert.equal(r.status, "differs");
  assert.equal(r.firstDifference, 2);
  assert.equal(r.steps[1].flags[0].kind, "order");
  assert.match(r.steps[1].flags[0].quote!, /Obtain the supplier statement/);
  assert.equal(r.steps[3].flags[0].kind, "extra");
  const missingQuotes = r.missing.map(m => m.quote).join(" | ");
  assert.match(missingQuotes, /List any invoices missing/);
  assert.match(missingQuotes, /month-end checklist/);
  assert.equal(r.missing.find(m => /month-end/.test(m.quote))!.afterStep, 5);
});

test("contradiction question and answer handling", () => {
  const proc = ["Invoices over £5,000 must be approved by the Finance Manager before payment."];
  const r = compareSteps(["Invoices over £10,000 are approved by the Finance Manager before payment."], proc);
  assert.ok(r.steps[0].match, `similarity ${similarity(proc[0], "Invoices over £10,000 are approved by the Finance Manager before payment.")}`);
  assert.match(contradictionPrompt(r.steps)!, /PROCEDURE: Invoices over £5,000/);
  assert.deepEqual(parseContradictions("**STEP 1:** The limit is £5,000, not £10,000.\nSTEP 9: out of range", [1]), [{ n: 1, reason: "The limit is £5,000, not £10,000" }]);
  assert.deepEqual(parseContradictions("NONE", [1]), []);
  // Rewordings aren't sent to Khami at all
  const reworded = compareSteps(["Match every invoice on the statement against the ledger using the invoice number."], ["Match each invoice on the statement to the ledger by invoice number."]);
  assert.equal(contradictionPrompt(reworded.steps), null);
  assert.deepEqual(parseContradictions("STEP 1: none - consistent", [1]), []);
});

test("worth asking Khami only when amounts, a 'not', or the approver differ", () => {
  assert.ok(worthAsking("Invoices over £10,000 need approval", "Invoices over £5,000 must be approved"));
  assert.ok(worthAsking("Pay the supplier straight away", "Do not pay the supplier until approved"));
  assert.ok(worthAsking("The team lead approves the invoice", "The Finance Manager approves the invoice"));
  assert.equal(worthAsking("Obtain the monthly supplier statement", "Obtain the supplier statement for the month"), false);
});
