/**
 * Pure scope-decision logic for design-spec.md §15 Skill Sets, split out
 * from routes/skillSets.ts so it can be unit-tested without a live
 * Postgres connection (this sandbox has none - see decisions log).
 */

export interface SkillSetScopeInput {
  sourceType: string; // 'authored' | 'github' | 'url' | 'marketplace'
  requestedTools: string[];
  requestedIntegrationIds: string[];
}

/**
 * §15.3: an instructions-only Skill Set with no new tool/data access
 * requested skips the hard gate and installs immediately. §15.5: ANY
 * externally-sourced Skill Set is always a hard gate, regardless of
 * what its own manifest claims to request - content from an untrusted
 * source can't be verified against its stated scope, so it's treated
 * as elevated-risk independent of the reversibility test that governs
 * everything else.
 */
export function requiresHardGate(input: SkillSetScopeInput): boolean {
  if (input.sourceType !== "authored") return true;
  return input.requestedTools.length > 0 || input.requestedIntegrationIds.length > 0;
}

export interface ScopeDelta {
  addedTools: string[];
  addedIntegrationIds: string[];
  isEmpty: boolean;
}

/**
 * §15.4: a Skill Set update only re-triggers a hard gate on the scope
 * delta - not a full re-approval of the whole Skill Set. Only additions
 * count as an expansion of scope; a removal never requires a gate.
 */
export function diffScope(
  current: { requestedTools: string[]; requestedIntegrationIds: string[] },
  next: { requestedTools: string[]; requestedIntegrationIds: string[] },
): ScopeDelta {
  const addedTools = next.requestedTools.filter((t) => !current.requestedTools.includes(t));
  const addedIntegrationIds = next.requestedIntegrationIds.filter(
    (i) => !current.requestedIntegrationIds.includes(i),
  );
  return { addedTools, addedIntegrationIds, isEmpty: addedTools.length === 0 && addedIntegrationIds.length === 0 };
}
