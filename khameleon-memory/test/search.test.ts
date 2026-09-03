import { describe, expect, it } from "vitest";
import { rank, scoreMatch, tokenize } from "../src/search";

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumeric characters", () => {
    expect(tokenize("Meeting moved to 3pm!")).toEqual(["meeting", "moved", "3pm"]);
  });

  it("drops common stopwords", () => {
    expect(tokenize("the meeting is at 3pm")).toEqual(["meeting", "3pm"]);
  });
});

describe("scoreMatch", () => {
  it("scores higher overlap higher", () => {
    const high = scoreMatch("meeting time", "the meeting time changed");
    const low = scoreMatch("meeting time", "just a random note");
    expect(high).toBeGreaterThan(low);
  });

  it("gives an exact substring match a boost", () => {
    const withPhrase = scoreMatch("dark mode", "I prefer dark mode everywhere");
    const scattered = scoreMatch("dark mode", "mode: dark, but scattered wording");
    expect(withPhrase).toBeGreaterThan(scattered);
  });

  it("scores 0 for no overlap", () => {
    expect(scoreMatch("dark mode", "completely unrelated text")).toBe(0);
  });
});

describe("rank", () => {
  it("sorts best matches first and drops zero-score items", () => {
    const items = [
      "the quarterly report is due Friday",
      "I prefer dark mode in every app",
      "buy milk",
    ];
    const results = rank(items, "dark mode preference", (s) => s);
    expect(results).toHaveLength(1);
    expect(results[0].item).toBe("I prefer dark mode in every app");
  });
});
