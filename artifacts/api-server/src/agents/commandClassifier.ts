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

/**
 * The same SIMPLE/COMPLEX decision by plain code (Khami design, "code
 * first"): no extra AI call before the real work. COMPLEX only when the
 * request asks for several things in turn; a single request that needs a
 * tool ("add a task…", "summarise my emails") is SIMPLE - the one-answer
 * path can use tools too. Planning several steps for a one-step job made
 * Khami's small brain invent extra steps it never took.
 */
export function classifyByCode(command: string): Complexity {
  const c = command.toLowerCase();
  const severalSteps = /\b(and then|then|after that|afterwards|finally|step \d)\b|;|\n\s*(\d+[.)]|[-*•])\s/.test(c) || c.length > 240;
  return severalSteps ? "complex" : "simple";
}
