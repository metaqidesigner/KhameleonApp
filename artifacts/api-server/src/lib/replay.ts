/**
 * Replaying a captured skill (Capture full recording): runs its recorded
 * clicks and typing again in order, through the desktop app, which finds
 * each step's element by name. Stops at the first step it can't do - it
 * never guesses. A password step uses the skill's saved login (asking
 * first); passwords are never part of a recording.
 */
import { eq } from "drizzle-orm";
import { db, skillSetsTable, vaultItemsTable, actionReceiptsTable } from "@workspace/db";
import { callDesktop } from "./desktopLink.js";
import { signInWithSavedLogin } from "./savedLogins.js";
import { describeAction, type CapturedAction } from "./skillGuide.js";

export interface ReplayReport { ok: boolean; done: number; total: number; steps: { n: number; what: string; ok: boolean; message: string }[] }

export async function replaySkill(skillId: number): Promise<ReplayReport> {
  const [skill] = await db.select().from(skillSetsTable).where(eq(skillSetsTable.id, skillId)).limit(1);
  if (!skill) throw Object.assign(new Error("Skill not found"), { status: 404 });
  const steps = (Array.isArray(skill.recording) ? skill.recording : []) as (CapturedAction & { window?: string })[];
  if (!steps.length) throw Object.assign(new Error("This skill has no recording to replay - capture the task first."), { status: 400 });

  let loginName = "";
  if (skill.loginVaultItemId) {
    const [v] = await db.select({ name: vaultItemsTable.name }).from(vaultItemsTable).where(eq(vaultItemsTable.id, skill.loginVaultItemId)).limit(1);
    loginName = v?.name ?? "";
  }

  const report: ReplayReport = { ok: true, done: 0, total: steps.length, steps: [] };
  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const what = `${describeAction(step)}${step.app ? ` in ${step.app}` : ""}`;
      let result: string;
      if (step.type === "type" && (step as { withheld?: string }).withheld) {
        result = `FAILED - this step's typing wasn't kept because it looked confidential. Type it into "${step.label ?? "the box"}" yourself, then replay the rest.`;
      } else if (step.type === "secure") {
        result = loginName
          ? await signInWithSavedLogin(loginName, step.app, { id: skill.id, name: skill.name, loginVaultItemId: skill.loginVaultItemId })
          : `FAILED - this step needs a password. Link a saved login to the skill ("Signs in with") and replay again.`;
      } else {
        result = await callDesktop("replay_step", { step }, 60_000).catch(e => `FAILED - ${e instanceof Error ? e.message : "the desktop app couldn't do it."}`);
      }
      const ok = !/^FAILED/i.test(result);
      report.steps.push({ n: i + 1, what, ok, message: result.replace(/^(DONE|FAILED)\s*-\s*/i, "") });
      if (!ok) { report.ok = false; break; }
      report.done++;
    }
  } finally {
    await callDesktop("replay_done", {}, 5_000).catch(() => undefined);
  }
  await db.insert(actionReceiptsTable).values({
    description: report.ok ? `Replayed "${skill.name}" (${report.done} steps)` : `Replay of "${skill.name}" stopped at step ${report.done + 1} of ${report.total}`,
    category: "skill_replay", scope: "local", outcome: report.ok ? "success" : "failure", target: skill.name, canUndo: false,
  }).catch(() => undefined);
  return report;
}
