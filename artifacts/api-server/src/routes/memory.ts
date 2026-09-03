import { Router } from "express";
import { db } from "@workspace/db";
import { memoryItemsTable } from "@workspace/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { CreateMemoryItemBody } from "@workspace/api-zod";
import { readFile } from "../agents/tools/shell.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(memoryItemsTable).orderBy(memoryItemsTable.category);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Error fetching memory items");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /search?q= — real search over stored memory items (key/value/category
 * ILIKE match). Previously this path didn't exist at all: pages/memory.tsx's
 * "MEMORY RETRIEVAL" search box called it via searchMemory() in jarvisApi.ts,
 * got a 404 every time, and safeFetch silently substituted two canned
 * "Demo result" rows - always the same two, regardless of query. Found by
 * the 2026-09-03 backend-route audit.
 */
router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      res.json([]);
      return;
    }

    const pattern = `%${q}%`;
    const rows = await db
      .select()
      .from(memoryItemsTable)
      .where(or(ilike(memoryItemsTable.value, pattern), ilike(memoryItemsTable.key, pattern), ilike(memoryItemsTable.category, pattern)))
      .orderBy(desc(memoryItemsTable.updatedAt))
      .limit(20);

    const qLower = q.toLowerCase();
    res.json(
      rows.map((r) => ({
        content: r.value.length > 300 ? `${r.value.slice(0, 300)}…` : r.value,
        source: `${r.category}/${r.key}`,
        // Crude but honest: a key/category hit ranks above a value-only substring hit, real
        // relevance would need actual embeddings/full-text ranking, out of scope here.
        score: r.key.toLowerCase().includes(qLower) || r.category.toLowerCase().includes(qLower) ? 1 : 0.7,
        chunk_id: String(r.id),
        ts: r.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error searching memory");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /index { path } — reads a real workspace file (the same safe,
 * path-traversal-guarded readFile the agent tool loop uses) and stores its
 * content as a memory item. Previously this path also didn't exist: the
 * "MEMORY INDEX CONTROL" panel's Index button called it via
 * indexMemoryPath(), got a 404 every time, and safeFetch silently
 * substituted { ok: true, chunks: 42 } - a FAKE SUCCESS, not just missing
 * data. Every click told the user their path was "indexed successfully"
 * with a specific (fabricated) chunk count, regardless of whether the path
 * existed or anything happened at all. Found by the 2026-09-03
 * backend-route audit.
 *
 * Scoped to one file, not a directory walk - "index" stores exactly one
 * memory item (whole-file value, searchable via /search above). Re-indexing
 * the same path updates that item in place rather than duplicating it.
 */
router.post("/index", async (req, res) => {
  try {
    const { path: rawPath } = req.body as { path?: string };
    const relPath = rawPath?.trim();
    if (!relPath) {
      res.status(400).json({ error: "path is required" });
      return;
    }

    let content: string;
    try {
      content = await readFile(relPath);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not read path" });
      return;
    }

    const [existing] = await db
      .select()
      .from(memoryItemsTable)
      .where(and(eq(memoryItemsTable.category, "indexed"), eq(memoryItemsTable.key, relPath)))
      .limit(1);

    if (existing) {
      await db.update(memoryItemsTable).set({ value: content, updatedAt: new Date() }).where(eq(memoryItemsTable.id, existing.id));
    } else {
      await db.insert(memoryItemsTable).values({ category: "indexed", key: relPath, value: content });
    }

    res.json({ ok: true, chunks: 1 });
  } catch (err) {
    req.log.error({ err }, "Error indexing memory path");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = CreateMemoryItemBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [item] = await db.insert(memoryItemsTable).values(parsed.data).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Error creating memory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(memoryItemsTable).where(eq(memoryItemsTable.id, id));
    if (!item) return res.status(404).json({ error: "Memory item not found" });
    if (item.isProtected) return res.status(403).json({ error: "Cannot delete protected memory" });

    await db.delete(memoryItemsTable).where(eq(memoryItemsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting memory item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
