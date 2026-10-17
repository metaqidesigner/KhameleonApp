import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSkill } from "./skillPicker.js";
import { STARTER_SKILLS } from "../starterSkills.js";

const skills = STARTER_SKILLS.map(s => ({ name: s.name, description: s.description, content: s.content }));
const pick = (q: string) => pickSkill(q, skills)?.skill.name ?? null;

test("picks the matching starter skill for typical requests", () => {
  assert.equal(pick("Can you prep me for my meeting tomorrow at 10 with Dana and Sam?"), "Meeting Prep Briefing");
  assert.equal(pick("Turn these notes into meeting minutes with action items"), "Meeting minutes and action items");
  assert.equal(pick("Compare these two lists and tell me which items don't match"), "Month-end reconciliation check");
  assert.equal(pick("Check this invoice before I pay it"), "Invoice check");
  assert.equal(pick("Help me put together my expense report from these receipts"), "Expense report preparation");
  assert.equal(pick("Write up the incident from this morning's outage"), "Incident write-up");
});

test("uses no skill for unrelated questions", () => {
  assert.equal(pick("What is the capital of Australia?"), null);
  assert.equal(pick("Polish the wording of this email"), null);
  assert.equal(pick("hi"), null);
  assert.equal(pick("What's the weather like in Sydney today?"), null);
  assert.equal(pick("Tell me a joke"), null);
  assert.equal(pick("How do I reset my password?"), null);
  assert.equal(pick("Translate this sentence into French"), null);
  assert.equal(pick("Who won the football last night?"), null);
});

test("matches skills installed from GitHub (hyphenated names, plural/singular)", () => {
  const github = [{
    name: "internal-comms",
    description: "A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.).",
    content: "",
  }];
  assert.equal(pickSkill("Write a 3P update for my team. Progress: finished the Q3 reconciliation.", github)?.skill.name, "internal-comms");
  assert.equal(pickSkill("Draft our company newsletter for October", github)?.skill.name, "internal-comms");
  assert.equal(pickSkill("What is the capital of Australia?", github), null);
});
