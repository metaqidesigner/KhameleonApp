import { Router, type Response } from "express";
import { STARTER_SKILLS } from "../starterSkills.js";
import { readDocumentText } from "../lib/documentText.js";
import { pickSection } from "../lib/procedures.js";
import { listDocuments, getDocument, addDocument, updateDocument, deleteDocument, checkSkill, listChecks, draftFromSection } from "../lib/procedureService.js";

/**
 * Build 5: company procedure documents in each work area, the step-by-step
 * check of skills against them, and skills drafted from a document.
 * Documents are read on this computer; Khami does the AI parts.
 */
const router = Router();
const MAX_BYTES = 20 * 1024 * 1024;

function fail(res: Response, err: unknown, log: (o: object, m: string) => void) {
  const status = (err as { status?: number }).status;
  if (!status) log({ err }, "procedures route failed");
  res.status(status ?? 500).json({ error: status ? (err as Error).message : "Something went wrong" });
}

const summary = (d: Awaited<ReturnType<typeof getDocument>>) => d && ({
  id: d.id, workDomainId: d.workDomainId, name: d.name, fileName: d.fileName, confidential: d.confidential,
  sections: d.sections.map(s => ({ id: s.id, heading: s.heading })), characters: d.text.length, updatedAt: d.updatedAt,
});

router.get("/documents", async (req, res) => {
  const domain = req.query.workDomainId ? Number(req.query.workDomainId) : undefined;
  res.json((await listDocuments(domain)).map(summary));
});

router.get("/documents/:id", async (req, res) => {
  const d = await getDocument(Number(req.params.id));
  if (!d) { res.status(404).json({ error: "Document not found" }); return; }
  res.json({ ...summary(d), sections: d.sections });
});

/** Adds a document (base64 file) to a work area - or, with replaceId, uploads a new version. */
router.post("/documents", async (req, res) => {
  const { workDomainId, fileName, dataBase64, name, confidential, replaceId } = req.body as { workDomainId?: number; fileName?: string; dataBase64?: string; name?: string; confidential?: boolean; replaceId?: number };
  if (!fileName || !dataBase64 || (!workDomainId && !replaceId)) { res.status(400).json({ error: "Choose a work area and a file." }); return; }
  const data = Buffer.from(dataBase64, "base64");
  if (data.length > MAX_BYTES) { res.status(413).json({ error: "That file is too big - the limit is 20 MB." }); return; }
  try {
    const { text, how } = await readDocumentText(fileName, data);
    if (text.trim().length < 20) { res.status(422).json({ error: "Khameleon couldn't find any text in that file." }); return; }
    const doc = replaceId
      ? await updateDocument(replaceId, { text, fileName })
      : await addDocument({ workDomainId: workDomainId!, name: (name || fileName.replace(/\.[^.]+$/, "")).trim(), fileName, text, confidential: !!confidential });
    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
    res.status(replaceId ? 200 : 201).json({ ...summary(doc), readBy: how });
  } catch (err) { fail(res, err, req.log.error.bind(req.log)); }
});

router.patch("/documents/:id", async (req, res) => {
  const { name, confidential, workDomainId } = req.body as { name?: string; confidential?: boolean; workDomainId?: number };
  const d = await updateDocument(Number(req.params.id), { name, confidential, workDomainId });
  if (!d) { res.status(404).json({ error: "Document not found" }); return; }
  res.json(summary(d));
});

router.delete("/documents/:id", async (req, res) => {
  await deleteDocument(Number(req.params.id));
  res.json({ deleted: true });
});

router.get("/checks", async (_req, res) => {
  res.json(await listChecks());
});

/** "Re-check" - the full check, including Khami's contradiction check. */
router.post("/check/:skillId", async (req, res) => {
  try { res.json(await checkSkill(Number(req.params.skillId), { deep: true })); }
  catch (err) { fail(res, err, req.log.error.bind(req.log)); }
});

/** "From a company document": a skill draft for the guide, each step noting its source. */
router.post("/draft-skill", async (req, res) => {
  const { documentId, sectionId } = req.body as { documentId?: number; sectionId?: string };
  if (!documentId || !sectionId) { res.status(400).json({ error: "Choose a document and a section." }); return; }
  try {
    const writer = STARTER_SKILLS.find(s => s.name === "Skill writer");
    res.json(await draftFromSection(documentId, sectionId, writer?.content ?? ""));
  } catch (err) { fail(res, err, req.log.error.bind(req.log)); }
});

/** Which work area a new skill belongs in: the one whose procedures fit it best (plain code). */
router.post("/suggest-domain", async (req, res) => {
  const { name, description, steps } = req.body as { name?: string; description?: string; steps?: string };
  const pick = pickSection({ name: name ?? "", description: description ?? "", content: steps ?? "" }, await listDocuments());
  res.json(pick ? { workDomainId: pick.doc.workDomainId, reason: `It matches "${pick.section.heading}" in ${pick.doc.name}.` } : { workDomainId: null, reason: null });
});

export default router;
