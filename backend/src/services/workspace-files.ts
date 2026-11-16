/**
 * backend/src/services/workspace-files.ts — read the real files the agent
 * produces in a research's compute workspace (data/workspaces/<researchId>).
 *
 *   This is what the Outputs panel now shows instead of seeded demo rows:
 *   images → Charts, csv/tsv/parquet → Tables, everything else → Files. The
 *   markdown "Docs" come from the documents table, not here.
 */
import { promises as fs } from "node:fs";
import { join, extname, basename } from "node:path";
import { workspaceDir, resolveInWorkspace, relPath } from "./workspace-fs.ts";

const RAW_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".json": "application/json",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".html": "text/html",
  ".zip": "application/zip",
};

export type FileCategory = "chart" | "table" | "file";

export interface WorkspaceFile {
  path: string;
  size: number;
  ext: string;
  category: FileCategory;
  updatedAt: number;
}

const IMAGE = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]);
const TABLE = new Set([".csv", ".tsv", ".parquet"]);
const HIDDEN = new Set(["_run.py"]); // internal scratch from run_python

function categorize(ext: string): FileCategory {
  if (IMAGE.has(ext)) return "chart";
  if (TABLE.has(ext)) return "table";
  return "file";
}

async function walk(root: string, rel = ""): Promise<string[]> {
  const abs = rel ? join(root, rel) : root;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name.startsWith(".")) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(root, r)));
    else if (!HIDDEN.has(e.name)) out.push(r);
  }
  return out;
}

export async function listWorkspaceFiles(researchId: string): Promise<WorkspaceFile[]> {
  const root = workspaceDir(researchId);
  const files = await walk(root);
  const out: WorkspaceFile[] = [];
  for (const p of files) {
    try {
      const st = await fs.stat(join(root, p));
      const ext = extname(p).toLowerCase();
      out.push({ path: p, size: st.size, ext, category: categorize(ext), updatedAt: st.mtimeMs });
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Read a workspace file: text as-is, images as base64 data URIs. */
export async function readWorkspaceFile(
  researchId: string,
  path: string,
): Promise<{ path: string; kind: "text" | "image"; content: string; mime: string } | null> {
  const abs = resolveInWorkspace(researchId, path);
  const ext = extname(path).toLowerCase();
  try {
    if (IMAGE.has(ext)) {
      const mime =
        ext === ".svg" ? "image/svg+xml" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".gif" ? "image/gif" : ext === ".webp" ? "image/webp" : "image/png";
      // SVG is text; render it inline. Raster images → base64 data URI.
      if (ext === ".svg") return { path: relPath(researchId, abs), kind: "image", content: await fs.readFile(abs, "utf8"), mime };
      const buf = await fs.readFile(abs);
      return { path: relPath(researchId, abs), kind: "image", content: `data:${mime};base64,${buf.toString("base64")}`, mime };
    }
    const text = await fs.readFile(abs, "utf8");
    const mime = ext === ".json" ? "application/json" : ext === ".md" ? "text/markdown" : "text/plain";
    return { path: relPath(researchId, abs), kind: "text", content: text.slice(0, 200_000), mime };
  } catch {
    return null;
  }
}

/** Read a workspace file as raw bytes (binary-safe) — for downloading PDFs etc. */
export async function readWorkspaceFileRaw(
  researchId: string,
  path: string,
): Promise<{ buffer: Buffer; mime: string; name: string } | null> {
  const abs = resolveInWorkspace(researchId, path);
  const ext = extname(path).toLowerCase();
  try {
    const buffer = await fs.readFile(abs);
    return { buffer, mime: RAW_MIME[ext] ?? "application/octet-stream", name: basename(abs) };
  } catch {
    return null;
  }
}
