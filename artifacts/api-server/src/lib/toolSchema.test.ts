import { test } from "node:test";
import assert from "node:assert/strict";
import { toKhamiParams, stripNulls } from "./toolSchema.js";

test("required fields stay required; optional ones may be left empty", () => {
  const out = toKhamiParams({
    type: "object",
    properties: {
      title: { type: "string", description: "Task title", minLength: 1 },
      priority: { type: "string", enum: ["low", "high"] },
      due: { type: "string", format: "date" },
    },
    required: ["title"],
  });
  assert.deepEqual(out, {
    type: "object",
    properties: {
      title: { type: "string", description: "Task title" },
      priority: { oneOf: [{ enum: ["low", "high"] }, { type: "null" }] },
      due: { type: ["string", "null"] },
    },
  });
});

test("odd types fall back to string; missing schema gives no fields", () => {
  assert.deepEqual(toKhamiParams({ type: "object", properties: { n: { oneOf: [{ type: "number" }] } }, required: ["n"] }),
    { type: "object", properties: { n: { type: "string" } } });
  assert.deepEqual(toKhamiParams(undefined), { type: "object", properties: {} });
});

test("empty fields are removed before the tool runs", () => {
  assert.deepEqual(stripNulls({ title: "x", priority: null, due: undefined }), { title: "x" });
});
