/**
 * The guided "make your own skill" helper (docs/build-review.md, Build 3
 * follow-up). Two server-side helpers:
 * - draftSkillSteps: asks the user's first available AI - Khami first,
 *   then Copilot, then others - to turn a plain description of a task into
 *   numbered steps, following Khameleon's own Skill writer skill.
 * - testSkillMatch: tells the user whether a typical request would pick
 *   their skill (lib/skillPicker.ts), and which words to add if not. Pure.
 */
import { pickSkill, words } from "./skillPicker.js";
import type { InstalledSkill } from "./installedSkills.js";

export interface MatchResult {
  /** Name of the skill Khameleon would use for this request, or null. */
  picked: string | null;
  isThisSkill: boolean;
  /** Words from the request the description could include to be picked. */
  suggestWords: string[];
}

export function testSkillMatch(draft: { name: string; description: string }, request: string, installed: InstalledSkill[]): MatchResult {
  const others = installed.filter(s => s.name.trim().toLowerCase() !== draft.name.trim().toLowerCase());
  const pick = pickSkill(request, [...others, { name: draft.name, description: draft.description, content: "" }]);
  const isThis = pick?.skill.name === draft.name;
  const have = new Set([...words(draft.name), ...words(draft.description)]);
  // Original wording of request words the skill doesn't mention yet.
  const original = request.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const suggestWords = isThis ? [] : [...new Set(original.filter(w => {
    const stem = words(w)[0];
    return stem && !have.has(stem);
  }))].slice(0, 6);
  return { picked: pick?.skill.name ?? null, isThisSkill: isThis, suggestWords };
}

export function draftStepsPrompt(skillWriterSteps: string, draft: { name: string; description: string; task: string; result?: string }): string {
  return [
    "Follow these guidelines for writing a Khameleon skill:",
    "---", skillWriterSteps.trim(), "---",
    `Skill name: ${draft.name || "(not named yet)"}`,
    `What it's for: ${draft.description || "(not described yet)"}`,
    `The task, in the user's words: ${draft.task}`,
    draft.result ? `What the result should look like: ${draft.result}` : "",
    "Write ONLY the numbered steps for this skill (5 to 10 steps), plain language, imperative. No title, no introduction, no closing remarks.",
  ].filter(Boolean).join("\n");
}

/** Keeps just the numbered steps from an AI reply. Pure. */
export function extractSteps(reply: string): string {
  const lines = reply.split(/\r?\n/).map(l => l.trim()).filter(l => /^\d+[.)]\s+\S/.test(l));
  return (lines.length ? lines : reply.split(/\r?\n/).filter(l => l.trim())).join("\n").trim();
}

// ── From a Capture recording (docs/build-review.md, Build 4) ───────────────

export interface CapturedAction { type: string; app?: string; role?: string; label?: string; text?: string; key?: string }
export interface CapturedStep { app: string; title: string; text?: string; note?: string; actions?: CapturedAction[] }

/** One recorded click/typing step in plain words. Pure. */
export function describeAction(a: CapturedAction): string {
  const what = a.label ? `"${a.label}"` : "an unnamed item";
  if (a.type === "click") return `clicked ${what}${a.role ? ` (${a.role.replace(/^AX/, "").toLowerCase()})` : ""}`;
  if (a.type === "type") return (a as { withheld?: string }).withheld ? `typed confidential details into ${what} (not kept)` : `typed "${(a.text ?? "").slice(0, 120)}" into ${what}`;
  if (a.type === "key") return `pressed ${a.key}`;
  if (a.type === "secure") return "entered a password (not recorded - a saved login is used instead)";
  return a.type;
}

/** The recording, in words an AI can turn into a skill. Pure. */
export function capturePrompt(skillWriterSteps: string, steps: CapturedStep[]): string {
  const lines = steps.map((s, i) => {
    const where = [s.app, s.title].filter(Boolean).join(" - ") || "(no window)";
    return [
      `${i + 1}. In ${where}`,
      s.note ? `   The user noted: ${s.note}` : "",
      s.actions?.length ? `   What they did: ${s.actions.slice(0, 25).map(describeAction).join("; ")}` : "",
      s.text ? `   Visible on screen: ${s.text.slice(0, 600)}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n");
  return [
    "Follow these guidelines for writing a Khameleon skill:",
    "---", skillWriterSteps.trim(), "---",
    "The user just recorded themselves doing a task. Here is what happened, in order (apps and windows they used, their notes, and text seen on screen):",
    lines,
    "Turn this into a reusable skill. Reply in exactly this format and nothing else:",
    "NAME: <a short, plain name>",
    "DESCRIPTION: <one or two sentences: what it does and when to use it, using words people would say>",
    "STEPS:",
    "1. <step>",
    "2. <step>",
    "Use 4 to 10 steps. Describe what to do and why, not mouse movements. If something wasn't clear from the recording, write the step anyway and add \"(check this)\".",
  ].join("\n");
}

/** Build 5 addendum: a skill from a company document section, in the same reply format. Pure. */
export function documentSkillPrompt(skillWriterSteps: string, documentName: string, section: { id: string; heading: string; text: string }): string {
  return [
    "Follow these guidelines for writing a Khameleon skill:",
    "---", skillWriterSteps.trim(), "---",
    `Turn this company procedure into a skill. Keep every step the procedure requires, in the same order, with its limits, amounts and approvals exactly as written - don't add steps it doesn't have.`,
    `Procedure: ${section.id !== "all" ? `${section.id} ` : ""}${section.heading} (from "${documentName}")`,
    section.text.slice(0, 6000),
    "Reply in exactly this format and nothing else:",
    "NAME: <a short, plain name>",
    "DESCRIPTION: <one or two sentences: what it does and when to use it, using words people would say>",
    "STEPS:",
    "1. <step>",
    "2. <step>",
    "If something in the procedure is unclear, write the step anyway and add \"(check this)\".",
  ].join("\n");
}

/** Reads NAME / DESCRIPTION / STEPS from the AI's reply, tolerating small slips. Pure. */
export function parseCaptureDraft(reply: string): { name: string; description: string; steps: string } {
  const name = reply.match(/^\s*\**NAME\**\s*:\s*(.+)$/im)?.[1].trim() ?? "";
  const description = reply.match(/^\s*\**DESCRIPTION\**\s*:\s*(.+)$/im)?.[1].trim() ?? "";
  const after = reply.split(/^\s*\**STEPS\**\s*:?\s*$/im)[1] ?? reply;
  const clean = (v: string) => v.replace(/^[*_"'\s]+|[*_"'\s]+$/g, "");
  return { name: clean(name), description: clean(description), steps: extractSteps(after) };
}
