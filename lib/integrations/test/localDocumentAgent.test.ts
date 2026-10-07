import { describe, expect, it } from "vitest";
import { truncateForModel } from "../src/localDocumentAgent";

// LocalDocumentAgent's real behavior (PDF extraction + a multi-gigabyte
// local model) was verified by hand, with network access genuinely
// disabled - see khameleon-decisions-log.md, 2026-10-03. truncateForModel
// is the one piece of its logic that's meaningfully unit-testable on its
// own, so that's what's covered here.
describe("truncateForModel", () => {
  it("returns the text unchanged when it's within the limit", () => {
    expect(truncateForModel("short document", 100)).toEqual({ text: "short document", truncated: false });
  });

  it("returns the text unchanged when it's exactly at the limit", () => {
    const text = "x".repeat(50);
    expect(truncateForModel(text, 50)).toEqual({ text, truncated: false });
  });

  it("truncates and flags it when the text exceeds the limit", () => {
    const text = "a".repeat(30);
    const result = truncateForModel(text, 10);
    expect(result.truncated).toBe(true);
    expect(result.text).toBe("a".repeat(10));
  });
});
