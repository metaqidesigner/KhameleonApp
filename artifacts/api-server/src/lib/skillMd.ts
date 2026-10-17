/**
 * Reading skills published in Anthropic's skill format (docs/build-review.md,
 * Build 16): a folder with SKILL.md (YAML front matter: name, description,
 * optional license; then the instructions) plus optional files. Pure
 * functions, so they're testable without the network.
 */

export interface ParsedSkillMd {
  name: string;
  description: string;
  body: string;
}

/** Splits SKILL.md into front matter fields and the instruction body. */
export function parseSkillMd(text: string, fallbackName = "Imported skill"): ParsedSkillMd {
  const m = text.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { name: fallbackName, description: "", body: text.trim() };
  const fields: Record<string, string> = {};
  let current: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) {
      current = kv[1].toLowerCase();
      fields[current] = kv[2].trim();
    } else if (current && /^\s+\S/.test(line)) {
      fields[current] += " " + line.trim(); // folded continuation line
    }
  }
  const unquote = (v = "") => v.replace(/^["']|["']$/g, "").replace(/^[>|]-?\s*/, "").trim();
  return {
    name: unquote(fields.name) || fallbackName,
    description: unquote(fields.description),
    body: m[2].trim(),
  };
}

export type LicenceKind = "open" | "restricted" | "unknown";

export interface Licence {
  kind: LicenceKind;
  label: string;
}

/**
 * Reads a skill's licence file. "open" = a recognised open licence we may
 * use; "restricted" = all rights reserved / tied to someone's own service
 * (not installed); "unknown" = no licence file (installed with a warning).
 */
export function classifyLicence(text: string | null): Licence {
  if (!text || !text.trim()) return { kind: "unknown", label: "No licence stated" };
  const t = text.slice(0, 3000);
  if (/Apache License/i.test(t) && /Version 2\.0/i.test(t)) return { kind: "open", label: "Apache 2.0" };
  if (/\bMIT License\b|Permission is hereby granted, free of charge/i.test(t)) return { kind: "open", label: "MIT" };
  if (/\bBSD\b.*License|Redistribution and use in source and binary forms/i.test(t)) return { kind: "open", label: "BSD" };
  if (/Creative Commons Attribution(?![- ]Non)/i.test(t) || /CC[- ]BY(?![- ]NC)/i.test(t)) return { kind: "open", label: "Creative Commons Attribution" };
  if (/all rights reserved|governed by your agreement|proprietary|non-?commercial/i.test(t)) return { kind: "restricted", label: "Restricted - not licensed for use here" };
  return { kind: "unknown", label: "Unrecognised licence" };
}

export interface GithubLocation {
  owner: string;
  repo: string;
  ref?: string;
  path: string;
}

/** Understands github.com repo/tree/blob links and raw.githubusercontent.com links. */
export function parseGithubUrl(input: string): GithubLocation | null {
  let url: URL;
  try {
    url = new URL(input.trim().replace(/^(?!https?:\/\/)/, "https://"));
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "raw.githubusercontent.com" && parts.length >= 3) {
    const [owner, repo, ref, ...rest] = parts;
    return { owner, repo, ref, path: rest.join("/") };
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
  if (parts.length < 2) return null;
  const [owner, repoRaw, kind, ref, ...rest] = parts;
  const repo = repoRaw.replace(/\.git$/, "");
  if ((kind === "tree" || kind === "blob") && ref) return { owner, repo, ref, path: rest.join("/") };
  return { owner, repo, path: "" };
}

/** A skill's folder within the repository: the SKILL.md file's own folder. */
export function skillFolderOf(skillMdPath: string): string {
  return skillMdPath.split("/").slice(0, -1).join("/");
}

const MAX_CONTENT = 24_000;

/**
 * One stored skill: the SKILL.md instructions plus its text files, each
 * marked with its file name so references like "examples/faq.md" still
 * make sense. Capped so it fits an offline brain.
 */
export function buildSkillContent(body: string, files: { path: string; text: string }[]): { content: string; truncated: boolean } {
  let content = body.trim();
  for (const f of files) content += `\n\n=== File: ${f.path} ===\n${f.text.trim()}`;
  if (content.length <= MAX_CONTENT) return { content, truncated: false };
  return { content: content.slice(0, MAX_CONTENT) + "\n\n[Shortened - the full skill was too long to keep.]", truncated: true };
}
