/**
 * backend/src/agent/skills/publish.ts — publish a research as a live web page.
 *
 *   `publish_site` is the agent's "deploy" step (like a Claude Artifact / Lovable
 *   publish). It does NOT generate anything: the agent DESIGNS and WRITES the web
 *   page itself with write_file (its own HTML/CSS — there is no template), and THEN
 *   calls this to host the file it made at a stable public URL. Any local images
 *   the page references (figures/plots) are inlined so the hosted page is fully
 *   self-contained. Publishing is user-driven (offered/on request), never
 *   automatic. Re-calling re-publishes to the SAME url.
 */
import { promises as fs } from "node:fs";
import { dirname, join, extname } from "node:path";
import { z } from "zod";
import type { Skill } from "../types.ts";
import { resolveInWorkspace } from "../../services/workspace-fs.ts";
import { publishSite } from "../../services/sites.ts";
import { createArticle } from "../../services/articles.ts";
import { getResearch } from "../../services/researches.ts";

// Where published pages are reachable. Defaults to the API origin (the /sites/:id
// route is public, no auth). Override for a real deployment (REAGENT_PUBLIC_URL).
const PUBLIC_URL = (process.env.REAGENT_PUBLIC_URL || "http://localhost:8181").replace(/\/$/, "");
// Where the public article PAGE lives (the React /article/:id route on the SPA origin).
const APP_URL = (process.env.REAGENT_APP_URL || "http://localhost:5173").replace(/\/$/, "");

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

/** Inline local image references (src=…, href=…, url(…)) as base64 data URIs so the
 *  hosted snapshot is self-contained — the agent can author normal HTML with
 *  `figures/plot.png` paths and the published page still shows every diagram. */
async function inlineLocalImages(html: string, researchId: string, htmlRel: string): Promise<string> {
  const baseDir = dirname(htmlRel); // e.g. "outputs" — asset paths are relative to the HTML file
  const cache = new Map<string, string | null>();
  const dataUriFor = async (ref: string): Promise<string | null> => {
    const clean = ref.split(/[?#]/)[0].replace(/^\.?\//, "");
    const mime = IMG_MIME[extname(clean).toLowerCase()];
    if (!mime) return null;
    if (cache.has(ref)) return cache.get(ref)!;
    // Resolve against BOTH the HTML file's folder AND the workspace root. The
    // agent writes site.html in outputs/ but figures live at figures/ (root),
    // so `figures/x.png` must resolve to <root>/figures/x.png — not
    // outputs/figures/x.png. Try the HTML-relative path first, then the root.
    const candidates = [join(baseDir, clean), clean];
    let uri: string | null = null;
    for (const rel of candidates) {
      try {
        const buf = await fs.readFile(resolveInWorkspace(researchId, rel));
        uri = `data:${mime};base64,${buf.toString("base64")}`;
        break;
      } catch {
        /* try the next candidate */
      }
    }
    cache.set(ref, uri); // may be null — then the reference is left untouched
    return uri;
  };

  // Collect every distinct local reference, resolve to data URIs, then substitute.
  const refs = new Set<string>();
  const patterns = [/(?:src|href)\s*=\s*["']([^"']+)["']/gi, /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi];
  for (const re of patterns) {
    for (const m of html.matchAll(re)) if (isLocalRef(m[1])) refs.add(m[1]);
  }
  for (const ref of refs) {
    const uri = await dataUriFor(ref);
    if (uri) html = html.split(ref).join(uri);
  }
  return html;
}

export const publishSkills: Skill[] = [
  {
    slug: "publish_site",
    category: "compute",
    description:
      "Publish a web page YOU HAVE AUTHORED as a LIVE, shareable URL (like a Claude Artifact / Lovable deploy). " +
      "This tool only HOSTS a page — it does not generate one. Design and write the site yourself first with write_file " +
      "(a full HTML document with inline <style> CSS and <img src=\"figures/…\"> for your diagrams), then call this with " +
      "the file's path (default outputs/site.html). Local images the page references (figures/) are embedded so the " +
      "hosted page is self-contained. Only publish when the user asks for a website / says yes to one — never " +
      "automatically. Re-calling re-publishes to the SAME url. Returns the live link (also shown in Reports & Results).",
    inputSchema: z.object({
      path: z.string().optional().describe("The HTML file you created to publish (default: outputs/site.html)."),
      title: z.string().optional().describe("Page title / label (default: the research title)."),
    }),
    run: async (args, ctx) => {
      if (!ctx.researchId) return "No active research — publishing needs a workspace.";
      const research = getResearch(ctx.researchId);
      const rel = String(args.path || "outputs/site.html");
      const title = String(args.title || research?.title || "Research");

      let html: string;
      try {
        html = await fs.readFile(resolveInWorkspace(ctx.researchId, rel), "utf8");
      } catch {
        return (
          `No web page found at ${rel}. Design and WRITE the site first, then call publish_site again:\n` +
          `  write_file("${rel}", "<!doctype html><html>…the full page you built: inline <style> CSS, your ` +
          `findings, and <img src=\\"figures/plot.png\\"> for each diagram…</html>")`
        );
      }
      if (!/<[a-z!]/i.test(html)) return `${rel} doesn't look like HTML. Write the web page there first, then publish.`;

      html = await inlineLocalImages(html, ctx.researchId, rel);
      const site = publishSite(ctx.researchId, title, html);
      const url = `${PUBLIC_URL}/sites/${site.id}`;
      return (
        `Published "${title}" as a live web page: ${url}\n` +
        `(${site.bytes.toLocaleString()} bytes, images embedded. Re-run publish_site to update this same URL. ` +
        `It's also available from Reports & Results.)`
      );
    },
  },
  {
    slug: "create_article",
    category: "compute",
    description:
      "Turn this research into a shareable ARTICLE — a blog-style write-up (like an engineering post). " +
      "FIRST write the article body yourself with write_file as Markdown (default outputs/article.md — a " +
      "narrative with a strong opening, ## sections, prose, and ![alt](figures/…) for any figures), then call " +
      "this with a `title` and a one-line `subtitle`. It saves a DRAFT owned by the user (attributed to their " +
      "name); it is NOT public. The user reviews it under 'My Articles' and publishes it themselves to make it " +
      "live at /article/:id. ONLY do this when the user asks you to write/publish an article — never " +
      "automatically. Each call creates a NEW article.",
    inputSchema: z.object({
      title: z.string().describe("The article headline / title."),
      subtitle: z.string().optional().describe("A one-line dek/summary shown under the title."),
      path: z.string().optional().describe("The Markdown file you wrote the article body to (default outputs/article.md)."),
    }),
    run: async (args, ctx) => {
      if (!ctx.researchId) return "No active research — an article is written from a research.";
      const rel = String(args.path || "outputs/article.md");
      let md: string;
      try {
        md = await fs.readFile(resolveInWorkspace(ctx.researchId, rel), "utf8");
      } catch {
        return (
          `No article file at ${rel}. Write the article body there FIRST (Markdown), then call create_article again:\n` +
          `  write_file("${rel}", "# Title\\n\\nYour article — ## sections, prose, ![alt](figures/plot.png) for figures…")`
        );
      }
      if (!md.trim()) return `${rel} is empty. Write the article body there first, then create the article.`;
      // Store the raw Markdown as-is (figures/… paths). The article routes resolve those
      // workspace images at SERVE time (services/articles.ts inlineArticleImages), so every
      // article renders its figures without per-article processing.
      const article = createArticle(ctx.researchId, String(args.title), String(args.subtitle || ""), md);
      if (!article.userId) {
        return "Saved a draft, but this research has no owner account, so it can't be attributed to a user or published (sign-in-owned researches only).";
      }
      return (
        `Drafted the article "${article.title}" for ${article.authorName || "the user"} (${article.bytes.toLocaleString()} bytes of Markdown). ` +
        `It is a DRAFT — private, only the user can see it under "My Articles". Tell them to review it there and click ` +
        `Publish to make it live at ${APP_URL}/article/${article.id}. It is NOT public yet.`
      );
    },
  },
];
