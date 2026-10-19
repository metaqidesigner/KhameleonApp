/**
 * Which skill the current answer is following (Build 7) - so a saved-login
 * request knows the skill it's for ("Always for this skill"). Same pattern
 * as lib/requestContext.ts.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface CurrentSkill { id?: number; name: string; loginVaultItemId?: number | null }
const als = new AsyncLocalStorage<CurrentSkill | null>();

export function runWithSkill<T>(skill: CurrentSkill | null, fn: () => Promise<T>): Promise<T> {
  return als.run(skill, fn);
}

export function currentSkill(): CurrentSkill | null {
  return als.getStore() ?? null;
}
