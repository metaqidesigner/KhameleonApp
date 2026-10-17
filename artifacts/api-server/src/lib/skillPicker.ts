/**
 * Khameleon picks the skill itself (docs/khami-design.md) - so automatic
 * skill use works with any AI, including Khami offline, not only with
 * Claude's own skill-fetching. Deliberately simple and exact: compares the
 * request's words with each installed skill's name and description. No AI
 * call, so it costs nothing and adds no delay.
 */
import type { InstalledSkill } from "./installedSkills.js";

const STOP = new Set(("a an and are as at be but by can could do does for from get give go have help how i if in into is it its just "
  + "let me my need of on or our please so some that the their them then there these they this those to up us want was we what when "
  + "which who will with would you your yours tell show make about any all also out over than too very via "
  // Filler common in published skill descriptions - shouldn't count as a match.
  + "claude skill skills use used using uses should whenever etc kind kinds sort set resources asked like likes "
  // Time and ordering words say nothing about which skill fits.
  + "week weeks weekly day days daily month monthly year today tomorrow yesterday new first next last").split(" "));

/** Words that point at a skill but appear in the user's request in another form. */
const SYNONYMS: Record<string, string> = {
  preparation: "prep", prepare: "prep", briefing: "brief", minutes: "minute", notes: "note",
  compare: "compar", comparing: "compar", compares: "compar", comparison: "compar",
  reconcile: "reconcil", reconciling: "reconcil", reconciliation: "reconcil",
  matches: "match", matching: "match", mismatch: "match",
  invoices: "invoice", expenses: "expense", receipts: "receipt", lists: "list",
  onboard: "onboard", onboarding: "onboard", kickoff: "kickoff", "kick-off": "kickoff",
  summarise: "summar", summarize: "summar", summary: "summar", summarising: "summar",
};

/** Same word, different endings: "update"/"updates", "invoice"/"invoices" -> one stem. */
function stem(w: string): string {
  return w.replace(/(ings?|ed|es|s)$/, "").replace(/e$/, "");
}

export function words(text: string): string[] {
  // Hyphens split words too, so "internal-comms" matches "internal comms".
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter(w => w.length > 1 && !STOP.has(w))
    .map(w => stem(SYNONYMS[w] ?? w))
    .filter(w => w.length > 1);
}

export interface SkillPick {
  skill: InstalledSkill;
  score: number;
}

/**
 * Best-matching installed skill for a request, or null when nothing fits
 * well. Name words count three times as much as description words; a skill
 * needs a name match plus some support, or two distinctive description
 * words in common - so unrelated questions use no skill.
 */
export function pickSkill(request: string, skills: InstalledSkill[]): SkillPick | null {
  const req = new Set(words(request));
  if (req.size === 0) return null;

  // Distinctive words count for more: a word found in only one skill
  // ("3p", "invoice") beats one shared by many ("update", "report").
  const vocab = skills.map(s => ({ name: new Set(words(s.name)), desc: new Set(words(s.description)) }));
  const df = new Map<string, number>();
  for (const v of vocab) for (const w of new Set([...v.name, ...v.desc])) df.set(w, (df.get(w) ?? 0) + 1);
  const weight = (w: string) => Math.log(1 + skills.length / (df.get(w) ?? 1));

  let best: SkillPick | null = null;
  skills.forEach((skill, i) => {
    const nameHits = [...vocab[i].name].filter(w => req.has(w));
    const descHits = [...vocab[i].desc].filter(w => req.has(w) && !vocab[i].name.has(w));
    const qualifies = (nameHits.length >= 1 && nameHits.length * 3 + descHits.length >= 4) || nameHits.length >= 2 || descHits.length >= 2;
    if (!qualifies) return;
    const score = nameHits.reduce((n, w) => n + 3 * weight(w), 0) + descHits.reduce((n, w) => n + weight(w), 0);
    if (!best || score > best.score) best = { skill, score };
  });
  return best;
}

/** The system-prompt addition handing the chosen skill's steps to the AI. */
export function skillInstructions(skill: InstalledSkill): string {
  // Small offline brains copy sign-offs onto everything; say it right next to the steps.
  return `\n\nFor this request, follow the user's saved skill "${skill.name}":\n---\n${skill.content.trim()}\n---\n`
    + `Finish when the steps are done. Do not add a sign-off, a signature or "[Your name]" unless the steps ask you to draft an email or letter.`;
}
