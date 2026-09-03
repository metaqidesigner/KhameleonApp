/**
 * Unit tests for the pure/deterministic parts of fetch_url: URL safety
 * gating and HTML-to-text extraction. Deliberately does not hit the
 * network — the fetch() call itself isn't covered here, only the logic
 * that decides what's safe to fetch and how a response gets turned into
 * text, matching the rest of this codebase's DB-free unit tests.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { assertFetchableUrl, isPrivateHostname, htmlToText } from "./webFetch.js";

// ── isPrivateHostname ───────────────────────────────────────────────────────

test("isPrivateHostname blocks localhost and loopback", () => {
  assert.equal(isPrivateHostname("localhost"), true);
  assert.equal(isPrivateHostname("127.0.0.1"), true);
  assert.equal(isPrivateHostname("127.55.0.9"), true);
});

test("isPrivateHostname blocks the cloud metadata endpoint", () => {
  assert.equal(isPrivateHostname("169.254.169.254"), true);
});

test("isPrivateHostname blocks RFC1918 private ranges", () => {
  assert.equal(isPrivateHostname("10.0.0.5"), true);
  assert.equal(isPrivateHostname("172.16.0.1"), true);
  assert.equal(isPrivateHostname("172.31.255.255"), true);
  assert.equal(isPrivateHostname("192.168.1.1"), true);
});

test("isPrivateHostname does not block adjacent public-looking ranges", () => {
  assert.equal(isPrivateHostname("172.15.0.1"), false); // just below the 172.16-31 block
  assert.equal(isPrivateHostname("172.32.0.1"), false); // just above it
  assert.equal(isPrivateHostname("8.8.8.8"), false);
});

test("isPrivateHostname blocks .local and .internal suffixes", () => {
  assert.equal(isPrivateHostname("printer.local"), true);
  assert.equal(isPrivateHostname("db.internal"), true);
});

test("isPrivateHostname allows ordinary public hostnames", () => {
  assert.equal(isPrivateHostname("example.com"), false);
  assert.equal(isPrivateHostname("docs.anthropic.com"), false);
});

// ── assertFetchableUrl ───────────────────────────────────────────────────────

test("assertFetchableUrl accepts http/https URLs to public hosts", () => {
  const url = assertFetchableUrl("https://example.com/page?x=1");
  assert.equal(url.hostname, "example.com");
});

test("assertFetchableUrl rejects malformed URLs", () => {
  assert.throws(() => assertFetchableUrl("not a url"), /Not a valid URL/);
});

test("assertFetchableUrl rejects non-http(s) protocols", () => {
  assert.throws(() => assertFetchableUrl("file:///etc/passwd"), /Only http\/https/);
  assert.throws(() => assertFetchableUrl("ftp://example.com/file"), /Only http\/https/);
});

test("assertFetchableUrl rejects private/internal addresses", () => {
  assert.throws(() => assertFetchableUrl("http://127.0.0.1:8080/admin"), /private\/internal/);
  assert.throws(() => assertFetchableUrl("http://169.254.169.254/latest/meta-data"), /private\/internal/);
  assert.throws(() => assertFetchableUrl("http://internal-db.internal/data"), /private\/internal/);
});

// ── htmlToText ───────────────────────────────────────────────────────────────

test("htmlToText strips tags and keeps text", () => {
  const html = "<html><body><h1>Title</h1><p>Hello <b>world</b>.</p></body></html>";
  const text = htmlToText(html);
  assert.ok(text.includes("Title"));
  assert.ok(text.includes("Hello"));
  assert.ok(text.includes("world"));
  assert.ok(!text.includes("<"));
});

test("htmlToText drops script and style content entirely", () => {
  const html = "<p>Visible</p><script>alert('nope, this should not appear')</script><style>.x{color:red}</style>";
  const text = htmlToText(html);
  assert.ok(text.includes("Visible"));
  assert.ok(!text.includes("alert"));
  assert.ok(!text.includes("color:red"));
});

test("htmlToText unescapes common HTML entities", () => {
  const html = "<p>Tom &amp; Jerry &mdash;&nbsp;&quot;fun&quot;</p>".replace("&mdash;", "");
  const text = htmlToText(html);
  assert.ok(text.includes("Tom & Jerry"));
  assert.ok(text.includes('"fun"'));
});

test("htmlToText turns block-level closing tags into line breaks", () => {
  const html = "<p>First</p><p>Second</p>";
  const text = htmlToText(html);
  const lines = text.split("\n").filter(Boolean);
  assert.deepEqual(lines, ["First", "Second"]);
});
