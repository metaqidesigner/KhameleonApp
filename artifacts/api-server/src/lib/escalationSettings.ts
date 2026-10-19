import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import type { EscalationMode } from "./escalation.js";

/** Settings > AI > "When a task is tricky": ask first (default), hand over automatically, or never. */
const KEY = "escalation_mode";

export async function getEscalationMode(): Promise<EscalationMode> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, KEY)).limit(1).catch(() => [] as never[]);
  return row?.value === "auto" || row?.value === "never" ? row.value : "ask";
}

export async function setEscalationMode(mode: EscalationMode): Promise<void> {
  await db.insert(settingsTable).values({ key: KEY, value: mode })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: mode, updatedAt: new Date() } });
}
