import { Router } from "express";
import { db } from "@workspace/db";
import { researchItemsTable } from "@workspace/db";
import { runDeepResearch } from "../agents/researchAgent.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(researchItemsTable).orderBy(researchItemsTable.createdAt);
    res.json(items.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching research items");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST / — run a live research query. Previously missing entirely: this
 * router had only the GET above, so pages/research.tsx's "Initiate
 * Research" button always hit a 404 and silently fell back to a canned
 * offline message, in every environment. See agents/researchAgent.ts for
 * why this isn't just reusing gateway.ts's existing agent loop.
 *
 * Deliberately does not write to research_items (the table GET / reads):
 * that table's schema (title/tags/credibilityScore/sources) models a
 * saved-research catalog, a different, unbuilt feature from "run this
 * query and show me a live answer" - forcing this response into that
 * shape would invent semantics for fields nothing here actually has
 * values for.
 */
router.post("/", async (req, res) => {
  try {
    const { query, max_iterations, web_search } = req.body as {
      query?: string;
      max_iterations?: unknown;
      web_search?: boolean;
    };
    if (!query?.trim()) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    const result = await runDeepResearch(query.trim(), { maxIterations: max_iterations, webSearch: web_search });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error running research query");
    res.status(502).json({ error: err instanceof Error ? err.message : "Research failed" });
  }
});

export default router;
