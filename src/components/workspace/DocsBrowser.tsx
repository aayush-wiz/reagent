/**
 * DocsBrowser — the "Docs" tab in the Outputs panel.
 *
 *   Lists a research's working documents (plan, literature-review, reasoning,
 *   methodology, findings, tasks, …) with their filled/empty state, and opens
 *   one into a Markdown reader. These are the .md files the research agent
 *   writes as it works; the user reads them here.
 */
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ActionIcon, Badge, Box, Button, Center, Group, Loader, Text, Tooltip } from "@mantine/core";
import { ArrowLeft, Download, FileText, RefreshCw } from "lucide-react";
import { api, type ApiDocMeta } from "../../lib/api";
import { downloadText } from "../../lib/download";

interface Props {
  researchId: string;
  documents: ApiDocMeta[];
  fill?: boolean;
  onRefresh?: () => void;
}

function relTime(ms: number | null): string {
  if (!ms) return "";
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function DocsBrowser({ researchId, documents, fill, onRefresh }: Props) {
  const [open, setOpen] = useState<{ name: string; title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function openDoc(d: ApiDocMeta) {
    if (!d.exists) return;
    setLoading(true);
    api
      .getDocument(researchId, d.name)
      .then((r) => setOpen({ name: r.document.name, title: r.document.title, content: r.document.content }))
      .catch(() => setOpen({ name: d.name, title: d.title, content: "_Couldn't load this document._" }))
      .finally(() => setLoading(false));
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

  // Reader view.
  if (open) {
    return (
      <Box style={wrap}>
        <Group px="sm" py={8} justify="space-between" style={{ borderBottom: "1px solid #eceae4", flex: "0 0 auto" }}>
          <Group gap={6}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setOpen(null)} aria-label="Back to documents">
              <ArrowLeft size={15} />
            </ActionIcon>
            <FileText size={14} color="#2b5fd1" />
            <Text fw={600} size="sm">
              {open.title}
            </Text>
            <Badge variant="light" color="gray" size="xs" tt="none">
              {open.name}.md
            </Badge>
          </Group>
          <Button size="compact-sm" variant="light" leftSection={<Download size={13} />} onClick={() => downloadText(`${open.name}.md`, open.content)}>
            Download
          </Button>
        </Group>
        <Box p="md" style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
          <div className="agent-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{open.content || "_Empty document._"}</ReactMarkdown>
          </div>
        </Box>
      </Box>
    );
  }

  // List view.
  return (
    <Box style={wrap}>
      <Group px="sm" py={8} justify="space-between" style={{ borderBottom: "1px solid #eceae4", flex: "0 0 auto" }}>
        <Text fw={600} size="sm">
          Working documents
        </Text>
        {onRefresh && (
          <Tooltip label="Refresh" withArrow>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onRefresh} aria-label="Refresh documents">
              <RefreshCw size={13} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Box style={{ overflowY: "auto", minHeight: 0, flex: fill ? 1 : undefined }}>
        {loading && (
          <Center py="md">
            <Loader size="xs" color="terracotta" />
          </Center>
        )}
        {documents.map((d) => (
          <Group
            key={d.name}
            px="sm"
            py={10}
            justify="space-between"
            wrap="nowrap"
            onClick={() => openDoc(d)}
            style={{
              borderBottom: "1px solid #f2f1ec",
              cursor: d.exists ? "pointer" : "default",
              opacity: d.exists ? 1 : 0.55,
            }}
          >
            <Group gap={9} wrap="nowrap" style={{ minWidth: 0 }}>
              <FileText size={15} color={d.exists ? "#2b5fd1" : "#b0aca4"} style={{ flex: "0 0 auto" }} />
              <Box style={{ minWidth: 0 }}>
                <Text size="sm" fw={520} truncate>
                  {d.title}
                </Text>
                {d.hint && (
                  <Text size="xs" c="dimmed" truncate>
                    {d.hint}
                  </Text>
                )}
              </Box>
            </Group>
            <Box style={{ flex: "0 0 auto", textAlign: "right" }}>
              {d.exists ? (
                <>
                  <Text size="xs" c="dimmed">
                    {relTime(d.updatedAt)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {d.chars.toLocaleString()} chars
                  </Text>
                </>
              ) : (
                <Badge variant="light" color="gray" size="xs" tt="none">
                  empty
                </Badge>
              )}
            </Box>
          </Group>
        ))}
      </Box>
    </Box>
  );
}
