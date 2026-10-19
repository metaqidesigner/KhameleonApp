/**
 * Build 5 - procedure documents and the step-by-step check
 * (docs/build-review.md: "Step-by-step check with quoted evidence").
 *
 * Plain code, so every result can be traced: split a document into
 * sections, pick the section that fits a skill, line up each skill step
 * with a procedure step, and flag missing / extra / out-of-order steps -
 * each flag quoting the procedure text it relies on. Only "does this step
 * contradict the procedure?" needs judgment; that goes to Khami
 * (routes/procedures.ts) and is labelled less certain.
 */
import { words } from "./skillPicker.js";

export interface Section { id: string; heading: string; text: string }

// ── Splitting a document into sections ──────────────────────────────────────

const SMALL = new Set(["a", "an", "and", "the", "of", "for", "to", "in", "on", "at", "by", "or", "with", "from"]);

function looksLikeHeading(line: string, prevBlank: boolean): { id?: string; heading: string } | null {
  const t = line.trim();
  if (!t || t.length > 90) return null;
  const md = t.match(/^#{1,4}\s+(.+)$/);
  if (md) return { heading: md[1].trim() };
  const deep = t.match(/^(\d+(?:\.\d+)+)\.?\s+(\S.{1,80})$/); // 3.2 Supplier statements
  if (deep && !/[.;:,]$/.test(deep[2])) return { id: deep[1], heading: deep[2].trim() };
  const sec = t.match(/^(?:section|part|chapter)\s+(\d+[a-z]?)[:.\s-]+(.{2,80})$/i);
  if (sec) return { id: sec[1], heading: sec[2].trim() };
  const top = t.match(/^(\d+)\s+([A-Z].{1,70})$/); // "3 Supplier statements" (no dot after the number)
  if (top && !/[.;:,]$/.test(top[2])) return { id: top[1], heading: top[2].trim() };
  const ws = t.split(/\s+/);
  // ALL-CAPS lines are headings even without a blank line before (PDF text often has none).
  if (ws.length <= 6 && t === t.toUpperCase() && /[A-Z]{3}/.test(t) && !/[.;:,?!]$/.test(t) && !/^\d/.test(t)) return { heading: t };
  if (!prevBlank || /[.;:,?!]$/.test(t) || /^\d/.test(t)) return null;
  if (ws.length > 8) return null;
  const caps = ws.filter(w => !SMALL.has(w.toLowerCase()));
  if (caps.length && caps.every(w => /^[A-Z0-9]/.test(w)) && /^[A-Z]/.test(t)) return { heading: t };
  return null;
}

/** Sections by heading; a document with no headings is one section. Pure. */
export function splitSections(text: string): Section[] {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const out: Section[] = [];
  let current: { id?: string; heading: string; body: string[] } | null = null;
  let prevBlank = true;
  let anyHeading = false;
  for (const line of lines) {
    const h = looksLikeHeading(line, prevBlank);
    if (h) {
      anyHeading = true;
      if (current) out.push(finish(current, out.length));
      current = { ...h, body: [] };
    } else {
      (current ??= { heading: "", body: [] }).body.push(line);
    }
    prevBlank = !line.trim();
  }
  if (current) out.push(finish(current, out.length));
  const real = out.filter(s => s.text.trim().length > 0);
  if (!anyHeading || real.length === 0) return [{ id: "all", heading: "Whole document", text: (text || "").trim() }];
  return real;
}

function finish(c: { id?: string; heading: string; body: string[] }, i: number): Section {
  return { id: c.id ?? `s${i + 1}`, heading: c.heading || "Introduction", text: c.body.join("\n").trim() };
}

// ── Steps ───────────────────────────────────────────────────────────────────

const ITEM = /^\s*(?:\(?\d+[.)]|\(?[a-z][.)]|[-•*–])\s+/;

/** A procedure section's steps: its numbered/bulleted items, or else its sentences. Pure. */
export function procedureSteps(sectionText: string): string[] {
  const lines = (sectionText || "").split("\n");
  const items: string[] = [];
  let cur: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (ITEM.test(raw)) { if (cur) items.push(cur); cur = line.replace(ITEM, "").trim(); }
    else if (cur !== null && line) cur += ` ${line}`;
    else if (cur !== null && !line) { items.push(cur); cur = null; }
  }
  if (cur) items.push(cur);
  if (items.length >= 2) return items;
  return (sectionText || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(s => s.length > 15);
}

/** A skill's numbered steps (from its saved content). Pure. */
export function skillSteps(content: string): string[] {
  return (content || "").split("\n").map(l => l.trim()).filter(l => /^\d+[.)]\s+\S/.test(l)).map(l => l.replace(/^\d+[.)]\s+/, ""));
}

// ── Matching ────────────────────────────────────────────────────────────────

/** How alike two pieces of text are, by the words they share (0..1). Pure. */
export function similarity(a: string, b: string): number {
  const A = new Set(words(a)), B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.sqrt(A.size * B.size);
}

const MATCH = 0.3;

/** The section that best fits a skill (by name, description and steps), or null. Pure. */
export function pickSection<T extends { sections: Section[] }>(skill: { name: string; description: string; content: string }, docs: T[]): { doc: T; section: Section; score: number } | null {
  const about = `${skill.name} ${skill.name} ${skill.description} ${skillSteps(skill.content).join(" ")}`;
  let best: { doc: T; section: Section; score: number } | null = null;
  for (const doc of docs) for (const section of doc.sections) {
    const score = similarity(about, `${section.heading} ${section.heading} ${section.text}`);
    if (!best || score > best.score) best = { doc, section, score };
  }
  return best && best.score >= 0.12 ? best : null;
}

export type FlagKind = "missing" | "extra" | "order" | "contradicts";
export interface StepResult {
  n: number;
  text: string;
  match?: { procStep: number; quote: string };
  flags: { kind: FlagKind; note: string; quote?: string; lessCertain?: boolean }[];
}
export interface Comparison {
  status: "matches" | "differs";
  firstDifference: number | null;
  steps: StepResult[];
  /** Procedure steps the skill leaves out, and where they'd go. */
  missing: { procStep: number; quote: string; afterStep: number }[];
  procedure: string[];
}

/** Lines up skill steps with procedure steps and flags the differences. Pure. */
export function compareSteps(skill: string[], procedure: string[]): Comparison {
  const pairs: { i: number; j: number; s: number }[] = [];
  skill.forEach((a, i) => procedure.forEach((b, j) => { const s = similarity(a, b); if (s >= MATCH) pairs.push({ i, j, s }); }));
  pairs.sort((x, y) => y.s - x.s);
  const toProc = new Map<number, number>(), usedProc = new Set<number>();
  for (const p of pairs) if (!toProc.has(p.i) && !usedProc.has(p.j)) { toProc.set(p.i, p.j); usedProc.add(p.j); }

  const steps: StepResult[] = skill.map((text, i) => {
    const j = toProc.get(i);
    return { n: i + 1, text, match: j === undefined ? undefined : { procStep: j + 1, quote: procedure[j] }, flags: [] };
  });
  let highest = -1;
  for (const st of steps) {
    if (!st.match) { st.flags.push({ kind: "extra", note: "The procedure doesn't include this step." }); continue; }
    const j = st.match.procStep - 1;
    if (j < highest) st.flags.push({ kind: "order", note: `The procedure does this earlier - as its step ${j + 1}.`, quote: procedure[j] });
    highest = Math.max(highest, j);
  }
  const missing = procedure
    .map((quote, j) => ({ quote, j }))
    .filter(x => !usedProc.has(x.j))
    .map(({ quote, j }) => {
      // Goes after the last skill step matched to an earlier procedure step.
      let after = 0;
      for (const st of steps) if (st.match && st.match.procStep - 1 < j) after = st.n;
      return { procStep: j + 1, quote, afterStep: after };
    });
  return summarise(steps, missing, procedure);
}

/** Status and first differing step, after any flags are added. Pure. */
export function summarise(steps: StepResult[], missing: Comparison["missing"], procedure: string[]): Comparison {
  const flagged = steps.filter(s => s.flags.length).map(s => s.n);
  const missingAt = missing.map(m => m.afterStep + 1);
  const all = [...flagged, ...missingAt];
  return { status: all.length ? "differs" : "matches", firstDifference: all.length ? Math.min(...all) : null, steps, missing, procedure };
}

// ── Contradictions (Khami) ─────────────────────────────────────────────────

const numbersIn = (t: string) => new Set((t.match(/\d[\d,.]*/g) ?? []).map(n => n.replace(/[,.]$/, "").replace(/,/g, "")));
const NEGATION = /\b(not|never|no|without|don'?t|mustn'?t|cannot|can'?t)\b/i;
const ROLES = /\b(manager|director|head|supervisor|controller|cfo|ceo|owner|lead|partner|committee|board|approver)\b/gi;
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(x => b.has(x));

/**
 * Only pairs where something checkable differs - amounts or numbers, a
 * "not/never", or who approves - can contradict; the rest are just worded
 * differently. Keeps Khami's small brain from flagging rewordings. Pure.
 */
export function worthAsking(step: string, quote: string): boolean {
  if (!sameSet(numbersIn(step), numbersIn(quote))) return true;
  if (NEGATION.test(step) !== NEGATION.test(quote)) return true;
  const roles = (t: string) => new Set((t.match(ROLES) ?? []).map(r => r.toLowerCase()));
  return /approv|sign/i.test(`${step} ${quote}`) && !sameSet(roles(step), roles(quote));
}

/** The question Khami is asked about matched steps (only those worth asking). Pure. */
export function contradictionPrompt(steps: StepResult[]): string | null {
  const matched = steps.filter(s => s.match && worthAsking(s.text, s.match.quote));
  if (!matched.length) return null;
  return [
    "Compare each skill step with the company procedure text it was matched to.",
    "List only steps that CONTRADICT the procedure (a different amount, limit, person, order of approval, or something the procedure forbids) - not steps that are just worded differently or less detailed.",
    "Answer one per line as: STEP <number>: <short reason>. If none contradict, answer: NONE",
    "",
    ...matched.map(s => `STEP ${s.n}: ${s.text}\nPROCEDURE: ${s.match!.quote}`),
  ].join("\n");
}

/** Reads Khami's answer into step numbers and reasons. Pure. */
export function parseContradictions(reply: string, validSteps: number[]): { n: number; reason: string }[] {
  const out: { n: number; reason: string }[] = [];
  for (const line of (reply || "").split("\n")) {
    const m = line.replace(/\*\*/g, "").match(/^\s*(?:[-*]\s*)?STEP\s+(\d+)\s*[:.-]\s*(.+)$/i);
    if (m && validSteps.includes(Number(m[1])) && !/^(none|no contradiction|matches|consistent)/i.test(m[2].trim())) {
      out.push({ n: Number(m[1]), reason: m[2].trim().replace(/\.$/, "") });
    }
  }
  return out;
}
