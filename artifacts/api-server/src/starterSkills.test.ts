import { test } from "node:test";
import assert from "node:assert/strict";
import { STARTER_SKILLS, missingStarters } from "./starterSkills.js";

const BUILT_IN_DOMAINS = ["Business as Usual", "People", "Governance", "Change", "Administration", "Strategic"];

test("18 starters, unique names, each with steps and a built-in domain", () => {
  assert.equal(STARTER_SKILLS.length, 18);
  assert.equal(new Set(STARTER_SKILLS.map(s => s.name.toLowerCase())).size, 18);
  for (const s of STARTER_SKILLS) {
    assert.ok(BUILT_IN_DOMAINS.includes(s.domain), `${s.name}: unknown domain ${s.domain}`);
    assert.match(s.content, /\n1\. /, `${s.name}: no numbered steps`);
    assert.ok(s.description.length > 0, `${s.name}: no description`);
  }
});

test("missingStarters skips names already present, case-insensitively", () => {
  const missing = missingStarters(["meeting prep briefing", "Weekly Status Update Drafting"]);
  assert.equal(missing.length, 16);
  assert.ok(!missing.some(s => s.name === "Meeting Prep Briefing"));
});

test("no third-party names inside shipped skills (docs/legal-compliance.md)", () => {
  for (const s of STARTER_SKILLS) {
    assert.doesNotMatch(`${s.name} ${s.description} ${s.content}`, /anthropic|claude|openai|gpt|gemini|google drive|slack|qwen/i, s.name);
  }
});
