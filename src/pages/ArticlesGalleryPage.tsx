/**
 * src/pages/ArticlesGalleryPage.tsx — the PUBLIC articles gallery (/articles).
 *
 *   A standalone, logged-out-friendly page listing EVERY published article across
 *   all users (the landing "Articles" button lands here). Each card shows a cover
 *   — the article's first workspace figure when it has one, otherwise a generated
 *   cover served by the API — plus title, dek, author and date, linking to the
 *   full read at /article/:id. Reuses the article page's landing-style nav/footer.
 */
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { api, type PublicArticleCard } from "../lib/api";

function fmtDate(ms: number | null | undefined): string {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function ArticlesGalleryPage() {
  const [articles, setArticles] = useState<PublicArticleCard[] | null>(null);
  const [failed, setFailed] = useState(false);

  // Same Google Sans Flex + real-weight scope the single-article page uses.
  useEffect(() => {
    document.body.classList.add("article-view");
    return () => document.body.classList.remove("article-view");
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .listPublicArticles()
      .then((r) => alive && setArticles(r.articles))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  let body: React.ReactNode;
  if (failed) {
    body = <p className="ag-empty">Couldn’t load articles right now. Please try again.</p>;
  } else if (articles === null) {
    body = <p className="ag-empty">Loading…</p>;
  } else if (articles.length === 0) {
    body = (
      <p className="ag-empty">
        No articles have been published yet. Run a research, then ask the agent to write one — it’ll appear here once you publish it.
      </p>
    );
  } else {
    body = (
      <div className="ag-grid">
        {articles.map((a) => (
          <a key={a.id} className="ag-card" href={`/article/${a.id}`}>
            <div className="ag-cover">
              <img src={a.cover} alt="" loading="lazy" />
            </div>
            <div className="ag-card-body">
              <h2 className="ag-card-title">{a.title}</h2>
              {a.subtitle && <p className="ag-card-dek">{a.subtitle}</p>}
              <div className="ag-card-meta">
                <span className="ag-card-author">{a.author}</span>
                {a.publishedAt ? <span className="ag-card-dot">·</span> : null}
                {a.publishedAt ? <span>{fmtDate(a.publishedAt)}</span> : null}
              </div>
            </div>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="article-page">
      <header className="article-nav">
        <a href="/" className="article-nav-logo">
          <FlaskConical size={22} strokeWidth={1.8} />
          <span>reagent</span>
        </a>
        <nav className="article-nav-links">
          <a href="/" className="article-nav-link">Home</a>
          <a href="/articles" className="article-nav-link">Articles</a>
          <a href="/researches" target="_top" className="article-nav-cta">Start a run</a>
        </nav>
      </header>

      <main className="article-shell ag-shell">
        <div className="ag-wrap">
          <header className="ag-head">
            <h1 className="ag-title">Articles</h1>
            <p className="ag-sub">Research write-ups published by the reagent community — read how each investigation unfolded.</p>
          </header>
          {body}
        </div>
      </main>

      <footer className="article-footer">
        <div className="article-footer-inner">
          <div className="article-footer-brandcol">
            <a href="/" className="article-footer-brand">
              <FlaskConical size={22} strokeWidth={1.8} />
              <span>reagent</span>
            </a>
            <span className="article-footer-tag">Autonomous research agents</span>
          </div>
          <nav className="article-footer-links">
            <a href="/">Home</a>
            <a href="/articles">Articles</a>
            <a href="/researches" target="_top">Start a run</a>
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Back to top ↑
            </a>
          </nav>
        </div>
        <div className="article-footer-copy">© 2026 Reagent · Apache 2.0</div>
      </footer>
    </div>
  );
}
