import { useEffect, useState } from "react";
import { Anchor, Badge, Box, Button, Center, Group, Loader, Text } from "@mantine/core";
import { ArrowLeft, FileText } from "lucide-react";
import { api } from "../../lib/api";
import NotionReader from "./NotionReader";
import PdfViewer from "./PdfViewer";

interface Props {
  paperId: string;
  backToSection: () => void;
}

/** Reads an imported/library paper: fetches its assembled document and renders
 *  it in the Notion-style reader (open-access full text when available). */
export default function PaperReader({ paperId, backToSection }: Props) {
  const [state, setState] = useState<{ markdown: string; html: string | null; source: string; pdfUrl?: string; doi?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // null = probing, true = the proxied PDF is a real fetchable PDF, false = fall back to text.
  const [pdfOk, setPdfOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    api
      .getPaperContent(paperId)
      .then((d) => alive && setState({ markdown: d.markdown, html: d.html, source: d.source, pdfUrl: d.paper.pdfUrl, doi: d.paper.doi }))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [paperId]);

  // Probe the PDF proxy: publisher PDFs (Wiley, Elsevier…) are often blocked/
  // paywalled and 502. Only show the PDF viewer if it's a real PDF; else fall
  // back to the clean text reader instead of "Failed to load PDF file".
  useEffect(() => {
    if (!state) return;
    if (!state.pdfUrl) {
      setPdfOk(false);
      return;
    }
    setPdfOk(null);
    const ctrl = new AbortController();
    fetch(api.paperPdfUrl(paperId), { signal: ctrl.signal })
      .then((r) => {
        setPdfOk(r.ok && (r.headers.get("content-type") || "").includes("pdf"));
        ctrl.abort(); // headers are enough — don't download the whole PDF twice
      })
      .catch(() => setPdfOk(false));
    return () => ctrl.abort();
  }, [state, paperId]);

  const sourceLabel: Record<string, string> = {
    "arxiv-html": "full paper · arXiv",
    "europepmc-fulltext": "open-access full text",
    "pdf-fulltext": "full text · PDF",
    abstract: "abstract",
    metadata: "metadata only",
  };

  return (
    <Box style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#ffffff" }}>
      <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #e2e0da", position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
        <Button variant="subtle" color="gray" size="compact-sm" leftSection={<ArrowLeft size={15} />} onClick={backToSection}>
          Papers
        </Button>
        <Group gap="xs">
          {state && (
            <Badge variant="light" color="gray" tt="none" size="sm">
              {sourceLabel[state.source] ?? state.source}
            </Badge>
          )}
          {state?.pdfUrl && (
            <Anchor href={state.pdfUrl} target="_blank">
              <Button variant="default" size="compact-sm" leftSection={<FileText size={13} />}>
                PDF
              </Button>
            </Anchor>
          )}
        </Group>
      </Group>

      {loading ? (
        <Center py={80}>
          <Loader color="terracotta" />
        </Center>
      ) : error ? (
        <Text c="dimmed" ta="center" py={80}>
          Couldn't load this paper.
        </Text>
      ) : pdfOk === null ? (
        <Center py={80}>
          <Loader color="terracotta" />
        </Center>
      ) : pdfOk ? (
        // The real paper, ditto — render the actual PDF (figures, tables, layout)
        // via the proxied same-origin URL. Same approach as answerThis.
        <Box style={{ height: "calc(100vh - 53px)" }}>
          <PdfViewer uri={api.paperPdfUrl(paperId)} />
        </Box>
      ) : (
        // No fetchable PDF (paywalled/blocked publisher) → clean text reader.
        <Box maw={800} mx="auto" px="lg" py="xl">
          {state && <NotionReader markdown={state.markdown} />}
        </Box>
      )}
    </Box>
  );
}
