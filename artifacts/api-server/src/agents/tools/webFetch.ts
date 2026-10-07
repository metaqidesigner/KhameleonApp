/**
 * Real web-research tool: fetches a URL and returns its readable text.
 * This is what actually closes the "research agent has no way to read the
 * live web" gap — the /api/research route itself is plain DB CRUD, but an
 * agent with this tool can genuinely go fetch a page and reason over it,
 * then (via create_task / write_file, or a future save-to-research tool)
 * persist what it found.
 *
 * Deliberately fetch-based, not a full headless browser: Playwright/a real
 * browser needs a display or heavyweight sandboxing that doesn't belong in
 * a cloud API process, and most research reading (docs, articles, API
 * references) doesn't need JS execution to get the content. Pages that are
 * fully client-rendered will come back mostly empty — that's a known
 * limitation of this tool, not a bug.
 */

import { wrapUntrustedWebContent } from "./injectionScanner.js";

const MAX_RESPONSE_BYTES = 2_000_000; // 2 MB raw download cap
const MAX_RETURNED_CHARS = 12_000; // cap what actually goes back to the model
const FETCH_TIMEOUT_MS = 15_000;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // cloud metadata endpoint (AWS/GCP/Azure) — never fetchable
]);

export function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".local")) return true;
  if (h.endsWith(".internal")) return true;
  // IPv4 private/loopback/link-local ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Not a valid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Only http/https URLs can be fetched, got: ${url.protocol}`);
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error(`Refusing to fetch a private/internal address: ${url.hostname}`);
  }
  return url;
}

/**
 * Strip a very small, safe subset of HTML down to readable text:
 * drop <script>/<style>/<noscript> entirely, turn block-level tags into
 * line breaks, strip remaining tags, and unescape common entities.
 * This is intentionally simple (no DOM parser dependency) — good enough
 * for reading articles/docs, not a general-purpose HTML-to-text library.
 */
export function htmlToText(html: string): string {
  let text = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export async function fetchUrl(rawUrl: string): Promise<string> {
  const url = assertFetchableUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "KhameleonResearchAgent/1.0 (+https://khameleon.app)" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Fetch failed for ${url.hostname}: ${message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} for ${rawUrl}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new Error(`Response too large (${contentLength} bytes) — refusing to download.`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error(`Response too large (${buf.byteLength} bytes) — refusing to process.`);
  }
  const raw = Buffer.from(buf).toString("utf8");

  const body = contentType.includes("html") ? htmlToText(raw) : raw.trim();
  const truncated = body.length > MAX_RETURNED_CHARS;
  const clipped = truncated ? body.slice(0, MAX_RETURNED_CHARS) : body;

  const pageText = clipped || "(no readable text content — page may be JavaScript-rendered)";

  return [
    `URL: ${url.toString()}`,
    `Content-Type: ${contentType || "unknown"}`,
    truncated ? `(truncated to ${MAX_RETURNED_CHARS} of ${body.length} characters)` : null,
    "---",
    wrapUntrustedWebContent(pageText),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
