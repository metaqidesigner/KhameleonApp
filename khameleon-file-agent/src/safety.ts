import * as path from "path";
import { SafetyError } from "./types";

/**
 * Resolves `target` and throws SafetyError unless it is inside `root`
 * (or is `root` itself). This is the guardrail from the Khameleon scope
 * doc's "trust" risk — an agent that can touch files should not be able
 * to silently escape the folder(s) it was granted access to via a
 * relative path, a symlink-looking string, or a `..` traversal.
 *
 * Pure and synchronous on purpose: no disk I/O, so it's cheap to check
 * before every single file operation, not just at the boundary.
 */
export function assertWithinRoot(root: string, target: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(root, target);

  const relative = path.relative(resolvedRoot, resolvedTarget);
  const escapesRoot =
    relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);

  if (escapesRoot) {
    throw new SafetyError(
      `Refusing to touch "${target}" — it resolves outside the allowed folder (${resolvedRoot}).`
    );
  }

  return resolvedTarget;
}
