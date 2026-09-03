import * as path from "path";
import { DropZoneRule, FileEntry, SortPlanEntry } from "./types";

/** A reasonable default rule set — trivially overridable/extendable per user. */
export const DEFAULT_RULES: DropZoneRule[] = [
  { label: "Screenshots", match: /^screenshot|^screen shot/i, destination: "Screenshots" },
  { label: "Images", match: /\.(png|jpe?g|gif|webp|heic)$/i, destination: "Images" },
  { label: "Documents", match: /\.(pdf|docx?|pages)$/i, destination: "Documents" },
  { label: "Spreadsheets", match: /\.(xlsx?|csv|numbers)$/i, destination: "Spreadsheets" },
  { label: "Archives", match: /\.(zip|tar|gz|rar|7z)$/i, destination: "Archives" },
  { label: "Installers", match: /\.(dmg|pkg|exe|msi)$/i, destination: "Installers" },
];

/**
 * Classifies each file against the rule list (first match wins) and
 * returns a plan — it does NOT move anything itself. Keeping "decide"
 * and "act" as separate steps means the plan can be shown to the user
 * for confirmation before any file actually moves, and means this whole
 * function is pure and needs no disk access to test.
 */
export function planSort(
  files: FileEntry[],
  rules: DropZoneRule[] = DEFAULT_RULES
): SortPlanEntry[] {
  return files
    .filter((f) => !f.isDirectory)
    .map((file) => {
      const rule = rules.find((r) => r.match.test(file.name)) ?? null;
      return {
        file,
        rule,
        destinationPath: rule ? path.join(rule.destination, file.name) : null,
      };
    });
}
