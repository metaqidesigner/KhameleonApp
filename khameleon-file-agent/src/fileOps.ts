import * as fs from "fs/promises";
import * as path from "path";
import { assertWithinRoot } from "./safety";
import { FileEntry } from "./types";

const TRASH_DIRNAME = ".khameleon-trash";

/**
 * All file operations Khameleon can take are scoped to one root folder
 * (typically a folder the user explicitly granted access to). Every
 * method resolves its path through assertWithinRoot() first — there is
 * no method here that can touch anything outside `root`.
 */
export class FileOps {
  constructor(private root: string) {}

  async listDirectory(relativeDir = "."): Promise<FileEntry[]> {
    const dir = assertWithinRoot(this.root, relativeDir);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.name !== TRASH_DIRNAME)
      .map((e) => ({
        path: path.join(dir, e.name),
        name: e.name,
        isDirectory: e.isDirectory(),
      }));
  }

  async createFolder(relativePath: string): Promise<string> {
    const target = assertWithinRoot(this.root, relativePath);
    await fs.mkdir(target, { recursive: true });
    return target;
  }

  async copyFile(relativeSrc: string, relativeDest: string): Promise<string> {
    const src = assertWithinRoot(this.root, relativeSrc);
    const dest = assertWithinRoot(this.root, relativeDest);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    return dest;
  }

  async moveFile(relativeSrc: string, relativeDest: string): Promise<string> {
    const src = assertWithinRoot(this.root, relativeSrc);
    const dest = assertWithinRoot(this.root, relativeDest);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(src, dest);
    return dest;
  }

  /**
   * Default "delete": moves the file into a hidden trash folder inside
   * the same root, timestamped to avoid collisions, instead of unlinking
   * it. Recoverable by design — an agent acting autonomously should not
   * be able to make an unrecoverable mistake by default.
   */
  async moveToTrash(relativePath: string): Promise<string> {
    const src = assertWithinRoot(this.root, relativePath);
    const trashDir = assertWithinRoot(this.root, TRASH_DIRNAME);
    await fs.mkdir(trashDir, { recursive: true });

    const stamped = `${Date.now()}-${path.basename(src)}`;
    const dest = path.join(trashDir, stamped);
    await fs.rename(src, dest);
    return dest;
  }

  /**
   * Genuinely permanent delete. Requires the caller to explicitly opt in
   * — never wired to a voice/text command by default (see commands.ts).
   */
  async deletePermanently(relativePath: string, confirm: true): Promise<void> {
    if (confirm !== true) {
      throw new Error("deletePermanently requires an explicit confirm=true.");
    }
    const target = assertWithinRoot(this.root, relativePath);
    await fs.rm(target, { recursive: true, force: true });
  }

  async exists(relativePath: string): Promise<boolean> {
    const target = assertWithinRoot(this.root, relativePath);
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }
}
