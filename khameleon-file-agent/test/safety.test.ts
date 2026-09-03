import { describe, expect, it } from "vitest";
import * as os from "os";
import * as path from "path";
import { assertWithinRoot } from "../src/safety";
import { SafetyError } from "../src/types";

const root = path.join(os.tmpdir(), "khameleon-safety-root");

describe("assertWithinRoot", () => {
  it("allows a simple relative path inside root", () => {
    const resolved = assertWithinRoot(root, "Documents/report.pdf");
    expect(resolved).toBe(path.join(root, "Documents/report.pdf"));
  });

  it("allows the root itself", () => {
    expect(assertWithinRoot(root, ".")).toBe(path.resolve(root));
  });

  it("blocks a `..` traversal that escapes root", () => {
    expect(() => assertWithinRoot(root, "../../etc/passwd")).toThrow(SafetyError);
  });

  it("blocks an absolute path outside root", () => {
    expect(() => assertWithinRoot(root, "/etc/passwd")).toThrow(SafetyError);
  });

  it("blocks a path that only escapes after a nested traversal", () => {
    expect(() => assertWithinRoot(root, "Documents/../../secrets")).toThrow(SafetyError);
  });

  it("allows an absolute path that happens to already be inside root", () => {
    const inside = path.join(root, "Documents/report.pdf");
    expect(assertWithinRoot(root, inside)).toBe(path.resolve(inside));
  });
});
