/**
 * design-spec.md §15.2 - contextual Skill Set surfacing: when a task is
 * created, suggest the skill that fits it. Done by plain code (Khami
 * design, "code first"): the same word matching that picks skills for chat
 * (lib/skillPicker.ts). Instant, offline, and it never ties up Khami's
 * brain. (Previously an extra Claude call on every new task.)
 *
 * Called fire-and-forget right after a task is created (routes/tasks.ts) -
 * never blocks or fails task creation itself.
 */

import { pickSkill, words } from "../lib/skillPicker.js";
import type { SkillSetSuggestionCandidate, SuggestionTask, ParsedSuggestion } from "../lib/skillSetSuggestionMatch.js";

export function suggestSkillSetForTaskSync(task: SuggestionTask, candidates: SkillSetSuggestionCandidate[]): ParsedSuggestion | null {
  if (candidates.length === 0) return null;
  const request = `${task.title}\n${task.description ?? ""}`;
  const pick = pickSkill(request, candidates.map((c) => ({ name: c.name, description: c.description, content: "" })));
  if (!pick) return null;
  const chosen = candidates.find((c) => c.name === pick.skill.name);
  if (!chosen) return null;
  const req = new Set(words(request));
  const shared = [...new Set(words(`${chosen.name} ${chosen.description}`))].filter((w) => req.has(w));
  const reason = `This task mentions ${shared.length ? shared.slice(0, 3).map((w) => `"${w}"`).join(", ") : "the same kind of work"}, which "${chosen.name}" covers.`;
  return { skillSetId: chosen.id, reason };
}

export async function suggestSkillSetForTask(task: SuggestionTask, candidates: SkillSetSuggestionCandidate[]): Promise<ParsedSuggestion | null> {
  return suggestSkillSetForTaskSync(task, candidates);
}
