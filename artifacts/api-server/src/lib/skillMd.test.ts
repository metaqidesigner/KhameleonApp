import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSkillMd, classifyLicence, parseGithubUrl, skillFolderOf, buildSkillContent } from "./skillMd.js";

test("reads front matter and body", () => {
  const p = parseSkillMd("---\nname: internal-comms\ndescription: Helps write internal comms.\n  Use for status reports.\nlicense: Complete terms in LICENSE.txt\n---\n\n## When to use\nAlways.");
  assert.equal(p.name, "internal-comms");
  assert.equal(p.description, "Helps write internal comms. Use for status reports.");
  assert.equal(p.body, "## When to use\nAlways.");
});

test("no front matter: whole text is the body", () => {
  assert.deepEqual(parseSkillMd("Just steps", "x"), { name: "x", description: "", body: "Just steps" });
});

test("classifies licences", () => {
  assert.equal(classifyLicence("                                 Apache License\n Version 2.0, January 2004").kind, "open");
  assert.equal(classifyLicence("MIT License\n\nCopyright").label, "MIT");
  assert.equal(classifyLicence("© 2025 Anthropic, PBC. All rights reserved.\nLICENSE: governed by your agreement with Anthropic").kind, "restricted");
  assert.equal(classifyLicence(null).kind, "unknown");
});

test("understands GitHub links", () => {
  assert.deepEqual(parseGithubUrl("https://github.com/anthropics/skills"), { owner: "anthropics", repo: "skills", path: "" });
  assert.deepEqual(parseGithubUrl("github.com/anthropics/skills/tree/main/skills/pdf"), { owner: "anthropics", repo: "skills", ref: "main", path: "skills/pdf" });
  assert.deepEqual(parseGithubUrl("https://github.com/o/r/blob/dev/a/SKILL.md"), { owner: "o", repo: "r", ref: "dev", path: "a/SKILL.md" });
  assert.deepEqual(parseGithubUrl("https://raw.githubusercontent.com/o/r/main/a/SKILL.md"), { owner: "o", repo: "r", ref: "main", path: "a/SKILL.md" });
  assert.equal(parseGithubUrl("https://example.com/x"), null);
  assert.equal(skillFolderOf("skills/pdf/SKILL.md"), "skills/pdf");
});

test("builds content with file markers and a size cap", () => {
  const { content, truncated } = buildSkillContent("Steps", [{ path: "examples/a.md", text: "Example A" }]);
  assert.equal(content, "Steps\n\n=== File: examples/a.md ===\nExample A");
  assert.equal(truncated, false);
  assert.equal(buildSkillContent("x".repeat(30_000), []).truncated, true);
});
