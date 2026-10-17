/**
 * Get skills from GitHub (docs/build-review.md, Build 16). Finds skills in
 * Anthropic's skill format anywhere under a GitHub link, reads their
 * description and licence, and fetches the full skill for install.
 *
 * Only one GitHub API call per collection (the file list, cached for ten
 * minutes - unauthenticated GitHub allows 60 an hour); file contents come
 * from raw.githubusercontent.com. GITHUB_TOKEN raises the limit if set.
 * Programs inside a skill are counted and reported, never fetched or run.
 */
import { parseGithubUrl, parseSkillMd, classifyLicence, skillFolderOf, buildSkillContent, type GithubLocation, type Licence } from "./skillMd.js";

const TEXT_EXT = /\.(md|markdown|txt)$/i;
const PROGRAM_EXT = /\.(py|js|mjs|cjs|ts|sh|bash|ps1|rb|go|rs|java|exe|bin)$/i;
const LICENCE_FILE = /^(LICEN[CS]E)(\.(txt|md))?$/i;
const MAX_TEXT_FILES = 20;
const MAX_FILE_BYTES = 60_000;

interface TreeEntry { path: string; type: "blob" | "tree"; sha: string; size?: number }

const treeCache = new Map<string, { at: number; tree: TreeEntry[]; ref: string }>();

function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "Khameleon" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: apiHeaders() });
  if (res.status === 404) throw new Error("Couldn't find that on GitHub - check the link (private collections aren't supported yet).");
  if (res.status === 403) throw new Error("GitHub is limiting requests right now - try again in a few minutes.");
  if (!res.ok) throw new Error(`GitHub returned an error (HTTP ${res.status}).`);
  return res.json() as Promise<T>;
}

async function getTree(loc: GithubLocation): Promise<{ tree: TreeEntry[]; ref: string }> {
  const ref = loc.ref ?? (await getJson<{ default_branch: string }>(`https://api.github.com/repos/${loc.owner}/${loc.repo}`)).default_branch;
  const key = `${loc.owner}/${loc.repo}@${ref}`;
  const hit = treeCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit;
  const data = await getJson<{ tree: TreeEntry[] }>(`https://api.github.com/repos/${loc.owner}/${loc.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  const entry = { at: Date.now(), tree: data.tree, ref };
  treeCache.set(key, entry);
  return entry;
}

async function raw(loc: GithubLocation, ref: string, path: string): Promise<string | null> {
  const res = await fetch(`https://raw.githubusercontent.com/${loc.owner}/${loc.repo}/${encodeURIComponent(ref)}/${path.split("/").map(encodeURIComponent).join("/")}`);
  return res.ok ? res.text() : null;
}

async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  return out;
}

export interface SkillSummary {
  /** Link to the skill's folder on GitHub - also used to preview/install it. */
  url: string;
  name: string;
  description: string;
  author: string;
  licence: Licence;
  textFiles: number;
  programs: number;
  otherFiles: number;
  /** Version marker (SKILL.md's GitHub id) - lets Khameleon notice updates. */
  version: string;
}

export interface SkillPreview extends SkillSummary {
  content: string;
  truncated: boolean;
}

function folderFiles(tree: TreeEntry[], folder: string): TreeEntry[] {
  const prefix = folder ? `${folder}/` : "";
  return tree.filter(t => t.type === "blob" && t.path.startsWith(prefix));
}

async function licenceFor(loc: GithubLocation, ref: string, tree: TreeEntry[], folder: string): Promise<Licence> {
  const own = folderFiles(tree, folder).find(f => f.path.slice(folder ? folder.length + 1 : 0).match(LICENCE_FILE));
  const rootLicence = tree.find(t => t.type === "blob" && !t.path.includes("/") && LICENCE_FILE.test(t.path));
  const file = own ?? rootLicence;
  return classifyLicence(file ? await raw(loc, ref, file.path) : null);
}

async function summarise(loc: GithubLocation, ref: string, tree: TreeEntry[], skillMdPath: string): Promise<SkillSummary | null> {
  const folder = skillFolderOf(skillMdPath);
  const text = await raw(loc, ref, skillMdPath);
  if (text === null) return null;
  const parsed = parseSkillMd(text, folder.split("/").pop() || loc.repo);
  const files = folderFiles(tree, folder).filter(f => f.path !== skillMdPath);
  const rel = (f: TreeEntry) => f.path.slice(folder ? folder.length + 1 : 0);
  const textFiles = files.filter(f => TEXT_EXT.test(f.path) && !LICENCE_FILE.test(rel(f)));
  const programs = files.filter(f => PROGRAM_EXT.test(f.path));
  const sha = tree.find(t => t.path === skillMdPath)?.sha ?? "";
  return {
    url: `https://github.com/${loc.owner}/${loc.repo}/tree/${ref}/${folder}`.replace(/\/$/, ""),
    name: parsed.name,
    description: parsed.description,
    author: loc.owner,
    licence: await licenceFor(loc, ref, tree, folder),
    textFiles: textFiles.length,
    programs: programs.length,
    otherFiles: files.length - textFiles.length - programs.length - files.filter(f => LICENCE_FILE.test(rel(f))).length,
    version: sha,
  };
}

/** Every skill under a GitHub link (a collection, a folder, or one SKILL.md). */
export async function listGithubSkills(link: string): Promise<SkillSummary[]> {
  const loc = parseGithubUrl(link);
  if (!loc) throw new Error("That doesn't look like a GitHub link.");
  const { tree, ref } = await getTree(loc);
  const base = loc.path.replace(/\/?SKILL\.md$/i, "");
  const skillFiles = tree
    .filter(t => t.type === "blob" && /(^|\/)SKILL\.md$/i.test(t.path))
    .filter(t => !base || t.path === `${base}/SKILL.md` || t.path.startsWith(`${base}/`))
    .filter(t => !/(^|\/)template\/SKILL\.md$/i.test(t.path)) // a blank starting point, not a skill
    .map(t => t.path);
  const summaries = await inBatches(skillFiles, 6, p => summarise(loc, ref, tree, p));
  return summaries.filter((s): s is SkillSummary => s !== null).sort((a, b) => a.name.localeCompare(b.name));
}

/** One skill in full, ready to show before install. */
export async function previewGithubSkill(link: string): Promise<SkillPreview> {
  const loc = parseGithubUrl(link);
  if (!loc) throw new Error("That doesn't look like a GitHub link.");
  const { tree, ref } = await getTree(loc);
  const folder = loc.path.replace(/\/?SKILL\.md$/i, "");
  const skillMdPath = folder ? `${folder}/SKILL.md` : "SKILL.md";
  if (!tree.some(t => t.path === skillMdPath)) throw new Error("There's no skill (SKILL.md) at that link. Try the link to the skill's own folder.");
  const summary = await summarise(loc, ref, tree, skillMdPath);
  if (!summary) throw new Error("Couldn't read that skill from GitHub.");

  const text = (await raw(loc, ref, skillMdPath)) ?? "";
  const { body } = parseSkillMd(text);
  const relPath = (p: string) => p.slice(folder ? folder.length + 1 : 0);
  const extra = folderFiles(tree, folder)
    .filter(f => f.path !== skillMdPath && TEXT_EXT.test(f.path) && !LICENCE_FILE.test(relPath(f.path)) && (f.size ?? 0) <= MAX_FILE_BYTES)
    .slice(0, MAX_TEXT_FILES);
  const files = (await inBatches(extra, 6, async f => ({ path: relPath(f.path), text: (await raw(loc, ref, f.path)) ?? "" })))
    .filter(f => f.text.trim());
  const { content, truncated } = buildSkillContent(body, files);
  return { ...summary, content, truncated };
}
