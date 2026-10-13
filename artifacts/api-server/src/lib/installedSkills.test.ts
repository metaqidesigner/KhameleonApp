import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSkillCatalogPrompt, findInstalledSkill, useSkillResult } from "./installedSkills.js";

const skills = [
  { name: "Meeting Prep Briefing", description: "Builds a short pre-meeting briefing.", content: "1. Summarize purpose\n2. List attendees" },
  { name: "Monthly Reconciliation", description: "", content: "" },
];

test("catalog: empty when nothing is installed", () => {
  assert.equal(buildSkillCatalogPrompt([]), "");
});

test("catalog: lists names and descriptions only, never the steps", () => {
  const p = buildSkillCatalogPrompt(skills);
  assert.match(p, /- Meeting Prep Briefing: Builds a short pre-meeting briefing\./);
  assert.match(p, /- Monthly Reconciliation\n/);
  assert.doesNotMatch(p, /Summarize purpose/);
  assert.match(p, /use_skill/);
});

test("lookup is case- and spacing-insensitive", () => {
  assert.equal(findInstalledSkill(skills, "  meeting   prep briefing ")?.name, "Meeting Prep Briefing");
  assert.equal(findInstalledSkill(skills, "Nope"), undefined);
});

test("tool result: returns steps, or says what is installed when the name is wrong", () => {
  assert.match(useSkillResult(skills, "Meeting Prep Briefing"), /1\. Summarize purpose/);
  assert.match(useSkillResult(skills, "Monthly Reconciliation"), /no steps written yet/);
  assert.match(useSkillResult(skills, "Unknown"), /Installed skills: Meeting Prep Briefing, Monthly Reconciliation/);
});
