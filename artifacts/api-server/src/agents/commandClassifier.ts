/**
 * design-spec.md §11.1 - the classification step behind the `simple` vs
 * `orchestrator` agent-type split. Pure logic only (prompt construction,
 * response parsing) so it's unit-testable without a live Anthropic call,
 * same pattern as lib/skillSetScope.ts for §15 - the actual API call
 * lives in task-executor.ts, which calls these two functions.
 */

export interface ClassificationRequest {
  system: string;
  userMessage: string;
  maxTokens: number;
}

/**
 * §11.1: `simple` is for "single-shot lookups with no tool calls" -
 * everything else (multi-step work, anything needing a tool, anything
 * producing a deliverable) stays on the existing multi-step orchestrator
 * path. Kept deliberately cheap: a short system prompt and a tiny
 * max_tokens budget, since this call's whole purpose is to save cost on
 * the common case, not add to it.
 */
export function buildClassificationRequest(command: string): ClassificationRequest {
  return {
    system:
      "Classify the user's request as SIMPLE or COMPLEX. " +
      "SIMPLE: answerable directly in one response, no tools, no multi-step work needed " +
      "(a question, a calculation, a rewrite, a quick explanation). " +
      "COMPLEX: needs one or more tool calls (reading email, calendar, files, the web) " +
      "or produces a multi-part deliverable. " +
      "Reply with exactly one word: SIMPLE or COMPLEX.",
    userMessage: command,
    maxTokens: 8,
  };
}

export type Complexity = "simple" | "complex";

/**
 * Defaults to 'complex' on anything ambiguous or unparseable - the cost
 * of a wrongly-"complex" simple question is a couple of wasted planning
 * tokens; the cost of a wrongly-"simple" complex one is a task that
 * silently can't do what it needed to. Fail toward the capable path.
 */
export function parseClassification(responseText: string): Complexity {
  return /^\s*SIMPLE\b/i.test(responseText) ? "simple" : "complex";
}
