/**
 * Reports & Results — a professional file-explorer over every artifact the agent
 * produced, across all researches. Modeled on a workspace file manager:
 *   · left tree: each research is a folder, with nested subfolders (chevron-expandable)
 *   · breadcrumb + big folder title on top + "Search this folder"
 *   · NAME/TYPE/SIZE/UPDATED table; folders drill in at any depth
 *   · files open a full viewer — PDFs inline, plots as images, .md rendered, text/code, binaries
 * Data: api.listResults() → documents (working docs) + workspace files.
 */
import { useEffect, useMemo, useState } from "react";
import { ActionIcon, Badge, Box, Button, Group, Loader, Text, Tooltip } from "@mantine/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  RefreshCw, FileText, Download, ArrowLeft, ChevronRight, ChevronDown,
  Folder, FolderOpen, Home, Image as ImageIcon, File as FileIcon, FileType, Table2, Search, Globe, ArrowUpRight,
} from "lucide-react";
import { api, type ResultDoc, type ResultFile } from "../../lib/api";
import { downloadText, downloadUrl } from "../../lib/download";
import Sidebar from "../../components/workspace/Sidebar";
import type { HomeChrome } from "./shared";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

/* ---------- helpers ---------- */

const DOCS_FOLDER = "documents"; // virtual folder holding a research's working docs

function timeAgo(ms: number): string {
  if (!ms) return "—";
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(ms).toLocaleDateString();
}

function fmtSize(bytes: number): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(f: ResultFile): string {
  const ext = (f.ext || "").replace(/^\./, "").toLowerCase();
  if (ext === "pdf") return "Report";
  if (f.category === "chart" || ["png", "jpg", "jpeg", "svg", "gif"].includes(ext)) return "Figure";
  if (["csv", "tsv", "parquet", "xlsx"].includes(ext)) return "Table";
  if (ext === "md") return "Report";
  if (["json", "jsonl"].includes(ext)) return "Data";
  if (["py", "r", "sh", "ts", "js"].includes(ext)) return "Script";
  return ext ? ext.toUpperCase() : "File";
}

function fileIcon(f: ResultFile) {
  const t = fileType(f);
  if (t === "Figure") return <ImageIcon size={15} color="#7c58a6" />;
  if (t === "Report") return f.ext === ".pdf" ? <FileType size={15} color="#b3402e" /> : <FileText size={15} color="#2b5fd1" />;
  if (t === "Table" || t === "Data") return <Table2 size={15} color="#0e7f6e" />;
  return <FileIcon size={15} color="#847f76" />;
}

/** Directory part of a path ("figures/a/b.png" → "figures/a"; "x.md" → ""). */
const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
/** Is `p` directly inside directory `prefix`? ("" = root) */
const inDir = (p: string, prefix: string) => dirOf(p) === prefix;
/** Next path segment under `prefix`, or null if p isn't beneath it. */
function childDir(p: string, prefix: string): string | null {
  const d = dirOf(p);
  if (!d) return null;
  if (!prefix) return d.split("/")[0];
  if (!d.startsWith(prefix + "/")) return null;
  return d.slice(prefix.length + 1).split("/")[0];
}

/* ---------- table primitives ---------- */

const TH = ({ children, w }: { children: React.ReactNode; w?: number | string }) => (
  <th style={{ width: w, textAlign: "left", padding: "9px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8a8680", borderBottom: "1px solid #e9e7e1", whiteSpace: "nowrap" }}>
    {children}
  </th>
);
const TD = ({ children, mono, dim }: { children: React.ReactNode; mono?: boolean; dim?: boolean }) => (
  <td style={{ padding: "10px 14px", fontSize: 13.5, color: dim ? "#8a8680" : "#1c1b19", fontFamily: mono ? "ui-monospace, Menlo, monospace" : undefined, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 0 }}>
    {children}
  </td>
);

interface Row {
  key: string;
  kind: "folder" | "file" | "doc";
  name: string;
  type: string;
  size: string;
  updatedAt: number;
  icon: React.ReactNode;
  onOpen: () => void;
  onDownload?: () => void;
}

/* ---------- nested dir tree (left panel) ---------- */

interface DirNode { name: string; path: string; children: DirNode[] }

/** Build the nested directory tree of a research's files. */
function buildDirTree(paths: string[]): DirNode[] {
  const root: DirNode = { name: "", path: "", children: [] };
  for (const p of paths) {
    const d = dirOf(p);
    if (!d) continue;
    let cur = root;
    let acc = "";
    for (const seg of d.split("/")) {
      acc = acc ? `${acc}/${seg}` : seg;
      let next = cur.children.find((c) => c.name === seg);
      if (!next) { next = { name: seg, path: acc, children: [] }; cur.children.push(next); }
      cur = next;
    }
  }
  const sort = (n: DirNode) => { n.children.sort((a, b) => a.name.localeCompare(b.name)); n.children.forEach(sort); };
  sort(root);
  return root.children;
}

/* ---------- page ---------- */

export default function ReportsPage({ chrome }: Props) {
  const [docs, setDocs] = useState<ResultDoc[]>([]);
  const [files, setFiles] = useState<ResultFile[]>([]);
  const [loading, setLoading] = useState(true);
  // Path: [] = all researches · [rid] = research root · [rid, ...dirSegments].
  const [path, setPath] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // tree keys: rid or `${rid}/${dirPath}`
  const [viewer, setViewer] = useState<{ title: string; sub: string; body: React.ReactNode; download?: () => void } | null>(null);
  // The research's published web page (if any) — shows an "Open website" button.
  const [site, setSite] = useState<{ url: string; updatedAt: number } | null>(null);

  const refresh = () => {
    setLoading(true);
    api.listResults().then((d) => { setDocs(d.documents); setFiles(d.files); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const researches = useMemo(() => {
    const map = new Map<string, { id: string; title: string; count: number; updatedAt: number }>();
    for (const x of [...docs, ...files]) {
      const r = map.get(x.researchId) ?? { id: x.researchId, title: x.researchTitle || x.researchId, count: 0, updatedAt: 0 };
      r.count += 1;
      r.updatedAt = Math.max(r.updatedAt, x.updatedAt || 0);
      map.set(x.researchId, r);
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [docs, files]);

  const rid = path[0];
  const dirPath = path.length > 1 ? path.slice(1).join("/") : ""; // "" = research root
  const inDocs = path[1] === DOCS_FOLDER;
  const research = researches.find((r) => r.id === rid);
  // Does the current research have a published web page? (drives "Open website")
  useEffect(() => {
    if (!rid) { setSite(null); return; }
    let alive = true;
    api.researchSite(rid)
      .then((r) => alive && setSite(r.site ? { url: r.site.url, updatedAt: r.site.updatedAt } : null))
      .catch(() => alive && setSite(null));
    return () => { alive = false; };
  }, [rid]);
  const rDocs = useMemo(() => docs.filter((d) => d.researchId === rid), [docs, rid]);
  const rFiles = useMemo(() => files.filter((f) => f.researchId === rid), [files, rid]);

  const go = (p: string[]) => { setPath(p); setViewer(null); setSearch(""); };

  /* ---- viewer openers (ALL data kinds: pdf / figure / md / text / binary) ---- */
  const openDoc = (d: ResultDoc) => {
    setViewer({ title: d.title || d.name, sub: `${d.name}.md · ${d.researchTitle}`, body: <Loader size="xs" color="terracotta" /> });
    api.getDocument(d.researchId, d.name).then((r) =>
      setViewer({
        title: d.title || d.name, sub: `${d.name}.md · ${d.researchTitle}`,
        body: <Box className="agent-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{r.document.content || "_Empty document._"}</ReactMarkdown></Box>,
        download: () => downloadText(`${d.name}.md`, r.document.content),
      }),
    ).catch(() => setViewer({ title: d.title || d.name, sub: d.researchTitle, body: <Text size="sm" c="dimmed">Couldn't load this document.</Text> }));
  };

  const openFile = (f: ResultFile) => {
    const base = f.path.split("/").pop() || f.path;
    const sub = `${f.path} · ${f.researchTitle}`;
    const dl = () => void downloadUrl(api.fileRawUrl(f.researchId, f.path), base);
    const ext = (f.ext || "").replace(/^\./, "").toLowerCase();
    if (ext === "pdf") {
      setViewer({ title: base, sub, body: <Loader size="xs" color="terracotta" />, download: dl });
      fetch(api.fileRawUrl(f.researchId, f.path)).then(async (res) => {
        const url = URL.createObjectURL(await res.blob());
        setViewer({ title: base, sub, body: <iframe src={url} title={f.path} style={{ width: "100%", height: "72vh", border: "none" }} />, download: dl });
      }).catch(() => setViewer({ title: base, sub, body: <Text size="sm" c="dimmed">Couldn't load the PDF — use Download.</Text>, download: dl }));
      return;
    }
    if (fileType(f) === "Figure") {
      setViewer({ title: base, sub, body: <Loader size="xs" color="terracotta" />, download: dl });
      api.readFile(f.researchId, f.path).then((r) =>
        setViewer({ title: base, sub, body: <img src={r.file.content} alt={f.path} style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} />, download: dl }),
      ).catch(() => setViewer({ title: base, sub, body: <Text size="sm" c="dimmed">Couldn't load the image.</Text>, download: dl }));
      return;
    }
    if (["zip", "parquet", "xlsx", "xls", "docx"].includes(ext)) {
      setViewer({ title: base, sub, body: <Text size="sm" c="dimmed">Binary file — use Download to view.</Text>, download: dl });
      return;
    }
    setViewer({ title: base, sub, body: <Loader size="xs" color="terracotta" />, download: dl });
    api.readFile(f.researchId, f.path).then((r) =>
      setViewer({
        title: base, sub,
        body: ext === "md"
          ? <Box className="agent-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{r.file.content}</ReactMarkdown></Box>
          : <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.55, fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.file.content}</pre>,
        download: dl,
      }),
    ).catch(() => setViewer({ title: base, sub, body: <Text size="sm" c="dimmed">Couldn't read this file.</Text>, download: dl }));
  };

  /* ---- rows for the current path (any depth) ---- */
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const fileRow = (f: ResultFile): Row => {
      const base = f.path.split("/").pop() || f.path;
      return {
        key: f.path, kind: "file", name: base, type: fileType(f), size: fmtSize(f.size), updatedAt: f.updatedAt,
        icon: fileIcon(f), onOpen: () => openFile(f),
        onDownload: () => void downloadUrl(api.fileRawUrl(f.researchId, f.path), base),
      };
    };
    if (!rid) {
      for (const r of researches) out.push({
        key: r.id, kind: "folder", name: r.title, type: "Folder", size: `${r.count} items`, updatedAt: r.updatedAt,
        icon: <Folder size={15} color="#c07d3a" fill="#f3d9bd" />, onOpen: () => go([r.id]),
      });
    } else if (inDocs) {
      for (const d of rDocs) out.push({
        key: d.name, kind: "doc", name: d.title || d.name, type: "Document", size: `${Math.max(1, Math.round(d.chars / 1024))} KB`,
        updatedAt: d.updatedAt, icon: <FileText size={15} color="#2b5fd1" />, onOpen: () => openDoc(d),
        onDownload: () => api.getDocument(d.researchId, d.name).then((r) => downloadText(`${d.name}.md`, r.document.content)),
      });
    } else {
      // Subfolders directly under the current directory.
      const dirs = new Map<string, { count: number; updatedAt: number }>();
      for (const f of rFiles) {
        const c = childDir(f.path, dirPath);
        if (!c) continue;
        const e = dirs.get(c) ?? { count: 0, updatedAt: 0 };
        e.count += 1; e.updatedAt = Math.max(e.updatedAt, f.updatedAt || 0);
        dirs.set(c, e);
      }
      if (!dirPath && rDocs.length) out.push({
        key: DOCS_FOLDER, kind: "folder", name: DOCS_FOLDER, type: "Folder", size: `${rDocs.length} items`,
        updatedAt: Math.max(...rDocs.map((d) => d.updatedAt || 0)),
        icon: <Folder size={15} color="#2b5fd1" fill="#d6e2f7" />, onOpen: () => go([rid, DOCS_FOLDER]),
      });
      for (const [name, e] of Array.from(dirs.entries()).sort()) out.push({
        key: `${dirPath}/${name}`, kind: "folder", name, type: "Folder", size: `${e.count} items`, updatedAt: e.updatedAt,
        icon: <Folder size={15} color="#c07d3a" fill="#f3d9bd" />, onOpen: () => go([rid, ...(dirPath ? dirPath.split("/") : []), name]),
      });
      for (const f of rFiles.filter((f) => inDir(f.path, dirPath))) out.push(fileRow(f));
    }
    const q = search.trim().toLowerCase();
    const shown = q ? out.filter((r) => r.name.toLowerCase().includes(q)) : out;
    return shown.sort((a, b) => (a.kind === "folder" ? 0 : 1) - (b.kind === "folder" ? 0 : 1) || b.updatedAt - a.updatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, dirPath, inDocs, researches, rDocs, rFiles, search]);

  /* ---- left tree with nested, chevroned subfolders ---- */
  const isExp = (k: string) => expanded.has(k);
  const toggleExp = (k: string) => setExpanded((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  function TreeDir({ ridX, node, depth }: { ridX: string; node: DirNode; depth: number }) {
    const key = `${ridX}/${node.path}`;
    const active = rid === ridX && dirPath === node.path && !inDocs;
    const hasKids = node.children.length > 0;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, padding: `4px 6px 4px ${8 + depth * 14}px`, borderRadius: 6, background: active ? "#eeece6" : "transparent" }}>
          <span onClick={() => hasKids && toggleExp(key)} style={{ display: "grid", placeItems: "center", width: 15, cursor: hasKids ? "pointer" : "default", color: "#8a8680" }}>
            {hasKids ? (isExp(key) ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
          </span>
          <span onClick={() => go([ridX, ...node.path.split("/")])} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, cursor: "pointer", fontSize: 12.5, color: "#3a3733" }}>
            {active ? <FolderOpen size={13} color="#c07d3a" /> : <Folder size={13} color="#c07d3a" />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
          </span>
        </div>
        {hasKids && isExp(key) && node.children.map((c) => <TreeDir key={c.path} ridX={ridX} node={c} depth={depth + 1} />)}
      </div>
    );
  }

  const tree = (
    <div style={{ width: 250, flex: "0 0 auto", borderRight: "1px solid #ebe9e4", background: "#faf9f6", overflowY: "auto", padding: "14px 8px" }}>
      <div style={{ padding: "0 10px 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", color: "#8a8680" }}>WORKSPACE · RESEARCHES</div>
      <button onClick={() => go([])}
        style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "6px 10px", border: "none", background: path.length === 0 ? "#eeece6" : "transparent", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#1c1b19" }}>
        <Home size={14} color="#57534d" /> All researches
      </button>
      {researches.map((r) => {
        const open = isExp(r.id);
        const dirTree = buildDirTree(files.filter((f) => f.researchId === r.id).map((f) => f.path));
        const hasDocs = docs.some((d) => d.researchId === r.id);
        const docsActive = rid === r.id && inDocs;
        return (
          <div key={r.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 3, width: "100%", padding: "5px 4px 5px 8px", background: rid === r.id && !dirPath && !inDocs ? "#eeece6" : "transparent", borderRadius: 7 }}>
              <span onClick={() => toggleExp(r.id)} style={{ display: "grid", placeItems: "center", width: 16, cursor: "pointer", color: "#8a8680" }}>
                {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
              <span onClick={() => go([r.id])} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, cursor: "pointer", fontSize: 13, color: "#1c1b19" }}>
                {rid === r.id ? <FolderOpen size={14} color="#c07d3a" /> : <Folder size={14} color="#c07d3a" />}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
              </span>
            </div>
            {open && (
              <div>
                {hasDocs && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 6px 4px 22px", borderRadius: 6, background: docsActive ? "#eeece6" : "transparent" }}>
                    <span style={{ width: 15 }} />
                    <span onClick={() => go([r.id, DOCS_FOLDER])} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, cursor: "pointer", fontSize: 12.5, color: "#3a3733" }}>
                      <Folder size={13} color="#2b5fd1" /> {DOCS_FOLDER}
                    </span>
                  </div>
                )}
                <div style={{ marginLeft: 14 }}>
                  {dirTree.map((n) => <TreeDir key={n.path} ridX={r.id} node={n} depth={0} />)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ---- breadcrumb ---- */
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: "Workspace", onClick: () => go([]) }];
  if (research) crumbs.push({ label: research.title, onClick: () => go([rid]) });
  if (inDocs) crumbs.push({ label: DOCS_FOLDER });
  else if (dirPath) dirPath.split("/").forEach((seg, i, all) => crumbs.push({
    label: seg,
    onClick: i < all.length - 1 ? () => go([rid, ...all.slice(0, i + 1)]) : undefined,
  }));

  const title = inDocs ? DOCS_FOLDER : dirPath ? dirPath.split("/").pop()! : research?.title ?? "All researches";

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#ffffff" }}>
      <Sidebar nav={chrome.nav} openTask={chrome.openTask} menuOpen={chrome.menuOpen} toggleMenu={chrome.toggleMenu} menuItems={chrome.menuItems} />

      <section style={{ flex: 1, display: "flex", minHeight: 0, background: "#fff" }}>
        {tree}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {loading ? (
            <Group justify="center" py={60}><Loader color="terracotta" /></Group>
          ) : viewer ? (
            /* ---- file viewer ---- */
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 20 }}>
              <Box maw={980} mx="auto" style={{ border: "1px solid #e2e0da", borderRadius: 10, overflow: "hidden" }}>
                <Group px="md" py={9} justify="space-between" style={{ borderBottom: "1px solid #eceae4" }}>
                  <Group gap={8} style={{ minWidth: 0 }}>
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setViewer(null)} aria-label="Back"><ArrowLeft size={15} /></ActionIcon>
                    <Box style={{ minWidth: 0 }}>
                      <Text fw={600} size="sm" truncate>{viewer.title}</Text>
                      <Text size="xs" c="dimmed" ff="monospace" truncate>{viewer.sub}</Text>
                    </Box>
                  </Group>
                  {viewer.download && <Button size="compact-sm" variant="light" leftSection={<Download size={13} />} onClick={viewer.download}>Download</Button>}
                </Group>
                <Box p="lg" style={{ maxHeight: "76vh", overflowY: "auto" }}>{viewer.body}</Box>
              </Box>
            </div>
          ) : (
            /* ---- explorer ---- */
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "18px 24px 48px" }}>
              {/* breadcrumb + refresh, then the big folder title AS the page header */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                {crumbs.map((c, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span onClick={c.onClick} style={{ cursor: c.onClick ? "pointer" : "default", color: i === crumbs.length - 1 ? "#1c1b19" : "#8a8680", fontWeight: i === crumbs.length - 1 ? 600 : 400, fontSize: 13 }}>{c.label}</span>
                    {i < crumbs.length - 1 && <ChevronRight size={13} color="#c4c1b9" />}
                  </span>
                ))}
                <span style={{ flex: 1 }} />
                {rid && site && (
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", background: "#3F7355", color: "#fff", borderRadius: 8, fontSize: 12.5, fontWeight: 600, textDecoration: "none", marginRight: 8 }}
                  >
                    <Globe size={13} /> Open website <ArrowUpRight size={13} />
                  </a>
                )}
                <Tooltip label="Refresh"><ActionIcon variant="default" onClick={refresh} aria-label="refresh"><RefreshCw size={14} /></ActionIcon></Tooltip>
              </div>
              <Text fw={700} size="26px" mb={14} style={{ fontFamily: "'Google Sans Flex',sans-serif" }}>{title}</Text>

              {/* search */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 620, padding: "9px 13px", border: "1px solid #e2e0da", borderRadius: 9, background: "#fff", marginBottom: 16 }}>
                <Search size={15} color="#a29e97" />
                <input value={search} onChange={(e) => setSearch(e.currentTarget.value)} placeholder="Search this folder"
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13.5, color: "#1c1b19" }} />
              </div>

              {/* table */}
              {rows.length === 0 ? (
                <Text size="sm" c="dimmed" py="xl">Nothing here yet.</Text>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <TH>Name</TH>
                      <TH w={110}>Type</TH>
                      <TH w={110}>Size</TH>
                      <TH w={130}>Last updated</TH>
                      <TH w={46}>{""}</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} onClick={r.onOpen}
                        style={{ cursor: "pointer", borderBottom: "1px solid #f2f1ec" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#faf9f6")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <TD><span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>{r.icon}<span style={{ fontWeight: r.kind === "folder" ? 560 : 440 }}>{r.name}</span>{r.name.endsWith(".pdf") && <Badge size="xs" variant="light" color="red" tt="none">PDF</Badge>}</span></TD>
                        <TD dim>{r.type}</TD>
                        <TD mono dim>{r.size}</TD>
                        <TD dim>{timeAgo(r.updatedAt)}</TD>
                        <td style={{ padding: "6px 10px", width: 46 }}>
                          {r.onDownload && (
                            <Tooltip label="Download" withArrow>
                              <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => { e.stopPropagation(); r.onDownload!(); }} aria-label="Download"><Download size={14} /></ActionIcon>
                            </Tooltip>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
