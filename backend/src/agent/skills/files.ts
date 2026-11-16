/**
 * backend/src/agent/skills/files.ts — the agent's file tools.
 *
 *   Native Node equivalents of openscience's read / write / edit / ls / glob /
 *   grep, operating inside the per-research working directory
 *   (services/workspace-fs). Same capabilities, no Bun runtime. Every path is
 *   resolved through resolveInWorkspace so the agent stays inside its sandbox.
 */
import { promises as fs } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";
import type { Skill } from "../types.ts";
import { resolveInWorkspace, relPath, workspaceDir } from "../../services/workspace-fs.ts";

const humanBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`;

function needResearch(ctx: { researchId?: string }): string {
  if (!ctx.researchId) throw new Error("No active research — file tools need a workspace.");
  return ctx.researchId;
}

// Convert a glob (*, **, ?) to a RegExp anchored to a relative path.
function globToRe(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if ("+.^${}()|[]\\".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
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
    if (e.name === "node_modules" || e.name === ".git") continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(root, r)));
    else out.push(r);
  }
  return out;
}

const isProbablyText = (name: string) => !/\.(png|jpe?g|gif|pdf|zip|gz|parquet|npy|bin|so|dylib|woff2?)$/i.test(name);

export const fileSkills: Skill[] = [
  {
    slug: "read_file",
    category: "files",
    description: "Read a file from the research working directory. Returns its text content (with line numbers for code).",
    inputSchema: z.object({ path: z.string().describe("Path relative to the workspace, e.g. 'analysis.py' or 'data/effects.csv'.") }),
    run: async (args, ctx) => {
      const rid = needResearch(ctx);
      const abs = resolveInWorkspace(rid, String(args.path));
      try {
        const text = await fs.readFile(abs, "utf8");
        return text.length > 60000 ? text.slice(0, 60000) + "\n… (truncated)" : text;
      } catch {
        return `No such file: ${args.path}`;
      }
    },
  },
  {
    slug: "write_file",
    category: "files",
    description: "Create or overwrite a file in the research working directory (parent dirs are created). Use for scripts, data, and results.",
    inputSchema: z.object({
      path: z.string().describe("Path relative to the workspace."),
      content: z.string().describe("Full file content."),
    }),
    run: async (args, ctx) => {
      const rid = needResearch(ctx);
      const abs = resolveInWorkspace(rid, String(args.path));
      await fs.mkdir(dirname(abs), { recursive: true });
      await fs.writeFile(abs, String(args.content), "utf8");
      return `Wrote ${relPath(rid, abs)} (${String(args.content).length} bytes).`;
    },
  },
  {
    slug: "edit_file",
    category: "files",
    description: "Replace an exact string in a file (like a targeted edit). `old` must appear exactly once unless `all` is true.",
    inputSchema: z.object({
      path: z.string(),
      old: z.string().describe("The exact text to replace."),
      new: z.string().describe("The replacement text."),
      all: z.boolean().optional().describe("Replace all occurrences (default false)."),
    }),
    run: async (args, ctx) => {
      const rid = needResearch(ctx);
      const abs = resolveInWorkspace(rid, String(args.path));
      let text: string;
      try {
        text = await fs.readFile(abs, "utf8");
      } catch {
        return `No such file: ${args.path}`;
      }
      const oldS = String(args.old);
      const count = text.split(oldS).length - 1;
      if (count === 0) return `The text to replace was not found in ${args.path}.`;
      if (count > 1 && !args.all) return `The text appears ${count} times in ${args.path}. Pass all:true or make it unique.`;
      const next = args.all ? text.split(oldS).join(String(args.new)) : text.replace(oldS, String(args.new));
      await fs.writeFile(abs, next, "utf8");
      return `Edited ${relPath(rid, abs)} (${count} replacement${count > 1 ? "s" : ""}).`;
    },
  },
  {
    slug: "list_files",
    category: "files",
    description: "List files in the research working directory (recursive). Optional subdirectory `path`.",
    inputSchema: z.object({ path: z.string().optional().describe("Subdirectory to list (default: whole workspace).") }),
    run: async (args, ctx) => {
      const rid = needResearch(ctx);
      const root = args.path ? resolveInWorkspace(rid, String(args.path)) : workspaceDir(rid);
      const files = await walk(root);
      if (!files.length) return "(workspace is empty)";
      return files.sort().join("\n");
    },
  },
  {
    slug: "glob_files",
    category: "files",
    description: "Find files by glob pattern (e.g. '**/*.py', 'figures/*.png') in the research working directory.",
    inputSchema: z.object({ pattern: z.string().describe("Glob pattern, e.g. '**/*.csv'.") }),
    run: async (args, ctx) => {
      const rid = needResearch(ctx);
      const re = globToRe(String(args.pattern));
      const files = (await walk(workspaceDir(rid))).filter((f) => re.test(f));
      return files.length ? files.sort().join("\n") : `No files match ${args.pattern}.`;
    },
  },
  {
    slug: "grep_files",
    category: "files",
    description: "Search file contents by regex in the research working directory. Returns matching lines with file:line.",
    inputSchema: z.object({
      pattern: z.string().describe("Regular expression to search for."),
      glob: z.string().optional().describe("Only search files matching this glob (e.g. '*.py')."),
    }),
    run: async (args, ctx) => {
      const rid = needResearch(ctx);
      const root = workspaceDir(rid);
      let re: RegExp;
      try {
        re = new RegExp(String(args.pattern));
      } catch (e) {
        return `Invalid regex: ${e instanceof Error ? e.message : String(e)}`;
      }
      const globRe = args.glob ? globToRe(String(args.glob)) : null;
      const files = (await walk(root)).filter((f) => isProbablyText(f) && (!globRe || globRe.test(f)));
      const hits: string[] = [];
      for (const f of files) {
        let text: string;
        try {
          text = await fs.readFile(join(root, f), "utf8");
        } catch {
          continue;
        }
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i])) {
            hits.push(`${f}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
            if (hits.length >= 200) return hits.join("\n") + "\n… (truncated at 200 matches)";
          }
        }
      }
      return hits.length ? hits.join("\n") : `No matches for /${args.pattern}/.`;
    },
  },
  {
    slug: "import_file",
    category: "files",
    description:
      "THE way to bring an MCP server's output files into this research's workspace. Copies a file (or whole " +
      "directory) from an ABSOLUTE host path — figures, tables, logs, ANY type including binaries like " +
      "PNG/PDF/parquet — so they appear in the research's Files. Give it the absolute path an MCP tool " +
      "reported (e.g. from `<server>__get_results` or `<server>__list_files`). Bytes are copied on disk " +
      "directly, never through the chat, so it is INSTANT, has NO size limit, and never corrupts a binary. " +
      "ALWAYS use this for a file that exists on the host (every local MCP such as SAIGE). NEVER read a file " +
      "as base64 and re-save it: routing a file's bytes through the model is slow and FAILS on anything but a " +
      "few KB (the model emits empty tool arguments). Import a whole run's outputs by pointing `source` at its directory.",
    inputSchema: z.object({
      source: z.string().describe("Absolute host path to the file or directory to copy in (as reported by an MCP tool, e.g. '/Users/.../runs/xyz/plots/manhattan.png')."),
      dest: z.string().optional().describe("Destination path inside the workspace (default: same file/dir name at the workspace root, e.g. 'manhattan.png'). Use subfolders like 'results/manhattan.png' to organize."),
    }),
    run: async (args, ctx) => {
      const rid = needResearch(ctx);
      const src = resolve(String(args.source));
      let st: Awaited<ReturnType<typeof fs.stat>>;
      try {
        st = await fs.stat(src);
      } catch {
        return `No such source path on host: ${src}`;
      }
      const dest = String(args.dest || basename(src));
      const abs = resolveInWorkspace(rid, dest);
      await fs.mkdir(dirname(abs), { recursive: true });
      if (st.isDirectory()) {
        await fs.cp(src, abs, { recursive: true });
        return `Imported directory ${src} → ${relPath(rid, abs)}/.`;
      }
      await fs.copyFile(src, abs);
      return `Imported ${relPath(rid, abs)} (${humanBytes(st.size)}) from ${src}.`;
    },
  },
  {
    slug: "save_base64_file",
    category: "files",
    description:
      "NARROW fallback: decode a base64 string into the workspace as raw bytes. Use ONLY for a TINY " +
      "(≲8 KB) binary a REMOTE MCP handed back as base64 that does NOT exist on this host. For ANY file on " +
      "the host — every local MCP such as SAIGE — use `import_file` with the file's path instead. Do NOT " +
      "base64-round-trip a large file: the model cannot reliably emit a big base64 argument (it sends empty " +
      "args and the call fails). If a file is more than a few KB, it belongs in `import_file`, not here.",
    inputSchema: z.object({
      path: z.string().describe("Destination path inside the workspace, e.g. 'results/qq_plot.png'."),
      content_base64: z.string().describe("The file's contents, base64-encoded."),
    }),
    run: async (args, ctx) => {
      const rid = needResearch(ctx);
      const abs = resolveInWorkspace(rid, String(args.path));
      let buf: Buffer;
      try {
        buf = Buffer.from(String(args.content_base64), "base64");
      } catch {
        return "content_base64 is not valid base64.";
      }
      if (!buf.length) return "Decoded content is empty — check the base64 string.";
      await fs.mkdir(dirname(abs), { recursive: true });
      await fs.writeFile(abs, buf);
      return `Saved ${relPath(rid, abs)} (${humanBytes(buf.length)}).`;
    },
  },
];
