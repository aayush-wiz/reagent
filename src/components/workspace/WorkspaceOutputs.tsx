/**
 * WorkspaceOutputs — the Outputs panel's real data: the files the agent
 * actually produced in the research's compute workspace. No dummy rows.
 *
 *   category "chart"  → images (svg/png) rendered inline
 *   category "table"  → csv/tsv previewed as a table
 *   category "file"   → everything else, opened as text
 *
 * `show` picks which categories to render (drives the All/Charts/Tables/Files tabs).
 */
import { useEffect, useMemo, useState } from "react";
import { ActionIcon, Box, Center, Group, Loader, Table, Text, Tooltip } from "@mantine/core";
import { ArrowLeft, BarChart3, Download, FileText, FileType, RefreshCw, TableProperties } from "lucide-react";
import { api, type WorkspaceFile } from "../../lib/api";
import { downloadUrl } from "../../lib/download";

const isPdf = (f: WorkspaceFile) => f.ext === ".pdf";
const baseName = (p: string) => p.split("/").pop() || p;

interface Props {
  researchId: string;
  show: ("chart" | "table" | "file")[];
  fill?: boolean;
  refreshKey?: number;
}

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(f: WorkspaceFile) {
  if (isPdf(f)) return <FileType size={15} color="#b3402e" />;
  if (f.category === "chart") return <BarChart3 size={15} color="#2b5fd1" />;
  if (f.category === "table") return <TableProperties size={15} color="#3a7d44" />;
  return <FileText size={15} color="#8a8680" />;
}

// Parse a small CSV/TSV into header + rows for preview.
function parseTable(text: string, tab: boolean): { cols: string[]; rows: string[][] } {
  const sep = tab ? "\t" : ",";
  const lines = text.trim().split(/\r?\n/).slice(0, 200);
  const split = (l: string) => l.split(sep).map((c) => c.trim());
  const cols = split(lines[0] ?? "");
  const rows = lines.slice(1).map(split);
  return { cols, rows };
}

export default function WorkspaceOutputs({ researchId, show, fill, refreshKey }: Props) {
  const [files, setFiles] = useState<WorkspaceFile[] | null>(null);
  const [open, setOpen] = useState<{ file: WorkspaceFile; kind: "text" | "image" | "pdf"; content: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Close the reader, revoking any PDF blob URL we created.
  const closeReader = () =>
    setOpen((cur) => {
      if (cur?.kind === "pdf" && cur.content) URL.revokeObjectURL(cur.content);
      return null;
    });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .listFiles(researchId)
      .then((r) => alive && setFiles(r.files))
      .catch(() => alive && setFiles([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [researchId, refreshKey]);

  const shown = useMemo(() => (files ?? []).filter((f) => show.includes(f.category)), [files, show]);

  async function openFile(f: WorkspaceFile) {
    if (isPdf(f)) {
      // PDFs can't be read as text — fetch the raw bytes (authenticated) and
      // preview them inline from a blob URL.
      setOpen({ file: f, kind: "pdf", content: "" });
      try {
        const res = await fetch(api.fileRawUrl(researchId, f.path));
        setOpen({ file: f, kind: "pdf", content: URL.createObjectURL(await res.blob()) });
      } catch {
        setOpen({ file: f, kind: "text", content: "Couldn't load this PDF." });
      }
      return;
    }
    setOpen({ file: f, kind: f.category === "chart" ? "image" : "text", content: "" });
    api
      .readFile(researchId, f.path)
      .then((r) => setOpen({ file: f, kind: r.file.kind, content: r.file.content }))
      .catch(() => setOpen({ file: f, kind: "text", content: "Couldn't read this file." }));
  }

  const wrap = {
    border: "1px solid #e2e0da",
    borderRadius: 8,
    background: "#fff",
    display: "flex",
    flexDirection: "column" as const,
    ...(fill ? { flex: 1, minHeight: 0 } : {}),
    overflow: "hidden",
  };

  // ── reader ──
  if (open) {
    const f = open.file;
    const isSvg = f.ext === ".svg";
    const isTable = f.category === "table";
    const tableData = isTable && open.content ? parseTable(open.content, f.ext === ".tsv") : null;
    return (
      <Box style={wrap}>
        <Group px="sm" py={8} justify="space-between" style={{ borderBottom: "1px solid #eceae4", flex: "0 0 auto" }}>
          <Group gap={6}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={closeReader} aria-label="Back">
              <ArrowLeft size={15} />
            </ActionIcon>
            {iconFor(f)}
            <Text fw={600} size="sm">
              {f.path}
            </Text>
            <Text size="xs" c="dimmed">
              {human(f.size)}
            </Text>
          </Group>
          <Tooltip label="Download" withArrow>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Download"
              onClick={() => downloadUrl(api.fileRawUrl(researchId, f.path), baseName(f.path))}>
              <Download size={15} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Box p="md" style={{ overflow: "auto", minHeight: 0, flex: 1 }}>
          {!open.content ? (
            <Center py="xl">
              <Loader size="sm" color="terracotta" />
            </Center>
          ) : open.kind === "pdf" ? (
            <iframe src={open.content} title={f.path} style={{ width: "100%", height: "78vh", border: "none", borderRadius: 8 }} />
          ) : open.kind === "image" ? (
            isSvg ? (
              <div style={{ maxWidth: "100%" }} dangerouslySetInnerHTML={{ __html: open.content }} />
            ) : (
              <img src={open.content} alt={f.path} style={{ maxWidth: "100%", height: "auto" }} />
            )
          ) : tableData ? (
            <Table.ScrollContainer minWidth={400}>
              <Table withTableBorder withRowBorders highlightOnHover verticalSpacing="xs" horizontalSpacing="sm" fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    {tableData.cols.map((c, i) => (
                      <Table.Th key={i}>{c}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tableData.rows.map((row, ri) => (
                    <Table.Tr key={ri}>
                      {row.map((cell, ci) => (
                        <Table.Td key={ci}>{cell}</Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, lineHeight: 1.55, color: "#1c1b19" }}>
              {open.content}
            </pre>
          )}
        </Box>
      </Box>
    );
  }

  // ── list ──
  return (
    <Box style={wrap}>
      <Group px="sm" py={8} justify="space-between" style={{ borderBottom: "1px solid #eceae4", flex: "0 0 auto" }}>
        <Text fw={600} size="sm">
          {show.length === 1 ? { chart: "Figures", table: "Data tables", file: "Files" }[show[0]] : "Outputs"}
        </Text>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setOpen(null)} aria-label="Refresh" component="div">
          <RefreshCw size={13} onClick={() => api.listFiles(researchId).then((r) => setFiles(r.files)).catch(() => {})} />
        </ActionIcon>
      </Group>
      <Box style={{ overflowY: "auto", minHeight: 0, flex: fill ? 1 : undefined }}>
        {loading && !files ? (
          <Center py="md">
            <Loader size="xs" color="terracotta" />
          </Center>
        ) : shown.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" py="xl" px="md">
            Nothing yet — the agent's figures, tables, and files will appear here as it produces them.
          </Text>
        ) : (
          shown.map((f) => (
            <Group
              key={f.path}
              px="sm"
              py={10}
              justify="space-between"
              wrap="nowrap"
              onClick={() => openFile(f)}
              style={{ borderBottom: "1px solid #f2f1ec", cursor: "pointer" }}
            >
              <Group gap={9} wrap="nowrap" style={{ minWidth: 0 }}>
                {iconFor(f)}
                <Text size="sm" truncate>
                  {f.path}
                </Text>
              </Group>
              <Group gap={6} wrap="nowrap" style={{ flex: "0 0 auto" }}>
                <Text size="xs" c="dimmed">{human(f.size)}</Text>
                <Tooltip label="Download" withArrow>
                  <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Download"
                    onClick={(e) => { e.stopPropagation(); void downloadUrl(api.fileRawUrl(researchId, f.path), baseName(f.path)); }}>
                    <Download size={13} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          ))
        )}
      </Box>
    </Box>
  );
}
