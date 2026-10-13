/**
 * Which logged actions can genuinely be undone from the activity log, and
 * how (gap review Q10/Q14: one activity log, with Undo where it's real).
 * Pure so it can be tested without a database; routes/actionReceipts.ts
 * carries the plan out.
 *
 * Only two kinds are reversible after the fact today:
 *  - installing a skill  -> uninstall it
 *  - connecting an account -> disconnect it (anything already done while
 *    connected stays done - the receipt for the disconnect says so)
 * Everything else (sent emails, etc.) is honestly not undoable here.
 */
export interface ReceiptLike {
  category: string;
  target: string | null;
  canUndo: boolean;
  undone: boolean;
}

export type UndoPlan =
  | { kind: "uninstall-skill"; skillName: string }
  | { kind: "disconnect"; provider: string };

export function undoPlanFor(r: ReceiptLike): UndoPlan | null {
  if (!r.canUndo || r.undone || !r.target) return null;
  if (r.category === "skill_set_install") return { kind: "uninstall-skill", skillName: r.target };
  if (r.category === "integration_connect") return { kind: "disconnect", provider: r.target };
  return null;
}
