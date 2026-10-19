import { describe, expect, it } from "vitest";
import { titleWords, sameStep, stepKey, isExcluded, sessions, findRepeats, describePattern, type SwitchEntry } from "../src/detection";

const day = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const reconcile = (d: number, supplier: string): SwitchEntry[] => [
  { at: day(d, 9, 0), app: "Microsoft Outlook", title: `Statement from ${supplier} - Inbox` },
  { at: day(d, 9, 2), app: "Preview", title: `${supplier}_statement_Oct.pdf` },
  { at: day(d, 9, 5), app: "Microsoft Excel", title: "Purchase ledger 2026.xlsx" },
  { at: day(d, 9, 9), app: "Microsoft Outlook", title: `RE: Statement from ${supplier}` },
];

describe("window names", () => {
  it("keeps the meaningful words only", () => {
    expect(titleWords("Acme_statement_Oct 2026.pdf")).toEqual(["acme", "statement"]);
    expect(titleWords("Untitled 3")).toEqual([]);
  });
  it("treats different suppliers' statements as the same step", () => {
    expect(sameStep(stepKey({ at: 0, app: "Preview", title: "Acme_statement_Oct.pdf" }), stepKey({ at: 0, app: "Preview", title: "Beta_statement_Sep.pdf" }))).toBe(true);
    expect(sameStep(stepKey({ at: 0, app: "Preview", title: "Holiday photos" }), stepKey({ at: 0, app: "Preview", title: "Acme statement" }))).toBe(false);
  });
});

describe("leaving things out", () => {
  it("leaves out banking, password managers and private windows by default - switchable", () => {
    expect(isExcluded("Safari", "HSBC Online Banking", { defaults: true, custom: [] })).toBe(true);
    expect(isExcluded("1Password", "Vault", { defaults: true, custom: [] })).toBe(true);
    expect(isExcluded("Google Chrome", "New Incognito Tab", { defaults: true, custom: [] })).toBe(true);
    expect(isExcluded("Safari", "HSBC Online Banking", { defaults: false, custom: [] })).toBe(false);
    expect(isExcluded("Messages", "Mum", { defaults: true, custom: ["messages"] })).toBe(true);
    expect(isExcluded("Microsoft Excel", "Ledger", { defaults: true, custom: [] })).toBe(false);
  });
});

describe("finding repeats", () => {
  it("splits sessions at long gaps and collapses repeated steps", () => {
    const s = sessions([
      { at: day(1, 9), app: "A", title: "x one" }, { at: day(1, 9, 1), app: "A", title: "x one" }, { at: day(1, 9, 2), app: "B", title: "y" },
      { at: day(1, 11), app: "C", title: "z" },
    ]);
    expect(s.map(x => x.map(e => e.app))).toEqual([["A", "B"], ["C"]]);
  });

  it("finds a task done on 3 different days, even with different suppliers", () => {
    const log = [...reconcile(13, "Acme"), ...reconcile(15, "Beta"), ...reconcile(20, "Gamma"), { at: day(20, 15), app: "Safari", title: "News" }];
    const found = findRepeats(log, day(21, 9));
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].steps.length).toBe(4);
    expect(found[0].days).toHaveLength(3);
    expect(describePattern(found[0])).toMatch(/^Microsoft Outlook \(.*Gamma.*\) → Preview \(Gamma_statement_Oct\.pdf\) → Microsoft Excel/);
  });

  it("needs 3 days within 2 weeks, and more than one app", () => {
    expect(findRepeats([...reconcile(13, "Acme"), ...reconcile(15, "Beta")], day(21, 9))).toEqual([]);
    expect(findRepeats([...reconcile(1, "Acme"), ...reconcile(15, "Beta"), ...reconcile(20, "Gamma")], day(21, 9))).toEqual([], );
    const oneApp = [13, 15, 20].flatMap(d => [{ at: day(d, 9), app: "Excel", title: "a sheet" }, { at: day(d, 9, 1), app: "Excel", title: "b report" }, { at: day(d, 9, 2), app: "Excel", title: "c ledger" }]);
    expect(findRepeats(oneApp, day(21, 9))).toEqual([]);
  });
});
