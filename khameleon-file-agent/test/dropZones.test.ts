import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, planSort } from "../src/dropZones";
import { FileEntry } from "../src/types";

function file(name: string): FileEntry {
  return { path: `/downloads/${name}`, name, isDirectory: false };
}

describe("planSort", () => {
  it("classifies screenshots, images, and documents into the right buckets", () => {
    const files = [
      file("Screenshot 2026-08-19 at 9.41.00 AM.png"),
      file("vacation-photo.jpg"),
      file("Q3-report.pdf"),
      file("budget.xlsx"),
      file("app-installer.dmg"),
    ];

    const plan = planSort(files, DEFAULT_RULES);
    const byName = Object.fromEntries(plan.map((p) => [p.file.name, p]));

    // Screenshot filename matches the Screenshots rule before the generic Images rule.
    expect(byName["Screenshot 2026-08-19 at 9.41.00 AM.png"].rule?.label).toBe("Screenshots");
    expect(byName["vacation-photo.jpg"].rule?.label).toBe("Images");
    expect(byName["Q3-report.pdf"].rule?.label).toBe("Documents");
    expect(byName["budget.xlsx"].rule?.label).toBe("Spreadsheets");
    expect(byName["app-installer.dmg"].rule?.label).toBe("Installers");
  });

  it("leaves unmatched files alone (rule: null, destinationPath: null)", () => {
    const plan = planSort([file("random-notes")], DEFAULT_RULES);
    expect(plan[0].rule).toBeNull();
    expect(plan[0].destinationPath).toBeNull();
  });

  it("never includes directories in the plan", () => {
    const files: FileEntry[] = [
      { path: "/downloads/Photos", name: "Photos", isDirectory: true },
      file("pic.png"),
    ];
    const plan = planSort(files);
    expect(plan).toHaveLength(1);
    expect(plan[0].file.name).toBe("pic.png");
  });

  it("supports fully custom rule sets, not just the defaults", () => {
    const customRules = [{ label: "Invoices", match: /^invoice-/i, destination: "Invoices" }];
    const plan = planSort([file("invoice-0042.pdf")], customRules);
    expect(plan[0].rule?.label).toBe("Invoices");
    expect(plan[0].destinationPath).toBe("Invoices/invoice-0042.pdf");
  });
});
