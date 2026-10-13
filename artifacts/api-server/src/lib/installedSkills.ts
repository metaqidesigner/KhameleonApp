/**
 * Installed skills, used automatically by the chat (docs/build-review.md,
 * Build 3 follow-up, 2026-10-13). Until this existed, installing a skill
 * had no effect: no agent ever read skill instructions.
 *
 * How it works: the tool-using agents get a short catalog of installed
 * skills (names + one-line descriptions only - cheap on every message) and
 * a `use_skill` tool. When a request matches a skill, the agent calls the
 * tool, gets the full steps and follows them. The chat shows "Using: <skill>"
 * from the actual tool call, so it only appears when a skill really was used.
 *
 * Pure helpers live here so they can be tested without a database; the
 * DB read is the one async function at the bottom.
 */
import type Anthropic from "@anthropic-ai/sdk";

export interface InstalledSkill {
  name: string;
  description: string;
  content: string;
}

export const USE_SKILL_TOOL_NAME = "use_skill";

export const USE_SKILL_TOOL: Anthropic.Messages.Tool = {
  name: USE_SKILL_TOOL_NAME,
  description:
    "Load the full steps of one of the user's installed skills. Call this before answering whenever the user's request matches a skill in the catalog, then follow the returned steps.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The skill's exact name from the catalog." },
    },
    required: ["name"],
  },
};

/** The system-prompt addition listing installed skills. Empty string when there are none. */
export function buildSkillCatalogPrompt(skills: InstalledSkill[]): string {
  if (skills.length === 0) return "";
  const lines = skills.map(s => `- ${s.name}${s.description ? `: ${s.description}` : ""}`);
  return [
    "",
    "The user has installed these skills (saved ways of doing a task):",
    ...lines,
    `If the user's request clearly matches one of them, call ${USE_SKILL_TOOL_NAME} with its name first and follow its steps. If nothing matches, answer normally and don't mention skills.`,
  ].join("\n");
}

/** Case/space-insensitive lookup by name. */
export function findInstalledSkill(skills: InstalledSkill[], name: string): InstalledSkill | undefined {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const target = norm(name);
  return skills.find(s => norm(s.name) === target);
}

/** What the use_skill tool returns to the agent. */
export function useSkillResult(skills: InstalledSkill[], name: string): string {
  const skill = findInstalledSkill(skills, name);
  if (!skill) {
    const available = skills.map(s => s.name).join(", ") || "none";
    return `No installed skill is called "${name}". Installed skills: ${available}.`;
  }
  return `Steps for "${skill.name}":\n${skill.content.trim() || "(this skill has no steps written yet - tell the user)"}`;
}

export async function loadInstalledSkills(): Promise<InstalledSkill[]> {
  const { db, skillSetsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const rows = await db
    .select({ name: skillSetsTable.name, description: skillSetsTable.description, content: skillSetsTable.content })
    .from(skillSetsTable)
    .where(eq(skillSetsTable.status, "installed"));
  return rows;
}
