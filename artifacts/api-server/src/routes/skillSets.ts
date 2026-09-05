import { Router } from "express";
import { db } from "@workspace/db";
import {
  skillSetsTable, approvalsTable, actionReceiptsTable, entityWorkDomainsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requiresHardGate, diffScope } from "../lib/skillSetScope.js";

const router = Router();

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

async function tagsFor(skillSetId: number): Promise<number[]> {
  const rows = await db
    .select()
    .from(entityWorkDomainsTable)
    .where(and(eq(entityWorkDomainsTable.entityType, "skill_set"), eq(entityWorkDomainsTable.entityId, String(skillSetId))));
  return rows.map((r) => r.workDomainId);
}

/**
 * A skill set left 'pending' (its gate was shown once at creation but
 * dismissed rather than confirmed) needs its approval id again to
 * resolve correctly later - createSkillSet's response only carries it
 * once. Looked up by the `action` naming convention used when the
 * approval row was created, rather than adding a column for it.
 */
async function pendingApprovalIdFor(skillSetId: number): Promise<number | null> {
  const [row] = await db
    .select()
    .from(approvalsTable)
    .where(and(eq(approvalsTable.action, `skill_set_install:${skillSetId}`), eq(approvalsTable.status, "pending")));
  return row?.id ?? null;
}

// GET / — the catalog: every Skill Set (available/installed/uninstalled) + its work-domain tags.
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(skillSetsTable).orderBy(skillSetsTable.id);
    const withTags = await Promise.all(rows.map(async (r) => ({
      ...r,
      workDomainIds: await tagsFor(r.id),
      pendingApprovalId: r.status === "pending" ? await pendingApprovalIdFor(r.id) : null,
    })));
    res.json(withTags);
  } catch (err) {
    req.log.error({ err }, "Error fetching skill sets");
    res.status(500).json({ error: "Internal server error" });
  }
});

interface CreateSkillSetBody {
  name: string;
  description?: string;
  content?: string;
  sourceType?: string; // 'authored' | 'github' | 'url' | 'marketplace'
  sourceUrl?: string;
  sourceAuthor?: string;
  sourceUpdatedAt?: string;
  requestedTools?: string[];
  requestedIntegrationIds?: string[];
  workDomainIds?: number[];
}

/**
 * POST / — create or import a Skill Set. §15.3 + §15.5: whether this
 * installs immediately or requires a hard gate depends on the source
 * and the requested scope, decided by requiresHardGate() (unit-tested,
 * lib/skillSetScope.ts) - never by a client-supplied flag.
 */
router.post("/", async (req, res) => {
  const body = req.body as CreateSkillSetBody;
  if (!body?.name) { res.status(400).json({ error: "name is required" }); return; }

  const sourceType = body.sourceType ?? "authored";
  const requestedTools = parseJsonArray(body.requestedTools);
  const requestedIntegrationIds = parseJsonArray(body.requestedIntegrationIds);
  const gated = requiresHardGate({ sourceType, requestedTools, requestedIntegrationIds });

  try {
    const [skillSet] = await db
      .insert(skillSetsTable)
      .values({
        name: body.name,
        description: body.description ?? "",
        content: body.content ?? "",
        sourceType,
        sourceUrl: body.sourceUrl ?? null,
        sourceAuthor: body.sourceAuthor ?? null,
        sourceUpdatedAt: body.sourceUpdatedAt ?? null,
        requestedTools,
        requestedIntegrationIds,
        status: gated ? "pending" : "installed",
        installedAt: gated ? null : new Date(),
      })
      .returning();

    for (const domainId of body.workDomainIds ?? []) {
      await db.insert(entityWorkDomainsTable).values({ entityType: "skill_set", entityId: String(skillSet.id), workDomainId: domainId });
    }

    if (!gated) {
      await db.insert(actionReceiptsTable).values({
        description: `Installed Skill Set "${skillSet.name}"`,
        category: "skill_set_install",
        scope: "local, no new tool/data access",
        outcome: "success",
        target: skillSet.name,
        canUndo: true,
      });
      res.status(201).json({ skillSet, approvalId: null });
      return;
    }

    // Externally-sourced or scope-affecting: a hard gate, backed by the
    // existing approvals table. dataInvolved carries the FULL real scope
    // (and, for external sources, the full content) - never a summary,
    // per §15.5.
    const reason = sourceType === "authored"
      ? `Requests ${requestedTools.length} tool(s) and ${requestedIntegrationIds.length} Integration dependency(ies).`
      : `Imported from ${sourceType}${body.sourceUrl ? ` (${body.sourceUrl})` : ""}.`;
    const dataInvolved = JSON.stringify({
      requestedTools,
      requestedIntegrationIds,
      sourceType,
      sourceUrl: body.sourceUrl ?? null,
      sourceAuthor: body.sourceAuthor ?? null,
      content: sourceType === "authored" ? undefined : body.content ?? "",
    });
    const [approval] = await db
      .insert(approvalsTable)
      .values({
        action: `skill_set_install:${skillSet.id}`,
        requestingAgent: "user",
        reason,
        riskLevel: sourceType === "authored" ? "medium" : "high",
        dataInvolved,
      })
      .returning();

    res.status(201).json({ skillSet, approvalId: approval.id });
  } catch (err) {
    req.log.error({ err }, "Error creating skill set");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /:id/install — installs an existing catalog entry (status
 * 'available'), e.g. one of the seeded starter Skill Sets, or one
 * accepted from a §15.2 contextual suggestion. Distinct from POST /,
 * which creates a brand new Skill Set - this one only ever transitions
 * an existing row. Same gating decision as POST / (requiresHardGate()),
 * because installing a catalog item is still "installing a Skill Set"
 * per §15.3 - the fact that it was pre-authored by someone else doesn't
 * change whether it's requesting new tool/data access.
 */
router.post("/:id/install", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [skillSet] = await db.select().from(skillSetsTable).where(eq(skillSetsTable.id, id));
    if (!skillSet) { res.status(404).json({ error: "Skill set not found" }); return; }
    if (skillSet.status !== "available") { res.status(400).json({ error: `Skill set is not available to install (status: ${skillSet.status})` }); return; }

    const requestedTools = parseJsonArray(skillSet.requestedTools);
    const requestedIntegrationIds = parseJsonArray(skillSet.requestedIntegrationIds);
    const gated = requiresHardGate({ sourceType: skillSet.sourceType, requestedTools, requestedIntegrationIds });

    if (!gated) {
      const [updated] = await db
        .update(skillSetsTable)
        .set({ status: "installed", installedAt: new Date() })
        .where(eq(skillSetsTable.id, id))
        .returning();

      await db.insert(actionReceiptsTable).values({
        description: `Installed Skill Set "${updated.name}"`,
        category: "skill_set_install",
        scope: "local, no new tool/data access",
        outcome: "success",
        target: updated.name,
        canUndo: true,
      });

      res.status(201).json({ skillSet: updated, approvalId: null });
      return;
    }

    // Scope-affecting or externally-sourced: same hard-gate treatment as
    // POST / — the existing POST /:id/confirm-install below finishes the
    // job regardless of which route started it.
    const reason = skillSet.sourceType === "authored"
      ? `Requests ${requestedTools.length} tool(s) and ${requestedIntegrationIds.length} Integration dependency(ies).`
      : `Imported from ${skillSet.sourceType}${skillSet.sourceUrl ? ` (${skillSet.sourceUrl})` : ""}.`;
    const [approval] = await db
      .insert(approvalsTable)
      .values({
        action: `skill_set_install:${skillSet.id}`,
        requestingAgent: "user",
        reason,
        riskLevel: skillSet.sourceType === "authored" ? "medium" : "high",
        dataInvolved: JSON.stringify({
          requestedTools,
          requestedIntegrationIds,
          sourceType: skillSet.sourceType,
          sourceUrl: skillSet.sourceUrl,
          sourceAuthor: skillSet.sourceAuthor,
          content: skillSet.sourceType === "authored" ? undefined : skillSet.content,
        }),
      })
      .returning();

    const [pendingSkillSet] = await db
      .update(skillSetsTable)
      .set({ status: "pending" })
      .where(eq(skillSetsTable.id, id))
      .returning();

    res.status(201).json({ skillSet: pendingSkillSet, approvalId: approval.id });
  } catch (err) {
    req.log.error({ err }, "Error installing skill set from catalog");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:id/confirm-install — approves the linked approval, flips status to installed, writes the receipt.
router.post("/:id/confirm-install", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [skillSet] = await db.select().from(skillSetsTable).where(eq(skillSetsTable.id, id));
    if (!skillSet) { res.status(404).json({ error: "Skill set not found" }); return; }
    if (skillSet.status !== "pending") { res.status(400).json({ error: `Skill set is not pending (status: ${skillSet.status})` }); return; }

    const approvalId = req.body?.approvalId as number | undefined;
    if (approvalId) {
      await db.update(approvalsTable).set({ status: "approved", resolvedAt: new Date().toISOString() }).where(eq(approvalsTable.id, approvalId));
    }

    const [updated] = await db
      .update(skillSetsTable)
      .set({ status: "installed", installedAt: new Date() })
      .where(eq(skillSetsTable.id, id))
      .returning();

    await db.insert(actionReceiptsTable).values({
      description: `Installed Skill Set "${updated.name}"`,
      category: "skill_set_install",
      scope: JSON.stringify({ tools: updated.requestedTools, integrations: updated.requestedIntegrationIds }),
      outcome: "success",
      target: updated.name,
      canUndo: true,
      relatedApprovalId: approvalId ?? null,
    });

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error confirming skill set install");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:id/uninstall — always immediate and reversible per §15.4: no gate.
router.post("/:id/uninstall", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [updated] = await db
      .update(skillSetsTable)
      .set({ status: "uninstalled" })
      .where(eq(skillSetsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Skill set not found" }); return; }

    await db.insert(actionReceiptsTable).values({
      description: `Uninstalled Skill Set "${updated.name}"`,
      category: "skill_set_uninstall",
      scope: "local",
      outcome: "success",
      target: updated.name,
      canUndo: false,
    });

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error uninstalling skill set");
    res.status(500).json({ error: "Internal server error" });
  }
});

interface UpdateSkillSetBody {
  content?: string;
  requestedTools?: string[];
  requestedIntegrationIds?: string[];
}

/**
 * POST /:id/update — §15.4: only the scope delta re-triggers a hard
 * gate, not a full re-approval. A content-only edit (no scope change)
 * applies immediately.
 */
router.post("/:id/update", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [current] = await db.select().from(skillSetsTable).where(eq(skillSetsTable.id, id));
    if (!current) { res.status(404).json({ error: "Skill set not found" }); return; }

    const body = req.body as UpdateSkillSetBody;
    const nextTools = parseJsonArray(body.requestedTools ?? (current.requestedTools as string[]));
    const nextIntegrations = parseJsonArray(body.requestedIntegrationIds ?? (current.requestedIntegrationIds as string[]));
    const delta = diffScope(
      { requestedTools: current.requestedTools as string[], requestedIntegrationIds: current.requestedIntegrationIds as string[] },
      { requestedTools: nextTools, requestedIntegrationIds: nextIntegrations },
    );

    if (delta.isEmpty) {
      const [updated] = await db
        .update(skillSetsTable)
        .set({ content: body.content ?? current.content, requestedTools: nextTools, requestedIntegrationIds: nextIntegrations })
        .where(eq(skillSetsTable.id, id))
        .returning();
      await db.insert(actionReceiptsTable).values({
        description: `Updated Skill Set "${updated.name}"`,
        category: "skill_set_update",
        scope: "no new tool/data access",
        outcome: "success",
        target: updated.name,
        canUndo: false,
      });
      res.json({ skillSet: updated, approvalId: null });
      return;
    }

    // Gate only on the delta - the reason and dataInvolved name just the addition.
    const [approval] = await db
      .insert(approvalsTable)
      .values({
        action: `skill_set_update:${id}`,
        requestingAgent: "user",
        reason: `Update adds ${delta.addedTools.length} tool(s) and ${delta.addedIntegrationIds.length} Integration dependency(ies).`,
        riskLevel: "medium",
        dataInvolved: JSON.stringify(delta),
      })
      .returning();

    // Stash the pending content/scope on the row so confirm-update can apply it.
    await db.update(skillSetsTable).set({ content: body.content ?? current.content }).where(eq(skillSetsTable.id, id));

    res.json({ skillSet: current, approvalId: approval.id, pendingScope: { requestedTools: nextTools, requestedIntegrationIds: nextIntegrations } });
  } catch (err) {
    req.log.error({ err }, "Error updating skill set");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:id/confirm-update — approves the delta approval and applies the pending scope.
router.post("/:id/confirm-update", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { approvalId, requestedTools, requestedIntegrationIds } = req.body as {
      approvalId: number; requestedTools: string[]; requestedIntegrationIds: string[];
    };
    if (approvalId) {
      await db.update(approvalsTable).set({ status: "approved", resolvedAt: new Date().toISOString() }).where(eq(approvalsTable.id, approvalId));
    }
    const [updated] = await db
      .update(skillSetsTable)
      .set({ requestedTools: parseJsonArray(requestedTools), requestedIntegrationIds: parseJsonArray(requestedIntegrationIds) })
      .where(eq(skillSetsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Skill set not found" }); return; }

    await db.insert(actionReceiptsTable).values({
      description: `Updated Skill Set "${updated.name}" (scope expanded)`,
      category: "skill_set_update",
      scope: JSON.stringify({ tools: updated.requestedTools, integrations: updated.requestedIntegrationIds }),
      outcome: "success",
      target: updated.name,
      canUndo: false,
      relatedApprovalId: approvalId ?? null,
    });

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error confirming skill set update");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
