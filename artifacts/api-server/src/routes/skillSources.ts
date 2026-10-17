import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, settingsTable, skillSetsTable } from "@workspace/db";
import { listGithubSkills, previewGithubSkill } from "../lib/githubSkills.js";
import { parseGithubUrl } from "../lib/skillMd.js";
import { createSkillSetRecord } from "./skillSets.js";

/**
 * Get skills (docs/build-review.md, Build 16): browse followed GitHub
 * sources or paste any GitHub link, preview, and install through the same
 * hard gate as every outside skill. Restricted-licence skills can't be
 * installed. Sources are kept in the settings table.
 */
const router = Router();

const SOURCES_KEY = "skill_sources";
// No third-party source by default (docs/legal-compliance.md, rule 1): users
// and organisations add the collections they choose to follow.
const DEFAULT_SOURCES: { url: string; label: string }[] = [];

type Source = { url: string; label: string };

async function readSources(): Promise<Source[]> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, SOURCES_KEY)).limit(1);
  if (!row) return DEFAULT_SOURCES;
  try { return JSON.parse(row.value) as Source[]; } catch { return DEFAULT_SOURCES; }
}

async function writeSources(sources: Source[]): Promise<void> {
  await db.insert(settingsTable).values({ key: SOURCES_KEY, value: JSON.stringify(sources) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(sources), updatedAt: new Date() } });
}

const fail = (res: import("express").Response, err: unknown) =>
  res.status(400).json({ error: err instanceof Error ? err.message : "Something went wrong" });

router.get("/", async (_req, res) => {
  res.json(await readSources());
});

router.post("/", async (req, res) => {
  const { url, label } = req.body as { url?: string; label?: string };
  const loc = url ? parseGithubUrl(url) : null;
  if (!url || !loc) return res.status(400).json({ error: "Add a GitHub link, e.g. https://github.com/someone/skills" });
  const sources = await readSources();
  const clean = url.trim().replace(/\/$/, "");
  if (!sources.some(s => s.url === clean)) sources.push({ url: clean, label: label?.trim() || `${loc.owner}/${loc.repo}${loc.path ? `/${loc.path}` : ""}` });
  await writeSources(sources);
  return res.json(sources);
});

router.delete("/", async (req, res) => {
  const url = String(req.query.url ?? "");
  const sources = (await readSources()).filter(s => s.url !== url);
  await writeSources(sources);
  res.json(sources);
});

/** Skills under a link, each marked installed / update available. */
router.get("/browse", async (req, res) => {
  try {
    const skills = await listGithubSkills(String(req.query.url ?? ""));
    const rows = skills.length
      ? await db.select().from(skillSetsTable).where(inArray(skillSetsTable.sourceUrl, skills.map(s => s.url)))
      : [];
    res.json(skills.map(s => {
      const row = rows.find(r => r.sourceUrl === s.url && r.status !== "uninstalled");
      return { ...s, installedStatus: row?.status ?? null, updateAvailable: !!row && !!row.sourceUpdatedAt && row.sourceUpdatedAt !== s.version };
    }));
  } catch (err) {
    fail(res, err);
  }
});

router.get("/preview", async (req, res) => {
  try {
    res.json(await previewGithubSkill(String(req.query.url ?? "")));
  } catch (err) {
    fail(res, err);
  }
});

/** Install from GitHub - always goes through the hard gate (outside source). */
router.post("/install", async (req, res) => {
  const { url } = req.body as { url?: string };
  try {
    const p = await previewGithubSkill(url ?? "");
    if (p.licence.kind === "restricted") {
      return res.status(403).json({ error: `"${p.name}" has a restricted licence (${p.licence.label}), so Khameleon can't install it.` });
    }
    const result = await createSkillSetRecord({
      name: p.name,
      description: p.description,
      content: p.content,
      sourceType: "github",
      sourceUrl: p.url,
      sourceAuthor: p.author,
      sourceUpdatedAt: p.version,
    });
    return res.status(201).json({ ...result, licence: p.licence, programs: p.programs });
  } catch (err) {
    return fail(res, err);
  }
});

export default router;
