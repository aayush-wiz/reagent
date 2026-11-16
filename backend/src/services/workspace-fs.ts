/**
 * backend/src/services/workspace-fs.ts — the per-research compute workspace.
 *
 *   openscience's file/shell tools operate on a project working directory. We
 *   give each research the same thing: a real directory on disk where the agent
 *   reads/writes data, runs scripts, and saves figures. Everything the file and
 *   exec tools do is confined to this directory (path-traversal guarded), so the
 *   agent can't touch the rest of the machine through those tools.
 */
import { mkdirSync } from "node:fs";
import { resolve, join, sep, isAbsolute } from "node:path";
import { env } from "../env.ts";

// Root for all research workspaces. Sibling of the SQLite data dir by default.
const ROOT = resolve(process.env.WORKSPACES_DIR || "./data/workspaces");

/** Absolute path to a research's working directory (created on first use). */
export function workspaceDir(researchId: string): string {
  if (!researchId || /[^a-zA-Z0-9_-]/.test(researchId)) throw new Error("invalid research id");
  const dir = join(ROOT, researchId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Resolve a path the agent supplied to an absolute path INSIDE the research's
 * working directory. Throws if the path escapes the workspace (../, absolute
 * paths outside, symlink-ish tricks are blocked by the prefix check).
 */
export function resolveInWorkspace(researchId: string, relPath: string): string {
  const root = workspaceDir(researchId);
  const p = isAbsolute(relPath) ? resolve(relPath) : resolve(root, relPath);
  if (p !== root && !p.startsWith(root + sep)) {
    throw new Error(`path "${relPath}" is outside the research workspace`);
  }
  return p;
}

/** A short display path relative to the workspace root (for tool output). */
export function relPath(researchId: string, absPath: string): string {
  const root = workspaceDir(researchId);
  return absPath === root ? "." : absPath.slice(root.length + 1);
}
