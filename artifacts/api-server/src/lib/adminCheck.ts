import type { Request } from "express";
import { accountsEnabled, getUserById } from "./accounts.js";
import { currentUserId } from "./session.js";

/**
 * May this request change organisation-wide settings (e.g. the Microsoft
 * app details)? With team accounts on, only admins may; without them,
 * Khameleon has a single user, who is its admin.
 */
export async function isAdminRequest(req: Request): Promise<boolean> {
  if (!(await accountsEnabled().catch(() => false))) return true;
  const id = currentUserId(req);
  const user = id !== undefined ? await getUserById(id) : undefined;
  return !!user?.isAdmin;
}
