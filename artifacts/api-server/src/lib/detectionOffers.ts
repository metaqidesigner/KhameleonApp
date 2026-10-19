/**
 * Automatic task detection, layers 2-3 on the server (docs/build-review.md,
 * Build 6). The desktop app reports a repeated sequence or a window the user
 * is working in; this ranks it against the user's skills and company
 * procedures and words the offer. Content is judged by Khami only (never an
 * outside AI). Offers stay rare: at most 3 a day, one per task per day.
 */
import { loadInstalledSkills } from "./installedSkills.js";
import { pickSkill } from "./skillPicker.js";
import { pickSection } from "./procedures.js";
import { listDocuments } from "./procedureService.js";
import { addSuggestion, countSince } from "./suggestions.js";
import { askAI } from "./askAI.js";

const MAX_PER_DAY = 3;
const MAX_KHAMI_CHECKS_PER_DAY = 20;
const recent = new Map<string, number>(); // task key -> when offered
let khamiChecks = { day: "", n: 0 };

const today = () => new Date().toDateString();
const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

async function underCap(): Promise<boolean> {
  const since = startOfDay();
  const n = (await countSince("detected_task", since)) + (await countSince("skill_match", since)) + (await countSince("watch_task", since));
  return n < MAX_PER_DAY;
}
function seenToday(key: string): boolean {
  const t = recent.get(key);
  return !!t && new Date(t).toDateString() === today();
}

/** Khami's answer: "TASK: Supplier statement reconciliation" or NONE. Pure. */
export function parseTaskGuess(reply: string): string | null {
  const m = (reply || "").match(/TASK:\s*([^\n.]{3,60})/i);
  if (!m || /^(none|unknown|n\/a)$/i.test(m[1].trim())) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

export async function handleOffer(body: Record<string, unknown>): Promise<{ offered: boolean; reason?: string }> {
  if (!(await underCap())) return { offered: false, reason: "today's limit" };
  const skills = await loadInstalledSkills().catch(() => []);
  const docs = await listDocuments().catch(() => []);

  if (body.kind === "repeat") {
    const steps = (Array.isArray(body.steps) ? body.steps : []) as { app: string; title: string }[];
    const text = steps.map(s => `${s.app} ${s.title}`).join(" ");
    const days = Number(body.days) || 3;
    const why = `Seen on ${days} different days in the last 2 weeks (from the private window log on this computer).`;
    const skill = pickSkill(text, skills);
    if (skill && !seenToday(`skill:${skill.skill.name}`)) {
      recent.set(`skill:${skill.skill.name}`, Date.now());
      await addSuggestion({ kind: "skill_match", title: `You keep doing what looks like your skill "${skill.skill.name}" - run it next time?`, why, body: String(body.description ?? ""), ref: { skillName: skill.skill.name, content: skill.skill.content } });
      return { offered: true };
    }
    const proc = pickSection({ name: text, description: "", content: "" }, docs);
    const label = proc ? `"${proc.section.heading}"` : "this";
    await addSuggestion({
      kind: "detected_task",
      title: proc ? `You've done what looks like ${label} on ${days} days - capture it as a skill?` : `You've done this on ${days} days - capture it as a skill?`,
      why, body: String(body.description ?? ""), ref: { patternId: body.id, procedure: proc?.section.heading ?? null },
    });
    return { offered: true };
  }

  if (body.kind === "watch") {
    const title = String(body.title ?? ""), app = String(body.app ?? ""), screen = String(body.text ?? "");
    const text = `${title}\n${screen}`;
    const why = `From the window you're working in (${app}) - read on this computer.`;
    const skill = pickSkill(text, skills);
    if (skill) {
      if (seenToday(`skill:${skill.skill.name}`)) return { offered: false, reason: "already offered today" };
      recent.set(`skill:${skill.skill.name}`, Date.now());
      await addSuggestion({ kind: "skill_match", title: `This looks like your skill "${skill.skill.name}" - use it?`, why, ref: { skillName: skill.skill.name, content: skill.skill.content } });
      return { offered: true };
    }
    const proc = pickSection({ name: title, description: screen.slice(0, 600), content: "" }, docs);
    if (proc) {
      if (seenToday(`proc:${proc.section.heading}`)) return { offered: false };
      recent.set(`proc:${proc.section.heading}`, Date.now());
      await addSuggestion({ kind: "watch_task", title: `This looks like "${proc.section.heading}" - capture it as a skill next time?`, why, ref: { procedure: proc.section.heading } });
      return { offered: true };
    }
    // Any repeatable-looking task: Khami's judgment, on this computer only, a limited number of times a day.
    if (screen.length < 80) return { offered: false, reason: "not enough on screen" };
    if (khamiChecks.day !== today()) khamiChecks = { day: today(), n: 0 };
    if (khamiChecks.n >= MAX_KHAMI_CHECKS_PER_DAY) return { offered: false, reason: "today's checks used" };
    khamiChecks.n++;
    try {
      const reply = await askAI({
        confidential: true, // screen content never leaves the computer
        prompt: [
          "Here is the text of a window someone is working in. Is it part of a routine, repeatable work task (like reconciling a statement, entering invoices, preparing a weekly report)?",
          "Answer with exactly one line: TASK: <a short name for the task> - or NONE if it's not a routine task (reading news, chatting, browsing, personal things).",
          "", `App: ${app}`, `Window: ${title}`, screen.slice(0, 2000),
        ].join("\n"),
      });
      const task = parseTaskGuess(reply.text);
      if (!task || seenToday(`task:${task.toLowerCase()}`)) return { offered: false };
      recent.set(`task:${task.toLowerCase()}`, Date.now());
      await addSuggestion({ kind: "watch_task", title: `Looks like you're doing "${task}" - capture it as a skill next time?`, why, ref: { task } });
      return { offered: true };
    } catch {
      return { offered: false, reason: "Khami isn't available" };
    }
  }
  return { offered: false, reason: "unknown kind" };
}
