/**
 * design-spec.md §15.2 - the real Claude call behind contextual Skill Set
 * surfacing. Pure prompt-building/parsing lives in
 * lib/skillSetSuggestionMatch.ts (unit-tested); this file is the network
 * call, same split as agents/task-executor.ts's classifyComplexity().
 *
 * Called fire-and-forget right after a task is created (routes/tasks.ts) -
 * never blocks or fails task creation itself. Any failure here just means
 * no suggestion shows up, same as classifyComplexity defaulting to
 * 'complex' rather than throwing.
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger.js";
import {
  buildSuggestionRequest, parseSuggestionResponse,
  type SkillSetSuggestionCandidate, type SuggestionTask, type ParsedSuggestion,
} from "../lib/skillSetSuggestionMatch.js";

// Mirrors task-executor.ts's own getClient() - not extracted into a shared
// module, to avoid touching that central file for an unrelated refactor.
function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
  });
}

export async function suggestSkillSetForTask(
  task: SuggestionTask,
  candidates: SkillSetSuggestionCandidate[],
): Promise<ParsedSuggestion | null> {
  const req = buildSuggestionRequest(task, candidates);
  if (!req) return null;

  try {
    const client = getClient();
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.userMessage }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    return parseSuggestionResponse(text, candidates.map((c) => c.id));
  } catch (err) {
    logger.warn({ err }, "Skill Set suggestion matching failed — no suggestion will be shown for this task");
    return null;
  }
}
