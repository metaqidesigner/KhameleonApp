/**
 * Unit tests for outlookGraph.ts's pure helpers: recipient formatting,
 * reply-subject prefixing, HTML stripping, and thread-to-plain-text
 * assembly. The Graph API calls themselves need a live Microsoft OAuth
 * token and live network, neither of which this suite touches - same
 * DB-free/network-free pattern as weather.test.ts and webFetch.test.ts.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { recipientLine, replySubject, stripHtml, stripSubjectPrefix, threadToPlainText } from "./outlookGraph.js";

test("recipientLine joins multiple recipients", () => {
  assert.equal(
    recipientLine({
      toRecipients: [
        { emailAddress: { address: "alice@example.com" } },
        { emailAddress: { address: "bob@example.com" } },
      ],
    }),
    "alice@example.com, bob@example.com"
  );
});

test("recipientLine falls back when there are no recipients", () => {
  assert.equal(recipientLine({ toRecipients: [] }), "(unknown recipient)");
});

test("replySubject adds Re: prefix when missing", () => {
  assert.equal(replySubject("Q4 timeline"), "Re: Q4 timeline");
});

test("replySubject does not double-prefix an existing Re:", () => {
  assert.equal(replySubject("Re: Q4 timeline"), "Re: Q4 timeline");
  assert.equal(replySubject("RE: Q4 timeline"), "RE: Q4 timeline");
});

test("replySubject handles missing/empty subjects", () => {
  assert.equal(replySubject(null), "Re:");
  assert.equal(replySubject(undefined), "Re:");
  assert.equal(replySubject("   "), "Re:");
});

test("stripHtml removes tags and decodes common entities", () => {
  const html = "<p>Hi Bob,</p><p>Following up on <b>Q4</b> &amp; the timeline.</p>";
  const text = stripHtml(html);
  assert.ok(!text.includes("<"));
  assert.ok(text.includes("Hi Bob,"));
  assert.ok(text.includes("Following up on Q4 & the timeline."));
});

test("stripHtml collapses <br> to newlines and drops style/script blocks", () => {
  const html = "<style>.x{color:red}</style>Line one<br>Line two<script>evil()</script>";
  const text = stripHtml(html);
  assert.ok(!text.includes("color:red"));
  assert.ok(!text.includes("evil()"));
  assert.ok(text.includes("Line one\nLine two"));
});

test("threadToPlainText assembles messages oldest-first with sender/date headers", () => {
  const text = threadToPlainText([
    { from: { emailAddress: { address: "alice@example.com" } }, body: { contentType: "text", content: "Hi there" }, bodyPreview: "", receivedDateTime: "2026-09-01T10:00:00Z" },
    { from: { emailAddress: { address: "bob@example.com" } }, body: { contentType: "text", content: "Thanks!" }, bodyPreview: "", receivedDateTime: "2026-09-02T10:00:00Z" },
  ]);
  assert.ok(text.indexOf("alice@example.com") < text.indexOf("bob@example.com"));
  assert.ok(text.includes("Hi there"));
  assert.ok(text.includes("Thanks!"));
});

test("stripSubjectPrefix removes a leading 'Subject: ...' header line", () => {
  assert.equal(
    stripSubjectPrefix("Subject: Re: Q4 timeline\n\nHi Bob,\n\nThanks for the update."),
    "Hi Bob,\n\nThanks for the update."
  );
});

test("stripSubjectPrefix leaves text unchanged when there is no subject header", () => {
  assert.equal(stripSubjectPrefix("Hi Bob,\n\nThanks for the update."), "Hi Bob,\n\nThanks for the update.");
});

test("threadToPlainText falls back to bodyPreview when body content is empty", () => {
  const text = threadToPlainText([
    { from: null, body: { contentType: "text", content: "" }, bodyPreview: "preview text", receivedDateTime: "2026-09-01T10:00:00Z" },
  ]);
  assert.ok(text.includes("preview text"));
  assert.ok(text.includes("(unknown sender)"));
});
