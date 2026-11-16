/**
 * backend/src/services/articles.ts — user-owned, shareable articles.
 *
 *   An article is a blog-style write-up the agent produces FROM a research (only
 *   on the user's request) that the USER owns. Unlike `sites` (one per research),
 *   articles belong to the user: a user can generate MANY, from ANY of their
 *   researches. Each create makes a NEW draft; the user reviews it in "My
 *   Articles" and publishes it to go live at /article/:id (attributed to them).
 */
import { promises as fs } from "node:fs";
import { join, extname } from "node:path";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../repositories/db-client.ts";
import { articles, researches, users } from "../models/schema.ts";
import { resolveInWorkspace } from "./workspace-fs.ts";

export function getArticle(id: string) {
  return db.select().from(articles).where(eq(articles.id, id)).get();
}

export function listArticlesByUser(userId: string) {
  return db.select().from(articles).where(eq(articles.userId, userId)).orderBy(desc(articles.createdAt)).all();
}

/** Every PUBLISHED article across ALL users, newest first — the public gallery. */
export function listPublicArticles() {
  return db.select().from(articles).where(eq(articles.status, "public")).orderBy(desc(articles.publishedAt)).all();
}

/** The display name of a research's owner — the article's author. */
function ownerOf(researchId: string): { userId: string | null; authorName: string } {
  const r = db.select().from(researches).where(eq(researches.id, researchId)).get();
  if (!r?.userId) return { userId: null, authorName: "" };
  const u = db.select().from(users).where(eq(users.id, r.userId)).get();
  return { userId: r.userId, authorName: (u?.name || u?.email || "").trim() };
}

/** Create a NEW draft article owned by the research's owner. Each call = a new article. */
export function createArticle(researchId: string, title: string, subtitle: string, contentMd: string) {
  const { userId, authorName } = ownerOf(researchId);
  const id = `article_${nanoid(10)}`;
  const now = Date.now();
  db.insert(articles)
    .values({
      id,
      userId,
      researchId,
      authorName,
      title: title || "Untitled",
      subtitle: subtitle || "",
      contentMd,
      status: "draft",
      bytes: Buffer.byteLength(contentMd, "utf8"),
      createdAt: now,
      publishedAt: null,
      updatedAt: now,
    })
    .run();
  return getArticle(id)!;
}

/** Flip visibility (draft ⇄ public). Owner-guarded — null if not the owner. */
export function setArticleStatus(id: string, userId: string, status: "draft" | "public") {
  const a = getArticle(id);
  if (!a || a.userId !== userId) return null;
  db.update(articles)
    .set({
      status,
      publishedAt: status === "public" ? (a.publishedAt ?? Date.now()) : a.publishedAt,
      updatedAt: Date.now(),
    })
    .where(eq(articles.id, id))
    .run();
  return getArticle(id)!;
}

/** Delete one of the user's own articles. Owner-guarded. */
export function deleteArticle(id: string, userId: string): boolean {
  const a = getArticle(id);
  if (!a || a.userId !== userId) return false;
  db.delete(articles).where(eq(articles.id, id)).run();
  return true;
}

const IMG_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
};
const isLocalRef = (u: string) => !!u && !/^(https?:|data:|#|mailto:|blob:|\/\/)/i.test(u);

/** Ordered, de-duped local image refs from Markdown `![..](x)` and `<img src="x">`. */
export function localImageRefs(md: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    if (isLocalRef(u) && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  };
  for (const m of md.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)) push(m[1]);
  for (const m of md.matchAll(/<img[^>]+src\s*=\s*["']([^"']+)["']/gi)) push(m[1]);
  return out;
}

/** Read one local image ref from a research workspace (tries root and `outputs/`). */
export async function readFigure(researchId: string, ref: string): Promise<{ buf: Buffer; mime: string } | null> {
  const clean = ref.split(/[?#]/)[0].replace(/^\.?\//, "");
  const mime = IMG_MIME[extname(clean).toLowerCase()];
  if (!mime) return null;
  for (const rel of [clean, join("outputs", clean)]) {
    try {
      const buf = await fs.readFile(resolveInWorkspace(researchId, rel));
      return { buf, mime };
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/** The FIRST workspace figure an article references that actually exists on disk. */
export async function firstArticleImage(researchId: string | null, md: string): Promise<{ buf: Buffer; mime: string } | null> {
  if (!researchId || !md) return null;
  for (const ref of localImageRefs(md)) {
    const fig = await readFigure(researchId, ref);
    if (fig) return fig;
  }
  return null;
}

/**
 * Embed a research's local figure images referenced in the article's Markdown as
 * base64 data URIs — done at SERVE time so EVERY article renders its workspace
 * figures, however/whenever it was created (no per-article step, no stored copies).
 * Each `figures/…` path is tried at the workspace root and under `outputs/`.
 */
export async function inlineArticleImages(researchId: string | null, md: string): Promise<string> {
  if (!researchId || !md) return md;
  for (const ref of localImageRefs(md)) {
    const fig = await readFigure(researchId, ref);
    if (fig) md = md.split(ref).join(`data:${fig.mime};base64,${fig.buf.toString("base64")}`);
  }
  return md;
}

// FNV-1a — a stable 32-bit hash so an article's generated cover never changes.
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A deterministic, self-contained SVG cover for an article that has no figure of
 * its own — a "molecular graph" of nodes + edges over a two-tone gradient, its
 * hue derived from the article id. Universal: no external image model, no stored
 * asset, identical every render, and distinct per article.
 */
export function coverSvg(seed: string): string {
  const h = hashSeed(seed) || 1;
  const hue = h % 360;
  const hueB = (hue + 44) % 360;
  // A tiny LCG seeded by the hash → deterministic node positions.
  let s = h;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const W = 1200;
  const H = 750;
  const nodes = Array.from({ length: 12 }, () => ({
    x: 90 + rnd() * (W - 180),
    y: 90 + rnd() * (H - 180),
    r: 4 + rnd() * 15,
  }));
  let edges = "";
  for (let i = 0; i < nodes.length; i++) {
    const j = (i + 1 + Math.floor(rnd() * 3)) % nodes.length;
    edges += `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" stroke="rgba(255,255,255,0.26)" stroke-width="1.6"/>`;
  }
  const dots = nodes
    .map((n) => `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.r.toFixed(1)}" fill="rgba(255,255,255,0.92)"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue}, 46%, 33%)"/><stop offset="1" stop-color="hsl(${hueB}, 58%, 19%)"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><g>${edges}${dots}</g></svg>`;
}
