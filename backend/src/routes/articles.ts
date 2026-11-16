/**
 * routes/articles.ts — user-owned, shareable articles.
 *
 *   GET    /api/public/articles/:id   → PUBLIC article JSON (no auth — exempt via
 *                                       PUBLIC_PREFIXES in middlewares/auth.ts).
 *                                       Only a PUBLISHED article is returned; drafts 404.
 *   GET    /api/articles              → the authed user's own articles (draft + public).
 *   GET    /api/articles/:id          → one of the user's own articles (incl. draft — preview).
 *   POST   /api/articles/:id/publish  → make it public (live at /article/:id).
 *   POST   /api/articles/:id/unpublish→ back to draft (private).
 *   DELETE /api/articles/:id          → delete it.
 *
 *   Ownership is enforced in the service (userId match → 404 on mismatch).
 */
import type { Hono } from "hono";
import {
  getArticle,
  listArticlesByUser,
  listPublicArticles,
  setArticleStatus,
  deleteArticle,
  inlineArticleImages,
  firstArticleImage,
  coverSvg,
} from "../services/articles.ts";

// Where the public article PAGE lives (the React route). Defaults to the dev SPA origin.
const APP_URL = (process.env.REAGENT_APP_URL || "http://localhost:5173").replace(/\/$/, "");
const publicUrl = (id: string) => `${APP_URL}/article/${id}`;

export function registerArticleRoutes(app: Hono): void {
  // PUBLIC gallery — every published article across all users (newest first).
  app.get("/api/public/articles", (c) => {
    const list = listPublicArticles().map((a) => ({
      id: a.id,
      title: a.title,
      subtitle: a.subtitle,
      author: a.authorName || "Unknown author",
      publishedAt: a.publishedAt,
      cover: `/api/public/articles/${a.id}/cover`,
      url: publicUrl(a.id),
    }));
    return c.json({ articles: list });
  });

  // PUBLIC cover image for the gallery card — the article's first workspace
  // figure if it has one, otherwise a deterministic generated cover. Universal:
  // works for every published article with no per-article step.
  app.get("/api/public/articles/:id/cover", async (c) => {
    const a = getArticle(c.req.param("id"));
    if (!a || a.status !== "public") return c.json({ error: "not_found" }, 404);
    const fig = await firstArticleImage(a.researchId, a.contentMd);
    if (fig) return c.body(fig.buf, 200, { "Content-Type": fig.mime, "Cache-Control": "public, max-age=300" });
    return c.body(coverSvg(a.id), 200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=300" });
  });

  // PUBLIC — the shared page fetches this. Only a PUBLISHED article is exposed.
  app.get("/api/public/articles/:id", async (c) => {
    const a = getArticle(c.req.param("id"));
    if (!a || a.status !== "public") return c.json({ error: "not_found" }, 404);
    const contentMd = await inlineArticleImages(a.researchId, a.contentMd);
    return c.json({
      article: { id: a.id, title: a.title, subtitle: a.subtitle, author: a.authorName, contentMd, publishedAt: a.publishedAt, url: publicUrl(a.id) },
    });
  });

  // AUTHED — the current user's article collection.
  app.get("/api/articles", (c) => {
    const list = listArticlesByUser(c.get("userId")).map((a) => ({
      id: a.id,
      title: a.title,
      subtitle: a.subtitle,
      status: a.status,
      researchId: a.researchId,
      createdAt: a.createdAt,
      publishedAt: a.publishedAt,
      url: publicUrl(a.id),
    }));
    return c.json({ articles: list });
  });

  // AUTHED — one of the user's own articles, including drafts (owner preview).
  app.get("/api/articles/:id", async (c) => {
    const a = getArticle(c.req.param("id"));
    if (!a || a.userId !== c.get("userId")) return c.json({ error: "not_found" }, 404);
    const contentMd = await inlineArticleImages(a.researchId, a.contentMd);
    return c.json({
      article: { id: a.id, title: a.title, subtitle: a.subtitle, author: a.authorName, contentMd, status: a.status, researchId: a.researchId, publishedAt: a.publishedAt, url: publicUrl(a.id) },
    });
  });

  app.post("/api/articles/:id/publish", (c) => {
    const a = setArticleStatus(c.req.param("id"), c.get("userId"), "public");
    return a ? c.json({ ok: true, status: a.status, url: publicUrl(a.id) }) : c.json({ error: "not_found" }, 404);
  });

  app.post("/api/articles/:id/unpublish", (c) => {
    const a = setArticleStatus(c.req.param("id"), c.get("userId"), "draft");
    return a ? c.json({ ok: true, status: a.status }) : c.json({ error: "not_found" }, 404);
  });

  app.delete("/api/articles/:id", (c) => {
    return deleteArticle(c.req.param("id"), c.get("userId")) ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
  });
}
