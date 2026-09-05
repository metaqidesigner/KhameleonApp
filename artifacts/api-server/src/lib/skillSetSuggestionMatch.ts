/**
 * design-spec.md §15.2 - contextual surfacing. Pure logic only (prompt
 * construction, response parsing) so it's unit-testable without a live
 * Anthropic call, same split as agents/commandClassifier.ts for §11.1 -
 * the actual API call lives in agents/skillSetSuggester.ts, which calls
 * these two functions.
 */

export interface SkillSetSuggestionCandidate {
  id: number;
  name: string;
  description: string;
}

export interface SuggestionTask {
  title: string;
  description: string;
}

export interface SuggestionRequest {
  system: string;
  userMessage: string;
  maxTokens: number;
}

/**
 * Returns null when there's nothing to match against - no candidates,
 * no request. Otherwise asks for a real judgment call: reply NONE, or
 * "<id>|<short reason>" for a genuinely close match. "When in doubt,
 * prefer NONE" is the inverse of classifyComplexity's "fail toward the
 * capable path" - here the safe default is silence, not a suggestion,
 * since §15.2 requires a *close* match, not a loose one.
 */
export function buildSuggestionRequest(task: SuggestionTask, candidates: SkillSetSuggestionCandidate[]): SuggestionRequest | null {
  if (candidates.length === 0) return null;

  const catalog = candidates.map((c) => `- id ${c.id}: "${c.name}" — ${c.description}`).join("\n");
  return {
    system:
      "You match a task to an existing library of reusable instruction sets (\"Skill Sets\"), " +
      "only when there's a close, genuine fit - not a loose or generic one. " +
      "Given a task and a numbered catalog, reply with EXACTLY one line: " +
      "either `NONE` (no close match), or `<id>|<one short reason, under 12 words>`. " +
      "Never invent an id that isn't in the catalog. When in doubt, prefer NONE.",
    userMessage: `Task: "${task.title}"${task.description ? ` — ${task.description}` : ""}\n\nCatalog:\n${catalog}`,
    maxTokens: 60,
  };
}

export interface ParsedSuggestion {
  skillSetId: number;
  reason: string;
}

/**
 * NONE, an unparseable reply, or an id outside validIds all resolve to
 * null (no suggestion) - a hallucinated id is treated exactly like no
 * match at all, never surfaced.
 */
export function parseSuggestionResponse(responseText: string, validIds: number[]): ParsedSuggestion | null {
  const trimmed = responseText.trim();
  if (/^NONE\b/i.test(trimmed)) return null;

  const match = trimmed.match(/^(\d+)\s*\|\s*(.+)$/);
  if (!match) return null;

  const skillSetId = parseInt(match[1], 10);
  if (!validIds.includes(skillSetId)) return null;

  const reason = match[2].trim().slice(0, 200);
  if (!reason) return null;

  return { skillSetId, reason };
}
