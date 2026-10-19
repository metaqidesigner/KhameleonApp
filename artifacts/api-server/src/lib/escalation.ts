/**
 * Khami step 5 (docs/khami-design.md, "How work flows"): when a task is
 * beyond Khami, it offers to hand it to an outside AI the user has -
 * Microsoft 365 Copilot first. Confidential work never leaves the
 * computer: it stays with Khami even if the user picks another AI.
 *
 * Pure decisions, done by plain code: is this confidential, is it tricky,
 * did Khami sound unsure. Routes: routes/escalation.ts and the chat route's
 * lock (routes/agentRoster.ts).
 */

export type EscalationMode = "ask" | "auto" | "never";

// ── Confidential ────────────────────────────────────────────────────────────

function luhnOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

const CONFIDENTIAL_CHECKS: { reason: string; test: (t: string) => boolean }[] = [
  { reason: "it's marked confidential", test: t => /\b(confidential|strictly private|private and confidential|not for distribution|under nda|commercially sensitive)\b/i.test(t) },
  { reason: "it mentions pay or salaries", test: t => /\b(salary|salaries|payroll|pay slip|payslip|bonus scheme|pay rise|remuneration)\b/i.test(t) },
  { reason: "it includes health information", test: t => /\b(medical|diagnosis|diagnosed|sick note|fit note|health condition|prescription|disability)\b/i.test(t) },
  { reason: "it's about a disciplinary or HR case", test: t => /\b(disciplinary|grievance|dismissal|redundanc(y|ies)|performance improvement plan)\b/i.test(t) },
  { reason: "it includes a password or login", test: t => /\b(password|passcode|pin code)\s*(is|:|=)/i.test(t) },
  { reason: "it includes bank details", test: t => /\bsort code\b|\b(bank|account)\b[\s\S]{0,40}\b\d{2}-\d{2}-\d{2}\b|\b(account (no|number)|acc no)\b|\biban\b/i.test(t) || /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}\b/.test(t) },
  { reason: "it includes a card number", test: t => (t.match(/\b(?:\d[ -]?){13,19}\b/g) ?? []).some(m => { const d = m.replace(/\D/g, ""); return d.length >= 13 && d.length <= 19 && luhnOk(d); }) },
  { reason: "it includes a National Insurance number", test: t => /\bnational insurance (no|number)\b|\bni number\b|\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z] ?\d{2} ?\d{2} ?\d{2} ?[A-D]\b/i.test(t) },
  { reason: "it includes passport or date-of-birth details", test: t => /\b(passport (no|number)|date of birth|d\.o\.b\.?)\b/i.test(t) },
];

/** Should this text stay on the computer? Lists why, in plain words. */
export function detectConfidential(text: string): { confidential: boolean; reasons: string[] } {
  const reasons = CONFIDENTIAL_CHECKS.filter(c => c.test(text || "")).map(c => c.reason);
  return { confidential: reasons.length > 0, reasons };
}

// ── Tricky ──────────────────────────────────────────────────────────────────

const LONG_WRITING = /\b(write|draft|prepare|create|produce)\b[\s\S]{0,60}\b(report|proposal|policy|strategy|business case|essay|article|press release|contract|tender|white ?paper|presentation|board paper|speech|newsletter)\b/i;
const HARD_REASONING = /\b(analy[sz]e|evaluate|assess|forecast|model the|pros and cons|trade-?offs|legal (advice|implications)|negotiat\w*|root cause|due diligence|risk assessment)\b/i;

/** Is this beyond what Khami's small brain does well? Code, no AI call. */
export function looksTricky(request: string): { tricky: boolean; reason?: string } {
  const t = request || "";
  const words = t.match(/\b(\d{3,5})\s*words?\b/i);
  if (words && Number(words[1]) >= 600) return { tricky: true, reason: "it's a long piece of writing" };
  if (LONG_WRITING.test(t)) return { tricky: true, reason: "it's a long piece of writing" };
  if (HARD_REASONING.test(t) && t.length > 80) return { tricky: true, reason: "it needs careful reasoning" };
  if (t.length > 1500) return { tricky: true, reason: "it's a long, detailed request" };
  return { tricky: false };
}

/** Did Khami's answer say it couldn't really do it? */
export function soundsUnsure(answer: string): boolean {
  return /\b(i'?m not (sure|certain|able)|i am not (sure|certain|able)|i don'?t know|i do not know|i (can'?t|cannot) (help|answer|do that|provide)|i don'?t have (access|enough information)|unable to (answer|help|determine))\b/i.test(answer || "");
}
