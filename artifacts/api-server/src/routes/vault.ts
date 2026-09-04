// Real, single-server encrypted secret store. `encryptedValue` (AES-256-GCM
// via lib/crypto.ts, the same primitive already used for API keys/OAuth
// tokens) is never returned by GET / or GET /:id — only GET /:id/reveal
// decrypts and returns it, and every reveal is logged.
//
// Still honestly future work, not built here — see vault.ts (schema)'s
// docblock: HSM support, zero-trust per-request auth, external
// secrets-manager integration all need real infrastructure decisions.

import { Router } from "express";
import { db } from "@workspace/db";
import { vaultItemsTable, vaultAccessLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/crypto.js";
import { assertEncryptionConfigured, validateNewVaultItem } from "../lib/vaultGuard.js";

const router = Router();

// Never selects encryptedValue — metadata only, safe to send to the frontend.
const PUBLIC_COLUMNS = {
  id: vaultItemsTable.id,
  name: vaultItemsTable.name,
  category: vaultItemsTable.category,
  permissionLevel: vaultItemsTable.permissionLevel,
  lastAccessed: vaultItemsTable.lastAccessed,
  owner: vaultItemsTable.owner,
  description: vaultItemsTable.description,
  status: vaultItemsTable.status,
  createdAt: vaultItemsTable.createdAt,
};

async function logAccess(vaultItemId: number, itemName: string, action: "created" | "viewed" | "updated" | "deleted") {
  await db.insert(vaultAccessLogTable).values({ vaultItemId, itemName, action });
}

router.get("/", async (req, res) => {
  try {
    const items = await db.select(PUBLIC_COLUMNS).from(vaultItemsTable).orderBy(vaultItemsTable.category);
    return res.json(items);
  } catch (err) {
    req.log.error({ err }, "Error fetching vault items");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, category, permissionLevel, owner, description, secretValue } = req.body as {
      name?: string; category?: string; permissionLevel?: string; owner?: string; description?: string; secretValue?: string;
    };
    validateNewVaultItem({ name, category, secretValue });

    const [item] = await db
      .insert(vaultItemsTable)
      .values({
        name: name!.trim(),
        category: category!.trim(),
        permissionLevel: permissionLevel?.trim() || "read",
        owner: owner?.trim() || "",
        description: description?.trim() || "",
        encryptedValue: encrypt(secretValue!.trim()),
      })
      .returning(PUBLIC_COLUMNS);

    await logAccess(item.id, item.name, "created");
    return res.status(201).json(item);
  } catch (err) {
    if (err instanceof Error && (err.message.startsWith("`") || err.message.includes("KHAMELEON_ENCRYPTION_KEY"))) {
      return res.status(400).json({ error: err.message });
    }
    req.log.error({ err }, "Error creating vault item");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/reveal", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(vaultItemsTable).where(eq(vaultItemsTable.id, id)).limit(1);
    if (!item) return res.status(404).json({ error: "Vault item not found" });

    const value = decrypt(item.encryptedValue);
    await db
      .update(vaultItemsTable)
      .set({ lastAccessed: new Date().toISOString() })
      .where(eq(vaultItemsTable.id, id));
    await logAccess(item.id, item.name, "viewed");
    return res.json({ value });
  } catch (err) {
    req.log.error({ err }, "Error revealing vault item");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, permissionLevel, owner, description, status, secretValue } = req.body as {
      name?: string; category?: string; permissionLevel?: string; owner?: string; description?: string; status?: string; secretValue?: string;
    };

    const patch: Partial<typeof vaultItemsTable.$inferInsert> = {};
    if (typeof name === "string" && name.trim()) patch.name = name.trim();
    if (typeof category === "string" && category.trim()) patch.category = category.trim();
    if (typeof permissionLevel === "string" && permissionLevel.trim()) patch.permissionLevel = permissionLevel.trim();
    if (typeof owner === "string") patch.owner = owner.trim();
    if (typeof description === "string") patch.description = description.trim();
    if (typeof status === "string" && status.trim()) patch.status = status.trim();
    if (typeof secretValue === "string" && secretValue.trim()) {
      assertEncryptionConfigured();
      patch.encryptedValue = encrypt(secretValue.trim());
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    const [updated] = await db.update(vaultItemsTable).set(patch).where(eq(vaultItemsTable.id, id)).returning(PUBLIC_COLUMNS);
    if (!updated) return res.status(404).json({ error: "Vault item not found" });

    await logAccess(updated.id, updated.name, "updated");
    return res.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message.includes("KHAMELEON_ENCRYPTION_KEY")) {
      return res.status(400).json({ error: err.message });
    }
    req.log.error({ err }, "Error updating vault item");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select(PUBLIC_COLUMNS).from(vaultItemsTable).where(eq(vaultItemsTable.id, id)).limit(1);
    if (!item) return res.status(404).json({ error: "Vault item not found" });

    // Logged before the delete — the log must outlive the row it's about.
    await logAccess(item.id, item.name, "deleted");
    await db.delete(vaultItemsTable).where(eq(vaultItemsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting vault item");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/access-log", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const log = await db
      .select()
      .from(vaultAccessLogTable)
      .where(eq(vaultAccessLogTable.vaultItemId, id))
      .orderBy(vaultAccessLogTable.createdAt);
    return res.json(log.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching vault access log");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
