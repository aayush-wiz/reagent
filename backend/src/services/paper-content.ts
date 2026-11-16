/**
 * backend/src/services/paper-content.ts — assemble a readable paper document.
 *
 *   Given a stored paper, build a Markdown document the frontend renders in the
 *   Notion-style reader. Resolution order:
 *     1. Europe PMC open-access full text (JATS XML → Markdown) when the paper
 *        has a PMC record — real body sections, not just the abstract.
 *     2. Stored abstract + metadata.
 *     3. Metadata + links only (paywalled / no OA copy).
 */
import { XMLParser } from "fast-xml-parser";
import { extractText, getDocumentProxy } from "unpdf";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { log } from "../libs/logger.ts";

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
const TIMEOUT_MS = 8000;

// HTML → clean Markdown (Turndown + GFM tables). Used to render arXiv/ar5iv
// papers as plain readable text instead of an iframe. Drops images/figures and
// page chrome so the reader shows just the article prose, headings, and tables.
let _td: TurndownService | null = null;
function htmlToMarkdown(html: string): string {
  if (!_td) {
    const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*" });
    td.use(gfm);
    td.remove(["script", "style", "noscript", "img", "svg", "picture", "nav", "header", "footer", "form", "button", "iframe"]);
    // Drop ar5iv/LaTeXML page chrome (navbar, footer, RDF, "report issue", logos).
    td.addRule("ar5iv-chrome", {
      filter: (node) =>
        /ltx_page_navbar|ltx_page_footer|ltx_rdf|ltx_role_footnote|ar5iv-footer|ltx_pagination|ltx_authors|ltx_personname|ltx_title_document|ltx_dates|ltx_role_institute/.test(
          node.getAttribute?.("class") || "",
        ),
      replacement: () => "",
    });
    _td = td;
  }
  // Pre-strip non-article HTML so its noise never reaches Turndown: the <head>
  // (title/meta), scripts/styles, images/svgs (alt-text leaks), and the LaTeXML
  // macro preamble ar5iv echoes at the top of <body>.
  let h = html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "");
  // Prefer the main article body when ar5iv marks it, dropping title-page chrome.
  const start = h.search(/<div[^>]*class="[^"]*ltx_page_content/i);
  if (start > -1) h = h.slice(start);
  return _td
    .turndown(h)
    .replace(/\\(useunder|ul|newcommand|def|renewcommand)\b.*$/gim, "") // stray LaTeX macros
    .replace(/^\s*\[\d{4}\.\d{4,5}\].*$/gim, "") // stray "[2204.14198] Title" line
    .replace(/^\s*\\+\s*$/gm, "") // stray backslash-only lines
    .replace(/[ \t]*&&?[ \t]*/g, " ") // leftover LaTeX table cell separators
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+$/gm, "")
    .trim();
}

async function getText(url: string, accept = "application/xml"): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function getJson(url: string): Promise<any> {
  return JSON.parse(await getText(url, "application/json"));
}

/** Recursively flatten a JATS node's text (mixed content) into a plain string. */
function nodeText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  const obj = node as Record<string, unknown>;
  let out = "";
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("@_")) continue;
    out += nodeText(v);
  }
  return out;
}

/** Walk JATS <sec> blocks into Markdown headings + paragraphs. */
function secToMarkdown(sec: any, depth = 2): string {
  const secs = Array.isArray(sec) ? sec : [sec];
  const parts: string[] = [];
  for (const s of secs) {
    if (!s) continue;
    const title = s.title ? nodeText(s.title).trim() : "";
    if (title) parts.push(`${"#".repeat(Math.min(depth, 6))} ${title}`);
    for (const p of Array.isArray(s.p) ? s.p : s.p ? [s.p] : []) {
      const text = nodeText(p).replace(/\s+/g, " ").trim();
      if (text) parts.push(text);
    }
    if (s.sec) parts.push(secToMarkdown(s.sec, depth + 1));
  }
  return parts.join("\n\n");
}

async function fetchEuropePmcFullText(doi: string): Promise<string | null> {
  try {
    const search = await getJson(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:%22${encodeURIComponent(doi)}%22&format=json&resultType=core&pageSize=1`,
    );
    const rec = search?.resultList?.result?.[0];
    const pmcid: string | undefined = rec?.pmcid;
    if (!pmcid) return null;
    const xmlText = await getText(`https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcid}/fullTextXML`);
    const doc = xml.parse(xmlText);
    const body = doc?.article?.body;
    if (!body?.sec) return null;
    const md = secToMarkdown(body.sec, 2).trim();
    return md.length > 200 ? md : null;
  } catch (e) {
    log.warn("europepmc fulltext failed", String(e));
    return null;
  }
}

/** Pull an arXiv id straight from a DOI or PDF URL (e.g. 10.48550/arXiv.2305.15294). */
function detectArxivId(p: PaperRow): string | null {
  const src = `${p.doi ?? ""} ${p.pdfUrl ?? ""}`;
  if (!/arxiv/i.test(src)) return null;
  const m = src.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  return m ? m[1] : null;
}

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Resolve an arXiv id even when the paper is stored under its journal DOI.
 *  Order: direct link → Semantic Scholar externalIds → arXiv title search. */
async function resolveArxivId(p: PaperRow): Promise<string | null> {
  const direct = detectArxivId(p);
  if (direct) return direct;

  // Semantic Scholar maps a DOI to its arXiv preprint.
  if (p.doi) {
    try {
      const d = await getJson(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(p.doi)}?fields=externalIds`);
      if (d?.externalIds?.ArXiv) return String(d.externalIds.ArXiv);
    } catch {
      /* rate-limited — fall through */
    }
  }

  // Fallback: search arXiv by exact title and confirm it's the same paper.
  try {
    const feed = (xml.parse(
      await getText(`http://export.arxiv.org/api/query?search_query=ti:${encodeURIComponent(`"${p.title}"`)}&max_results=1`),
    ) as { feed?: { entry?: any } }).feed;
    const entry = Array.isArray(feed?.entry) ? feed?.entry[0] : feed?.entry;
    if (entry && normTitle(String(entry.title)) === normTitle(p.title)) {
      const m = String(entry.id).match(/(\d{4}\.\d{4,5})/);
      if (m) return m[1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * The best FETCHABLE PDF URL for a paper. Publisher URLs (Wiley, Elsevier, …)
 * are often paywalled/bot-blocked, but the same paper is usually on arXiv with
 * an open PDF — prefer that. Falls back to the stored URL, then null.
 *
 * Cached per paper id: the arXiv resolution does network calls, and the reader
 * asks twice (a probe + the real load) — without caching the second call can
 * race/rate-limit and fail.
 */
const _pdfUrlCache = new Map<string, string | null>();
export async function resolvePdfUrl(p: PaperRow): Promise<string | null> {
  const key = p.doi || p.title;
  if (_pdfUrlCache.has(key)) return _pdfUrlCache.get(key)!;
  const id = await resolveArxivId(p);
  const url = id ? `https://arxiv.org/pdf/${id}` : p.pdfUrl ?? null;
  _pdfUrlCache.set(key, url);
  return url;
}

/**
 * Fetch arXiv's fully-formatted HTML (via ar5iv) — real sections, figures,
 * tables and math. We inject a <base> so the paper's relative image/CSS URLs
 * resolve, and the frontend renders it in a sandboxed <iframe srcdoc>.
 */
async function fetchArxivHtml(id: string): Promise<string | null> {
  const base = `https://ar5iv.labs.arxiv.org/html/${id}/`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(base, { signal: ctrl.signal, headers: { accept: "text/html" }, redirect: "follow" });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length < 2000) return null;
    return html; // converted to clean Markdown by buildPaperMarkdown (htmlToMarkdown)
  } catch (e) {
    log.warn("arxiv html fetch failed", String(e));
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Download the open-access PDF and extract its text (works for any source). */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(pdfUrl, { signal: ctrl.signal, headers: { accept: "application/pdf,*/*" }, redirect: "follow" });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    // Verify it's really a PDF (%PDF magic) — some OA links redirect to an HTML landing page.
    if (buf.length < 5 || buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46) return null;
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = normalizePdfText(Array.isArray(text) ? text.join("\n") : text);
    return clean.length > 800 ? clean : null;
  } catch (e) {
    log.warn("pdf extract failed", String(e));
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Turn raw PDF-extracted text into readable Markdown paragraphs. */
function normalizePdfText(raw: string): string {
  const lines = raw.split(/\n/);
  const paras: string[] = [];
  let buf = "";
  for (const lineRaw of lines) {
    const line = lineRaw.replace(/\s+/g, " ").trim();
    if (!line) {
      if (buf) {
        paras.push(buf.trim());
        buf = "";
      }
      continue;
    }
    // A short line that looks like a section heading gets its own paragraph.
    const isHeading = line.length < 60 && /^[0-9]*\.?\s*[A-Z][A-Za-z0-9 ,:\-]+$/.test(line) && !line.endsWith(".");
    if (isHeading) {
      if (buf) {
        paras.push(buf.trim());
        buf = "";
      }
      paras.push(`## ${line}`);
      continue;
    }
    // Join hyphenated line breaks; otherwise space-join wrapped lines.
    if (buf.endsWith("-")) buf = buf.slice(0, -1) + line;
    else buf = buf ? `${buf} ${line}` : line;
  }
  if (buf) paras.push(buf.trim());
  // Fix PDF line-wrap hyphenation ("knowl- edge" → "knowledge").
  return paras.join("\n\n").replace(/([a-z])-\s+([a-z])/g, "$1$2");
}

export interface PaperRow {
  title: string;
  byline: string;
  year: string;
  venue: string;
  citations: number;
  doi?: string | null;
  abstract?: string | null;
  pdfUrl?: string | null;
}

export interface PaperDoc {
  markdown: string;
  html?: string; // fully-formatted paper (arXiv/ar5iv) for the sandboxed iframe
  source: string;
}

export async function buildPaperMarkdown(p: PaperRow): Promise<PaperDoc> {
  const head: string[] = [`# ${p.title}`];
  const sub = [p.byline, p.venue, p.year].filter(Boolean).join(" · ");
  if (sub) head.push(`_${sub}_`);
  const links: string[] = [];
  if (p.doi) links.push(`[DOI](https://doi.org/${p.doi})`);
  if (p.pdfUrl) links.push(`[PDF](${p.pdfUrl})`);
  if (links.length) head.push(links.join(" · "));
  head.push(`✳ ${p.citations} citations`);
  const header = head.join("\n\n");

  // 0. arXiv → full text via ar5iv HTML, converted to clean Markdown (plain
  //    readable text, not an iframe). Best structure/quality when available.
  const arxivId = await resolveArxivId(p);
  if (arxivId) {
    const html = await fetchArxivHtml(arxivId);
    const body = html ? htmlToMarkdown(html) : "";
    if (body.length > 500) return { markdown: `${header}\n\n---\n\n${body}`, source: "arxiv-html" };
  }

  // 1. Open-access full text via Europe PMC (structured sections — best quality)
  if (p.doi) {
    const full = await fetchEuropePmcFullText(p.doi);
    if (full) {
      return { markdown: `${header}\n\n---\n\n${full}`, source: "europepmc-fulltext" };
    }
  }

  // 2. Full text by downloading + extracting the open-access PDF (works for arXiv, etc.)
  if (p.pdfUrl) {
    const pdfText = await fetchPdfText(p.pdfUrl);
    if (pdfText) {
      return { markdown: `${header}\n\n---\n\n${pdfText}`, source: "pdf-fulltext" };
    }
  }

  // 3. Abstract (fallback)
  if (p.abstract && p.abstract.trim()) {
    return { markdown: `${header}\n\n---\n\n## Abstract\n\n${p.abstract.trim()}`, source: "abstract" };
  }

  // 4. Metadata only
  const note = p.pdfUrl
    ? "Full text isn't available inline — open the PDF above to read the paper."
    : "No open-access full text was found for this paper. Follow the DOI to the publisher.";
  return { markdown: `${header}\n\n---\n\n${note}`, source: "metadata" };
}
