import { test } from "node:test";
import assert from "node:assert/strict";
import { detectConfidential, looksTricky, soundsUnsure } from "./escalation.js";

test("confidential: bank, card, NI, pay, health and marked text stay on the computer", () => {
  assert.ok(detectConfidential("Pay supplier: sort code 20-00-00, account number 12345678").confidential);
  assert.ok(detectConfidential("Card 4111 1111 1111 1111 exp 12/27").reasons.includes("it includes a card number"));
  assert.ok(detectConfidential("Employee AB 12 34 56 C started Monday").confidential);
  assert.ok(detectConfidential("Summarise Jane's salary review").reasons.includes("it mentions pay or salaries"));
  assert.ok(detectConfidential("Draft a reply about his sick note").confidential);
  assert.ok(detectConfidential("PRIVATE AND CONFIDENTIAL - board minutes").confidential);
  assert.ok(detectConfidential("IBAN GB82 WEST 1234 5698 7654 32").confidential);
});

test("confidential: ordinary work isn't flagged", () => {
  assert.equal(detectConfidential("Draft a reply to Jane about the Q3 figures by Friday").confidential, false);
  assert.equal(detectConfidential("Invoice 10260 for £4,250.00, order 12345678901").confidential, false, "a non-card long number");
  assert.equal(detectConfidential("Book the meeting for 12-10-26").confidential, false, "a date isn't a sort code");
  assert.ok(detectConfidential("Bank: Barclays 20-00-00 / 12345678").confidential);
});

test("tricky: long writing and careful reasoning; quick jobs aren't", () => {
  assert.ok(looksTricky("Write a business case for moving to cloud accounting").tricky);
  assert.ok(looksTricky("Draft a 1000 word article on our new expenses process").tricky);
  assert.ok(looksTricky("Analyse the pros and cons of switching suppliers for our stationery given the price rises").tricky);
  assert.equal(looksTricky("Add a task to chase invoice 10260 by Friday").tricky, false);
  assert.equal(looksTricky("Summarise this email in two lines").tricky, false);
});

test("unsure answers are spotted", () => {
  assert.ok(soundsUnsure("I'm not sure what the current VAT threshold is."));
  assert.ok(soundsUnsure("I don't have access to your calendar."));
  assert.equal(soundsUnsure("Done - I've added the task for Friday."), false);
});
