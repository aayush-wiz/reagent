/**
 * backend/src/services/paper-search.ts — cross-journal paper search.
 *
 *   There's no single API that "searches all journals". Instead we fan the
 *   query out to several open scholarly aggregators that each already index
 *   nearly every publisher, then normalize → dedupe → merge → rank:
 *
 *     1. Fan out (parallel) to OpenAlex, Crossref, Semantic Scholar.
 *     2. Normalize each provider's payload into one PaperResult shape.
 *     3. Dedupe by DOI (fallback: normalized title).
 *     4. Merge missing fields across duplicates (abstract from one,
 *        open-access PDF from another…).
 *     5. Rank: OpenAlex relevance order first, then unique extras.
 *
 *   None of these require an API key for low volume. OpenAlex asks for a
 *   `mailto` for the polite pool — set SEARCH_MAILTO in .env.
 */
import { XMLParser } from "fast-xml-parser";
import { log } from "../libs/logger.ts";

export interface PaperResult {
  id: string; // doi (lowercased) or `${source}:${sourceId}`
  title: string;
  authors: string[];
  year: string;
  venue: string;
  citations: number;
  abstract?: string;
  doi?: string;
  pdfUrl?: string;
  openAccess: boolean;
  sources: string[]; // which providers surfaced it
}

const MAILTO = process.env.SEARCH_MAILTO || "hello@reagent.app";
const FETCH_TIMEOUT_MS = 8000;

async function getJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json", ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function getText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

/** OpenAlex stores abstracts as an inverted index {word: [positions]}; rebuild the text. */
function abstractFromInverted(idx: Record<string, number[]> | null | undefined): string | undefined {
  if (!idx) return undefined;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(idx)) {
    for (const p of positions) slots[p] = word;
  }
  const text = slots.filter(Boolean).join(" ").trim();
  return text || undefined;
}

function cleanDoi(doi?: string | null): string | undefined {
  if (!doi) return undefined;
  return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() || undefined;
}

function normTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ─── Providers ───────────────────────────────────────────────────────

async function searchOpenAlex(q: string, limit: number): Promise<PaperResult[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=${limit}&mailto=${encodeURIComponent(MAILTO)}`;
  const data = (await getJson(url)) as { results?: any[] };
  return (data.results ?? []).map((w) => {
    const doi = cleanDoi(w.doi);
    return {
      id: doi ?? `openalex:${w.id}`,
      title: w.display_name ?? "Untitled",
      authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
      year: w.publication_year ? String(w.publication_year) : "",
      venue: w.primary_location?.source?.display_name ?? w.host_venue?.display_name ?? "",
      citations: w.cited_by_count ?? 0,
      abstract: abstractFromInverted(w.abstract_inverted_index),
      doi,
      pdfUrl: w.best_oa_location?.pdf_url ?? w.primary_location?.pdf_url ?? undefined,
      openAccess: !!w.open_access?.is_oa,
      sources: ["openalex"],
    } satisfies PaperResult;
  });
}

async function searchCrossref(q: string, limit: number): Promise<PaperResult[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${limit}&mailto=${encodeURIComponent(MAILTO)}`;
  const data = (await getJson(url)) as { message?: { items?: any[] } };
  return (data.message?.items ?? []).map((it) => {
    const doi = cleanDoi(it.DOI);
    const pdf = (it.link ?? []).find((l: any) => l["content-type"] === "application/pdf")?.URL;
    return {
      id: doi ?? `crossref:${it.DOI}`,
      title: Array.isArray(it.title) ? it.title[0] : it.title ?? "Untitled",
      authors: (it.author ?? []).map((a: any) => `${a.given ?? ""} ${a.family ?? ""}`.trim()).filter(Boolean),
      year: it.issued?.["date-parts"]?.[0]?.[0] ? String(it.issued["date-parts"][0][0]) : "",
      venue: Array.isArray(it["container-title"]) ? it["container-title"][0] : "",
      citations: it["is-referenced-by-count"] ?? 0,
      doi,
      pdfUrl: pdf,
      openAccess: !!pdf,
      sources: ["crossref"],
    } satisfies PaperResult;
  });
}

async function searchSemanticScholar(q: string, limit: number): Promise<PaperResult[]> {
  const fields = "title,authors,year,venue,citationCount,externalIds,openAccessPdf,abstract";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${limit}&fields=${fields}`;
  const data = (await getJson(url)) as { data?: any[] };
  return (data.data ?? []).map((p) => {
    const doi = cleanDoi(p.externalIds?.DOI);
    return {
      id: doi ?? `s2:${p.paperId}`,
      title: p.title ?? "Untitled",
      authors: (p.authors ?? []).map((a: any) => a.name).filter(Boolean),
      year: p.year ? String(p.year) : "",
      venue: p.venue ?? "",
      citations: p.citationCount ?? 0,
      abstract: p.abstract ?? undefined,
      doi,
      pdfUrl: p.openAccessPdf?.url ?? undefined,
      openAccess: !!p.openAccessPdf?.url,
      sources: ["semanticscholar"],
    } satisfies PaperResult;
  });
}

async function searchEuropePmc(q: string, limit: number): Promise<PaperResult[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&pageSize=${limit}&resultType=core`;
  const data = (await getJson(url)) as { resultList?: { result?: any[] } };
  return (data.resultList?.result ?? []).map((r) => {
    const doi = cleanDoi(r.doi);
    const pdf = (r.fullTextUrlList?.fullTextUrl ?? []).find((u: any) => u.documentStyle === "pdf")?.url;
    return {
      id: doi ?? `epmc:${r.id}`,
      title: r.title ?? "Untitled",
      authors: (r.authorString ?? "").split(",").map((a: string) => a.trim()).filter(Boolean),
      year: r.pubYear ? String(r.pubYear) : "",
      venue: r.journalTitle ?? r.bookOrReportDetails?.publisher ?? "",
      citations: r.citedByCount ?? 0,
      abstract: r.abstractText ?? undefined,
      doi,
      pdfUrl: pdf,
      openAccess: r.isOpenAccess === "Y" || !!pdf,
      sources: ["europepmc"],
    } satisfies PaperResult;
  });
}

async function searchArxiv(q: string, limit: number): Promise<PaperResult[]> {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=${limit}`;
  const feed = (xml.parse(await getText(url)) as { feed?: { entry?: any } }).feed;
  return asArray(feed?.entry).map((e: any) => {
    const links = asArray(e.link);
    const pdf = links.find((l: any) => l["@_title"] === "pdf" || l["@_type"] === "application/pdf")?.["@_href"];
    const doi = cleanDoi(e["arxiv:doi"]?.["#text"] ?? e["arxiv:doi"]);
    return {
      id: doi ?? `arxiv:${e.id}`,
      title: String(e.title ?? "Untitled").replace(/\s+/g, " ").trim(),
      authors: asArray(e.author).map((a: any) => a.name).filter(Boolean),
      year: e.published ? String(e.published).slice(0, 4) : "",
      venue: "arXiv",
      citations: 0,
      abstract: e.summary ? String(e.summary).replace(/\s+/g, " ").trim() : undefined,
      doi,
      pdfUrl: pdf ?? (typeof e.id === "string" ? e.id.replace("/abs/", "/pdf/") : undefined),
      openAccess: true,
      sources: ["arxiv"],
    } satisfies PaperResult;
  });
}

async function searchCore(q: string, limit: number): Promise<PaperResult[]> {
  const key = process.env.CORE_API_KEY;
  if (!key) return []; // optional source — skip when no key configured
  const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(q)}&limit=${limit}`;
  const data = (await getJson(url, { authorization: `Bearer ${key}` })) as { results?: any[] };
  return (data.results ?? []).map((w) => {
    const doi = cleanDoi(w.doi);
    return {
      id: doi ?? `core:${w.id}`,
      title: w.title ?? "Untitled",
      authors: (w.authors ?? []).map((a: any) => a.name).filter(Boolean),
      year: w.yearPublished ? String(w.yearPublished) : "",
      venue: w.publisher ?? "",
      citations: w.citationCount ?? 0,
      abstract: w.abstract ?? undefined,
      doi,
      pdfUrl: w.downloadUrl ?? undefined,
      openAccess: !!w.downloadUrl,
      sources: ["core"],
    } satisfies PaperResult;
  });
}

/** Fill missing open-access PDF links via Unpaywall (best OA-PDF resolver by DOI). */
async function enrichPdfsViaUnpaywall(results: PaperResult[], max = 12): Promise<void> {
  const need = results.filter((r) => r.doi && !r.pdfUrl).slice(0, max);
  await Promise.allSettled(
    need.map(async (r) => {
      const data = (await getJson(`https://api.unpaywall.org/v2/${r.doi}?email=${encodeURIComponent(MAILTO)}`)) as any;
      const pdf = data?.best_oa_location?.url_for_pdf ?? data?.best_oa_location?.url;
      if (pdf) {
        r.pdfUrl = pdf;
        r.openAccess = true;
        if (!r.sources.includes("unpaywall")) r.sources.push("unpaywall");
      }
    }),
  );
}

// ─── Aggregate ───────────────────────────────────────────────────────

function dedupeKey(r: PaperResult): string {
  return r.doi ? `doi:${r.doi}` : `title:${normTitleKey(r.title)}`;
}

/** Merge b's non-empty fields into a where a is missing them. */
function mergeInto(a: PaperResult, b: PaperResult) {
  a.abstract ??= b.abstract;
  a.pdfUrl ??= b.pdfUrl;
  a.venue ||= b.venue;
  a.year ||= b.year;
  if (b.authors.length > a.authors.length) a.authors = b.authors;
  a.citations = Math.max(a.citations, b.citations);
  a.openAccess = a.openAccess || b.openAccess;
  if (!a.sources.includes(b.sources[0])) a.sources.push(...b.sources);
}

// The heavily rate-limited sources (arXiv ~1 req/3s, Semantic Scholar strict
// without a key). Skipped on the cheap `get_paper` path to avoid 429 floods when
// many literature-review subagents run in parallel.
type Source = "openalex" | "crossref" | "semanticscholar" | "europepmc" | "arxiv" | "core";
const ALL_SOURCES: Source[] = ["openalex", "crossref", "semanticscholar", "europepmc", "arxiv", "core"];
// Reliable, polite-pool sources (mailto) that don't 429 under parallel load.
export const RELIABLE_SOURCES: Source[] = ["openalex", "crossref"];

/**
 * Resolve ONE paper by its exact DOI — a deterministic record lookup, NOT a
 * keyword search. `searchPapers(doi)` fuzzy-matches the DOI string as a query
 * and returns the top *relevance* hit (often the wrong paper); this hits the
 * per-DOI endpoints directly so an attached paper always resolves to itself.
 */
export async function getPaperByDoi(rawDoi: string): Promise<PaperResult | null> {
  const doi = cleanDoi(rawDoi);
  if (!doi) return null;
  // OpenAlex first (has inverted-index abstract + OA PDF), Crossref as fallback.
  const tryOpenAlex = async (): Promise<PaperResult | null> => {
    const url = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?mailto=${encodeURIComponent(MAILTO)}`;
    const w = (await getJson(url)) as any;
    if (!w?.id) return null;
    return {
      id: doi,
      title: w.display_name ?? "Untitled",
      authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
      year: w.publication_year ? String(w.publication_year) : "",
      venue: w.primary_location?.source?.display_name ?? w.host_venue?.display_name ?? "",
      citations: w.cited_by_count ?? 0,
      abstract: abstractFromInverted(w.abstract_inverted_index),
      doi,
      pdfUrl: w.best_oa_location?.pdf_url ?? w.primary_location?.pdf_url ?? undefined,
      openAccess: !!w.open_access?.is_oa,
      sources: ["openalex"],
    } satisfies PaperResult;
  };
  const tryCrossref = async (): Promise<PaperResult | null> => {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(MAILTO)}`;
    const it = ((await getJson(url)) as any)?.message;
    if (!it?.DOI) return null;
    const pdf = (it.link ?? []).find((l: any) => l["content-type"] === "application/pdf")?.URL;
    return {
      id: doi,
      title: Array.isArray(it.title) ? it.title[0] : it.title ?? "Untitled",
      authors: (it.author ?? []).map((a: any) => `${a.given ?? ""} ${a.family ?? ""}`.trim()).filter(Boolean),
      year: it.issued?.["date-parts"]?.[0]?.[0] ? String(it.issued["date-parts"][0][0]) : "",
      venue: Array.isArray(it["container-title"]) ? it["container-title"][0] : "",
      citations: it["is-referenced-by-count"] ?? 0,
      abstract: typeof it.abstract === "string" ? it.abstract.replace(/<[^>]+>/g, "").trim() : undefined,
      doi,
      pdfUrl: pdf,
      openAccess: !!pdf,
      sources: ["crossref"],
    } satisfies PaperResult;
  };
  for (const fn of [tryOpenAlex, tryCrossref]) {
    try {
      const r = await fn();
      if (r) return r;
    } catch (e) {
      log.warn(`getPaperByDoi failed for ${doi}`, String(e));
    }
  }
  return null;
}

export async function searchPapers(query: string, limit = 20, sources: Source[] = ALL_SOURCES): Promise<PaperResult[]> {
  const per = Math.min(25, limit);
  const fns: Record<Source, () => Promise<PaperResult[]>> = {
    openalex: () => searchOpenAlex(query, per),
    crossref: () => searchCrossref(query, per),
    semanticscholar: () => searchSemanticScholar(query, per),
    europepmc: () => searchEuropePmc(query, per),
    arxiv: () => searchArxiv(query, per),
    core: () => searchCore(query, per),
  };
  const active = sources.filter((s) => fns[s]);
  // Fan out to every source AT ONCE (Promise.allSettled) — not one after another.
  const t0 = Date.now();
  log.info(`search ▶ "${query.slice(0, 60)}" across ${active.length} sources in parallel: ${active.join(", ")}`);
  const settled = await Promise.allSettled(
    active.map(async (s) => {
      const s0 = Date.now();
      try {
        const r = await fns[s]();
        log.info(`search   ├ ${s} → ${r.length} hits (${Date.now() - s0}ms)`);
        return r;
      } catch (e) {
        log.warn(`search   ├ ${s} failed (${Date.now() - s0}ms)`, String(e));
        throw e;
      }
    }),
  );
  const providerNames = active;
  log.info(`search ✔ "${query.slice(0, 40)}" all ${active.length} sources done in ${Date.now() - t0}ms`);

  const byKey = new Map<string, PaperResult>();
  const order: string[] = [];
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const r of s.value) {
      if (!r.title) continue;
      const k = dedupeKey(r);
      const existing = byKey.get(k);
      if (existing) mergeInto(existing, r);
      else {
        byKey.set(k, r);
        order.push(k);
      }
    }
  }
  const merged = order.map((k) => byKey.get(k)!).slice(0, limit);
  await enrichPdfsViaUnpaywall(merged);
  return merged;
}
