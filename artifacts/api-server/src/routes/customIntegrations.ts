/**
 * design-spec.md §16.6 — importing an Integration from "an OpenAPI spec,
 * an MCP server URL... " rather than the first-party directory
 * (routes/integrations.ts, read-only). §16.3 requires connecting an
 * Integration to always be a hard confirm gate showing the exact real
 * scope being granted - /preview exists specifically to make that
 * disclosure real (it actually parses the spec and returns the real
 * discovered operations) rather than trusting whatever the user typed.
 *
 *   POST   /api/custom-integrations/preview  — parse, don't save; powers the confirm gate's disclosure
 *   POST   /api/custom-integrations          — re-parse for real and save
 *   GET    /api/custom-integrations          — list (never returns the auth token)
 *   DELETE /api/custom-integrations/:id      — disconnect (§16.5: local, reversible, no gate)
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { customIntegrationsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { encrypt } from "../lib/crypto.js";
import { getCurrentUserId } from "../lib/requestContext.js";
import { parseOpenApiSpec, InvalidOpenApiSpecError, type ParsedOperation } from "../lib/openApiImport.js";

const router = Router();

function ownedScope(column: typeof customIntegrationsTable.userId) {
  const userId = getCurrentUserId();
  return userId === undefined ? isNull(column) : eq(column, userId);
}

interface ImportRequestBody {
  sourceType?: "openapi" | "mcp";
  sourceUrl?: string;
  specText?: string;
  authToken?: string;
  name?: string;
}

/** Fetches the spec text from a URL, or returns the pasted text directly - shared by /preview and the real import. */
async function resolveSpecText(body: ImportRequestBody): Promise<string> {
  if (body.specText?.trim()) return body.specText;
  if (body.sourceUrl?.trim()) {
    const res = await fetch(body.sourceUrl);
    if (!res.ok) throw new InvalidOpenApiSpecError(`Could not fetch the spec URL (HTTP ${res.status}).`);
    return res.text();
  }
  throw new InvalidOpenApiSpecError("Provide either a spec URL or pasted spec text.");
}

function operationSummary(op: ParsedOperation) {
  return { toolName: op.toolName, method: op.method, path: op.path, summary: op.summary };
}

// ── POST /preview — parse only, never saved ───────────────────────────────

router.post("/preview", async (req, res) => {
  try {
    const body = req.body as ImportRequestBody;

    if (body.sourceType === "mcp") {
      if (!body.sourceUrl?.trim()) {
        res.status(400).json({ error: "An MCP server URL is required." });
        return;
      }
      let reachable = true;
      try {
        const probe = await fetch(body.sourceUrl, { method: "HEAD" });
        reachable = probe.status < 500;
      } catch {
        reachable = false;
      }
      res.json({
        sourceType: "mcp",
        url: body.sourceUrl,
        reachable,
        note: "MCP's own tool list is discovered by Claude directly when it talks to this server - it can't be previewed from here the way an OpenAPI spec's operations can.",
      });
      return;
    }

    if (body.sourceType !== "openapi") {
      res.status(400).json({ error: "sourceType must be 'openapi' or 'mcp'." });
      return;
    }

    const specText = await resolveSpecText(body);
    const parsed = parseOpenApiSpec(specText, body.sourceUrl?.trim() || undefined);
    res.json({
      sourceType: "openapi",
      title: parsed.title,
      baseUrl: parsed.baseUrl,
      operations: parsed.operations.map(operationSummary),
    });
  } catch (err) {
    if (err instanceof InvalidOpenApiSpecError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "custom-integrations preview failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Preview failed" });
  }
});

// ── POST / — real import, re-parses rather than trusting the preview ─────

router.post("/", async (req, res) => {
  try {
    const body = req.body as ImportRequestBody;
    if (!body.name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const encryptedAuthToken = body.authToken?.trim() ? encrypt(body.authToken.trim()) : null;

    if (body.sourceType === "mcp") {
      if (!body.sourceUrl?.trim()) {
        res.status(400).json({ error: "An MCP server URL is required." });
        return;
      }
      const [row] = await db
        .insert(customIntegrationsTable)
        .values({
          userId: getCurrentUserId() ?? null,
          name: body.name.trim(),
          sourceType: "mcp",
          sourceUrl: body.sourceUrl.trim(),
          encryptedAuthToken,
        })
        .returning();
      res.status(201).json({ id: row.id, name: row.name, sourceType: row.sourceType, sourceUrl: row.sourceUrl, operationCount: 0, createdAt: row.createdAt });
      return;
    }

    if (body.sourceType !== "openapi") {
      res.status(400).json({ error: "sourceType must be 'openapi' or 'mcp'." });
      return;
    }

    const specText = await resolveSpecText(body);
    const parsed = parseOpenApiSpec(specText, body.sourceUrl?.trim() || undefined);

    const [row] = await db
      .insert(customIntegrationsTable)
      .values({
        userId: getCurrentUserId() ?? null,
        name: body.name.trim(),
        sourceType: "openapi",
        sourceUrl: body.sourceUrl?.trim() || null,
        baseUrl: parsed.baseUrl,
        operations: JSON.stringify(parsed.operations),
        encryptedAuthToken,
      })
      .returning();

    res.status(201).json({
      id: row.id,
      name: row.name,
      sourceType: row.sourceType,
      sourceUrl: row.sourceUrl,
      baseUrl: row.baseUrl,
      operationCount: parsed.operations.length,
      createdAt: row.createdAt,
    });
  } catch (err) {
    if (err instanceof InvalidOpenApiSpecError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "custom-integrations import failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

// ── GET / — list, never returns the auth token ────────────────────────────

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(customIntegrationsTable)
      .where(ownedScope(customIntegrationsTable.userId))
      .orderBy(customIntegrationsTable.createdAt);

    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        sourceType: r.sourceType,
        sourceUrl: r.sourceUrl,
        baseUrl: r.baseUrl,
        operationCount: r.operations ? (JSON.parse(r.operations) as unknown[]).length : 0,
        enabled: r.enabled,
        createdAt: r.createdAt,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Error listing custom integrations");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /:id — disconnect, local and reversible (§16.5) ───────────────

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const deleted = await db
      .delete(customIntegrationsTable)
      .where(and(eq(customIntegrationsTable.id, id), ownedScope(customIntegrationsTable.userId)))
      .returning({ id: customIntegrationsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting custom integration");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
