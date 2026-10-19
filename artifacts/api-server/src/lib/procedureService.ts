/**
 * Build 5 - procedure documents and checks: storage and the AI parts.
 * The comparison itself is plain code (lib/procedures.ts); Khami (on this
 * computer) only judges contradictions and drafts skills from documents.
 */
import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, procedureDocumentsTable, procedureChecksTable, skillSetsTable, entityWorkDomainsTable, type ProcedureDocument } from "@workspace/db";
import { splitSections, procedureSteps, skillSteps, pickSection, compareSteps, summarise, contradictionPrompt, parseContradictions, similarity, type Section, type Comparison } from "./procedures.js";
import { askAI } from "./askAI.js";
import { documentSkillPrompt, parseCaptureDraft } from "./skillGuide.js";
import { logger } from "./logger.js";

export async function listDocuments(workDomainId?: number): Promise<ProcedureDocument[]> {
  const q = db.select().from(procedureDocumentsTable);
  return workDomainId ? q.where(eq(procedureDocumentsTable.workDomainId, workDomainId)) : q;
}

export async function getDocument(id: number): Promise<ProcedureDocument | undefined> {
  const [d] = await db.select().from(procedureDocumentsTable).where(eq(procedureDocumentsTable.id, id)).limit(1);
  return d;
}

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function addDocument(input: { workDomainId: number; name: string; fileName: string; text: string; confidential: boolean }): Promise<ProcedureDocument> {
  const [d] = await db.insert(procedureDocumentsTable).values({
    workDomainId: input.workDomainId, name: input.name, fileName: input.fileName, text: input.text,
    sections: splitSections(input.text), confidential: input.confidential, contentHash: hash(input.text),
  }).returning();
  queueRecheckAll();
  return d;
}

/** Replaces a document's text (a new version) or changes its details. A new version re-checks its skills. */
export async function updateDocument(id: number, patch: { name?: string; confidential?: boolean; workDomainId?: number; text?: string; fileName?: string }): Promise<ProcedureDocument | undefined> {
  const current = await getDocument(id);
  if (!current) return undefined;
  const changedText = patch.text !== undefined && hash(patch.text) !== current.contentHash;
  const [d] = await db.update(procedureDocumentsTable).set({
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.confidential !== undefined ? { confidential: patch.confidential } : {}),
    ...(patch.workDomainId !== undefined ? { workDomainId: patch.workDomainId } : {}),
    ...(changedText ? { text: patch.text!, sections: splitSections(patch.text!), contentHash: hash(patch.text!), fileName: patch.fileName ?? current.fileName } : {}),
    updatedAt: new Date(),
  }).where(eq(procedureDocumentsTable.id, id)).returning();
  if (changedText) {
    // Quietly flag the skills it affects, then re-check them.
    await db.update(procedureChecksTable).set({ needsReview: true }).where(eq(procedureChecksTable.documentId, id));
    queueRecheckAll();
  }
  return d;
}

export async function deleteDocument(id: number): Promise<void> {
  await db.delete(procedureDocumentsTable).where(eq(procedureDocumentsTable.id, id));
  await db.update(skillSetsTable).set({ sourceDocumentId: null, sourceSectionId: null }).where(eq(skillSetsTable.sourceDocumentId, id));
  queueRecheckAll();
}

export interface CheckResult extends Comparison { documentId: number; documentName: string; sectionId: string; sectionHeading: string; lessCertain: boolean }

/** Which documents a skill is compared with: its work areas' documents (all, if it has none). */
async function documentsFor(skillId: number): Promise<ProcedureDocument[]> {
  const tags = await db.select().from(entityWorkDomainsTable)
    .where(and(eq(entityWorkDomainsTable.entityType, "skill_set"), eq(entityWorkDomainsTable.entityId, String(skillId))));
  const domainIds = tags.map(t => t.workDomainId);
  const all = await listDocuments();
  const inDomains = domainIds.length ? all.filter(d => domainIds.includes(d.workDomainId)) : all;
  return inDomains.length ? inDomains : all;
}

/** Runs the check for one skill and saves it. `deep` adds Khami's contradiction check. */
export async function checkSkill(skillId: number, opts: { deep?: boolean } = { deep: true }) {
  const [skill] = await db.select().from(skillSetsTable).where(eq(skillSetsTable.id, skillId)).limit(1);
  if (!skill) throw Object.assign(new Error("Skill not found"), { status: 404 });
  const docs = await documentsFor(skillId);

  // A skill made from a document is compared with the section it came from.
  let picked: { doc: ProcedureDocument; section: Section } | null = null;
  if (skill.sourceDocumentId && skill.sourceSectionId) {
    const doc = docs.find(d => d.id === skill.sourceDocumentId) ?? await getDocument(skill.sourceDocumentId);
    const section = doc?.sections.find(s => s.id === skill.sourceSectionId);
    if (doc && section) picked = { doc, section };
  }
  picked ??= pickSection(skill, docs);
  const steps = skillSteps(skill.content);

  if (!picked || steps.length === 0) {
    const row = { skillSetId: skillId, documentId: null, sectionId: null, status: "no_procedure", firstDifference: null, result: { reason: steps.length ? "No procedure in this skill's work area covers it." : "This skill has no numbered steps to compare." }, lessCertain: false, needsReview: false, checkedAt: new Date() };
    await db.insert(procedureChecksTable).values(row).onConflictDoUpdate({ target: procedureChecksTable.skillSetId, set: row });
    return row;
  }

  let comparison = compareSteps(steps, procedureSteps(picked.section.text));
  let lessCertain = false;
  if (opts.deep) {
    const prompt = contradictionPrompt(comparison.steps);
    if (prompt) {
      try {
        const reply = await askAI({ prompt, confidential: picked.doc.confidential });
        for (const c of parseContradictions(reply.text, comparison.steps.map(s => s.n))) {
          const st = comparison.steps.find(s => s.n === c.n)!;
          st.flags.push({ kind: "contradicts", note: c.reason, quote: st.match?.quote, lessCertain: true });
          lessCertain = true;
        }
        comparison = summarise(comparison.steps, comparison.missing, comparison.procedure);
      } catch (err) {
        logger.warn({ err, skillId }, "Contradiction check skipped");
      }
    }
  }
  const result: CheckResult = { ...comparison, documentId: picked.doc.id, documentName: picked.doc.name, sectionId: picked.section.id, sectionHeading: picked.section.heading, lessCertain };
  const row = {
    skillSetId: skillId, documentId: picked.doc.id, sectionId: picked.section.id, status: comparison.status,
    firstDifference: comparison.firstDifference, result, lessCertain, needsReview: false, checkedAt: new Date(),
  };
  await db.insert(procedureChecksTable).values(row).onConflictDoUpdate({ target: procedureChecksTable.skillSetId, set: row });
  return row;
}

// Checks run one after another in the background, so saving never waits on them.
let chain: Promise<unknown> = Promise.resolve();
export function queueCheck(skillId: number): void {
  chain = chain.then(() => checkSkill(skillId)).catch(err => logger.warn({ err, skillId }, "Background procedure check failed"));
}

function queueRecheckAll(): void {
  chain = chain.then(async () => {
    const skills = await db.select({ id: skillSetsTable.id }).from(skillSetsTable).where(inArray(skillSetsTable.status, ["installed", "pending"]));
    for (const s of skills) await checkSkill(s.id, { deep: false }).catch(() => undefined);
  }).catch(err => logger.warn({ err }, "Re-checking skills failed"));
}

export async function listChecks() {
  return db.select().from(procedureChecksTable);
}

/** Drafts a skill from a document section. Khami writes; plain code notes each step's source. */
export async function draftFromSection(documentId: number, sectionId: string, writerSteps: string) {
  const doc = await getDocument(documentId);
  const section = doc?.sections.find(s => s.id === sectionId);
  if (!doc || !section) throw Object.assign(new Error("That section couldn't be found."), { status: 404 });
  const proc = procedureSteps(section.text);
  const prompt = documentSkillPrompt(writerSteps, doc.name, section);
  const reply = await askAI({ prompt, confidential: doc.confidential });
  const draft = parseCaptureDraft(reply.text);
  const label = section.id === "all" ? doc.name : section.id;
  const lines = skillSteps(draft.steps).map((step, i) => {
    let best = { j: -1, s: 0 };
    proc.forEach((p, j) => { const s = similarity(step, p); if (s > best.s) best = { j, s }; });
    const source = best.s >= 0.3 ? ` (from ${label}, step ${best.j + 1})` : "";
    return `${i + 1}. ${step.replace(/\s*\(from [^)]*\)\s*$/i, "")}${source}`;
  });
  return { name: draft.name || section.heading, description: draft.description, steps: lines.join("\n") || draft.steps, by: reply.by, documentId, sectionId, documentName: doc.name, sectionHeading: section.heading };
}
