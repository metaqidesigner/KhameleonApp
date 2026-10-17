/**
 * Converts a tool's JSON Schema into the restricted form Khami's engine can
 * enforce (node-llama-cpp grammar). That engine makes every listed field
 * appear, so optional fields are allowed to be null ("leave it empty") and
 * nulls are removed before the tool runs (stripNulls). Unsupported keywords
 * (format, pattern...) are dropped; at most MAX_OPTIONAL optional fields are
 * kept so the grammar stays small for an offline brain. Pure, so testable.
 */
type Json = Record<string, unknown>;

const SIMPLE = new Set(["string", "number", "integer", "boolean"]);
const MAX_OPTIONAL = 8;

function simplify(schema: unknown, depth = 0): Json {
  const s = (schema && typeof schema === "object" ? schema : {}) as Json;
  const type = Array.isArray(s.type) ? (s.type as string[]).find(t => t !== "null") : (s.type as string | undefined);
  const out: Json = {};
  if (typeof s.description === "string") out.description = s.description.slice(0, 300);
  if (Array.isArray(s.enum) && s.enum.every(v => typeof v === "string")) return { ...out, enum: s.enum };
  if (type === "array" && depth < 3) return { ...out, type: "array", items: simplify(s.items, depth + 1) };
  if (type === "object" && depth < 3) return { ...out, ...toKhamiParams(s, depth + 1) };
  return { ...out, type: type && SIMPLE.has(type) ? type : "string" };
}

function optional(schema: Json): Json {
  if (typeof schema.type === "string" && SIMPLE.has(schema.type)) return { ...schema, type: [schema.type, "null"] };
  const { description, ...rest } = schema;
  return { ...(description ? { description } : {}), oneOf: [rest, { type: "null" }] };
}

export function toKhamiParams(schema: unknown, depth = 0): Json {
  const s = (schema && typeof schema === "object" ? schema : {}) as Json;
  const props = (s.properties && typeof s.properties === "object" ? s.properties : {}) as Record<string, unknown>;
  const required = new Set(Array.isArray(s.required) ? (s.required as string[]).filter(k => k in props) : []);
  const properties: Record<string, Json> = {};
  for (const k of Object.keys(props).filter(k => required.has(k))) properties[k] = simplify(props[k], depth);
  for (const k of Object.keys(props).filter(k => !required.has(k)).slice(0, MAX_OPTIONAL)) properties[k] = optional(simplify(props[k], depth));
  return { type: "object", properties };
}

/** Removes the "left empty" (null) fields before a tool runs. */
export function stripNulls(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== null && v !== undefined));
}
