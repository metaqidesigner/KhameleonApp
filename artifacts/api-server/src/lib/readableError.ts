/**
 * Provider errors arrive as e.g. `400 {"type":"error","error":{"message":"..."}}`.
 * For the activity log, keep just the human-readable message; anything that
 * isn't in that shape is returned unchanged.
 */
export function readableError(error: string): string {
  const m = error.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return m ? m[1].replace(/\\"/g, '"') : error;
}
