/**
 * src/pages/ArticlePage.tsx — the PUBLIC, shareable article page (/article/:id).
 *
 *   A standalone reading page with a landing-style nav header + footer, rendered
 *   outside RequireAuth so a logged-out visitor can open a shared link. It fetches
 *   the PUBLIC endpoint; if that 404s and the visitor is signed in, it falls back
 *   to the owner endpoint so the author can preview their own DRAFT at the same URL.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { FlaskConical } from "lucide-react";
import { api, type ArticleFull } from "../lib/api";
import { getToken } from "../lib/auth";

function fmtDate(ms: number | null | undefined): string {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// The agent's Markdown usually opens with `# <title>`, which duplicates the page's
// own <h1>. Drop a single leading H1 so the title isn't shown twice.
function stripLeadingH1(md: string): string {
  return md.replace(/^\s*#\s+[^\n]*\r?\n+/, "");
}

export default function ArticlePage() {
  const { id = "" } = useParams();
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  // Give the public page its own font scope (Google Sans Flex + real weights) — it renders
  // outside the app shell, where the pixel-font weight reset would otherwise apply.
  useEffect(() => {
    document.body.classList.add("article-view");
    return () => document.body.classList.remove("article-view");
  }, []);

  useEffect(() => {
    let alive = true;
    setState("loading");
    api
      .getPublicArticle(id)
      .then((r) => {
        if (!alive) return;
        setArticle(r.article);
        setState("ok");
      })
      .catch(() => {
        // Not public — if the viewer is signed in, they might be the author
        // previewing their own draft. Otherwise it's simply not available.
        if (!alive) return;
        if (!getToken()) return setState("missing");
        api
          .getOwnArticle(id)
          .then((r) => {
            if (!alive) return;
            setArticle(r.article);
            setState("ok");
          })
          .catch(() => alive && setState("missing"));
      });
    return () => {
      alive = false;
    };
  }, [id]);

  let body: React.ReactNode;
  if (state === "loading") {
    body = <div className="article-note">Loading…</div>;
  } else if (state === "missing" || !article) {
    body = (
      <div className="article-note">
        <h1 className="article-title">Article not found</h1>
        <p className="article-dek">This article doesn’t exist or hasn’t been published yet.</p>
      </div>
    );
  } else {
    const isDraft = article.status === "draft";
    body = (
      <article className="article">
        {isDraft && (
          <div className="article-draft-banner">
            Draft preview — not public yet. Publish it from “My Articles” to share this link.
          </div>
        )}
        <header className="article-head">
          <h1 className="article-title">{article.title}</h1>
          <div className="article-meta">
            {article.publishedAt ? <>Published {fmtDate(article.publishedAt)}&nbsp;·&nbsp;</> : null}
            <span className="article-author">{article.author || "Unknown author"}</span>
          </div>
          {article.subtitle && <p className="article-dek">{article.subtitle}</p>}
        </header>
        <div className="article-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            // react-markdown strips data: URIs by default — allow our inlined figure images through.
            urlTransform={(url) => (url.startsWith("data:image/") ? url : defaultUrlTransform(url))}
          >
            {stripLeadingH1(article.contentMd)}
          </ReactMarkdown>
        </div>
      </article>
    );
  }

  return (
    <div className="article-page">
      <header className="article-nav">
        <a href="/" className="article-nav-logo"><FlaskConical size={22} strokeWidth={1.8} /><span>reagent</span></a>
        <nav className="article-nav-links">
          <a href="/" className="article-nav-link">Home</a>
          <a href="/articles" className="article-nav-link">Articles</a>
          <a href="/researches" target="_top" className="article-nav-cta">Start a run</a>
        </nav>
      </header>

      <main className="article-shell">{body}</main>

      <footer className="article-footer">
        <div className="article-footer-inner">
          <div className="article-footer-brandcol">
            <a href="/" className="article-footer-brand"><FlaskConical size={22} strokeWidth={1.8} /><span>reagent</span></a>
            <span className="article-footer-tag">Autonomous research agents</span>
          </div>
          <nav className="article-footer-links">
            <a href="/">Home</a>
            <a href="/articles">Articles</a>
            <a href="/researches" target="_top">Start a run</a>
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Back to top ↑</a>
          </nav>
        </div>
        <div className="article-footer-copy">© 2026 Reagent · Apache 2.0</div>
      </footer>
    </div>
  );
}
