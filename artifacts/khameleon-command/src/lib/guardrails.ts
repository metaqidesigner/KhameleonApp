/**
 * Real guardrails only get an ACTIVE badge - this page used to show all
 * five as unconditionally ACTIVE regardless of what existed, which is a
 * security status page fabricating security status. All five are real as
 * of 2026-10-01 (khameleon-decisions-log.md): File Policy and a rate
 * limiter were added to agents/tools/{shell,rateLimiter}.ts guarding
 * dispatcher.ts (the one choke point every agent tool call passes
 * through), and an injection-content wrapper was added to webFetch.ts.
 * `note` is shown for the three that are real-but-bounded mitigations,
 * not absolute guarantees - so the badge doesn't overclaim either.
 */
export const GUARDRAILS: { label: string; implemented: boolean; note?: string }[] = [
  { label: 'Injection Scanner', implemented: true, note: 'Pattern-based heuristic on fetched web content, not a complete defense' },
  { label: 'Rate Limiter', implemented: true, note: '20 write/command calls, 100 read calls, per 5 min (global)' },
  { label: 'File Policy', implemented: true, note: 'Path/size restrictions on agent file read/write and shell commands' },
  { label: 'SSRF Protection', implemented: true },
  { label: 'Audit Log', implemented: true },
];
