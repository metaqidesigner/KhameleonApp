/**
 * Real user accounts (hosted/managed mode "Option B" - see
 * khameleon-decisions-log.md, 2026-10-03). Password hashing mirrors
 * crypto.ts's existing scrypt KDF pattern - same built-in Node primitive,
 * no new dependency - but with a real random salt PER PASSWORD, not
 * crypto.ts's one fixed, shared salt (that's fine for deriving a single
 * server-wide master key from one operator secret; it would be a real
 * vulnerability for user passwords, which need independent salts so two
 * users with the same password don't produce the same hash and so
 * precomputed/rainbow-table attacks don't work across accounts).
 *
 * Deliberately NOT bcrypt/argon2: this codebase already has zero extra
 * crypto dependencies (crypto.ts's own docblock calls that out as
 * intentional), and Node's built-in scrypt is a real, modern, memory-hard
 * KDF - adding a dependency here for marginal benefit would break that
 * pattern for no real gain at this app's scale.
 */

import crypto from "node:crypto";
import { db, usersTable, oauthTokensTable, type User, type PublicUser, toPublicUser } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { logger } from "./logger.js";

const SALT_LENGTH = 16;
const HASH_LENGTH = 64;

function hashPassword(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, HASH_LENGTH);
}

/** Format: "<saltHex>:<hashHex>" - the salt travels with the hash, as usual for this kind of KDF. Exported for direct, DB-free unit testing. */
export function encodePasswordHash(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = hashPassword(password, salt);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** Exported for direct, DB-free unit testing. */
export function verifyPasswordHash(password: string, encoded: string): boolean {
  const [saltHex, hashHex] = encoded.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = hashPassword(password, salt);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/** True the moment any account exists - this is what flips the whole app from Option A (shared password) to Option B (real per-user login). Checked on every session-status request, so keep this cheap. */
export async function accountsEnabled(): Promise<boolean> {
  const [row] = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  return !!row;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.trim().toLowerCase()))
    .limit(1);
  return row;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return row;
}

/**
 * Creates a new account. The very first account ever created on an
 * instance becomes its admin - a simple, honest convention given no real
 * invite/role system exists (see khameleon-decisions-log.md, 2026-10-03):
 * whoever sets accounts mode up first is the one managing it.
 */
export async function createUser(email: string, password: string, displayName: string): Promise<PublicUser> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) throw new Error("A valid email is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const existing = await getUserByEmail(normalizedEmail);
  if (existing) throw new Error("An account with this email already exists.");

  const isFirstAccount = !(await accountsEnabled());
  const [row] = await db
    .insert(usersTable)
    .values({
      email: normalizedEmail,
      passwordHash: encodePasswordHash(password),
      displayName: displayName.trim(),
      isAdmin: isFirstAccount,
    })
    .returning();

  if (isFirstAccount) {
    await backfillOwnershipToFirstAccount(row.id);
  }

  return toPublicUser(row);
}

/**
 * Real two-phase migration, run automatically rather than as a manual
 * operator step (khameleon-decisions-log.md, 2026-10-03 - no migration-file
 * mechanism exists in this repo, so this runs at the one moment it's
 * actually needed: the instant accounts mode turns on). Any oauth_tokens
 * row that predates accounts mode (userId IS NULL - the previous single
 * global connection) is reassigned to the new admin, the only honest
 * default when no real per-row ownership data exists. Idempotent and safe
 * to extend: later phases (vault_items, API keys) add their own backfill
 * here rather than a separate script nobody will remember to run.
 */
async function backfillOwnershipToFirstAccount(adminUserId: number): Promise<void> {
  const result = await db
    .update(oauthTokensTable)
    .set({ userId: adminUserId })
    .where(isNull(oauthTokensTable.userId));
  logger.info({ adminUserId, rowCount: result.rowCount }, "accounts.ts: backfilled pre-existing oauth_tokens rows to the first admin account");
}

/** Returns the authenticated user, or null for a wrong email/password/inactive account - never distinguishes which, to avoid leaking which emails are registered. */
export async function verifyLogin(email: string, password: string): Promise<PublicUser | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.active) return null;
  if (!verifyPasswordHash(password, user.passwordHash)) return null;
  return toPublicUser(user);
}

export async function listUsers(): Promise<PublicUser[]> {
  const rows = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  return rows.map(toPublicUser);
}

export async function setUserActive(id: number, active: boolean): Promise<void> {
  await db.update(usersTable).set({ active }).where(eq(usersTable.id, id));
}
