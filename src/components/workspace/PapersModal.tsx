import { useState } from "react";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { FileUp, Search, Upload } from "lucide-react";
import { api, type PaperSearchResult } from "../../lib/api";

interface Props {
  opened: boolean;
  onClose: () => void;
  /** Research to import selected papers into. */
  researchId: string;
}

export default function PapersModal({ opened, onClose, researchId }: Props) {
  const [mode, setMode] = useState<"search" | "upload">("search");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PaperSearchResult[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  const pickedCount = Object.values(picked).filter(Boolean).length;

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setImported(null);
    try {
      const { results } = await api.searchPapers(q);
      setResults(results);
      setPicked({});
    } catch {
      setError("Search failed — try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const doImport = async () => {
    const chosen = results.filter((r) => picked[r.id]);
    if (!chosen.length) return;
    setLoading(true);
    try {
      const { imported } = await api.importPapers(researchId, chosen);
      setImported(imported);
      setPicked({});
    } catch {
      setError("Import failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add papers" size="xl" radius={0} centered>
      <SegmentedControl
        fullWidth
        value={mode}
        onChange={(v) => setMode(v as "search" | "upload")}
        data={[
          { value: "search", label: (<Group gap={6} justify="center"><Search size={14} /> Search papers</Group>) as unknown as string },
          { value: "upload", label: (<Group gap={6} justify="center"><Upload size={14} /> Upload papers</Group>) as unknown as string },
        ]}
        mb="md"
      />

      {mode === "search" ? (
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Searches across journals via OpenAlex, Crossref &amp; Semantic Scholar — deduped and ranked by relevance.
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              flex={1}
              radius={0}
              placeholder="e.g. retrieval-augmented generation for question answering"
              leftSection={<Search size={15} />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <Button radius={0} color="terracotta" onClick={runSearch} loading={loading && results.length === 0}>
              Search
            </Button>
          </Group>

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}
          {imported !== null && (
            <Text size="sm" c="green">
              Imported {imported} paper{imported === 1 ? "" : "s"} into your library.
            </Text>
          )}

          {loading && results.length === 0 ? (
            <Group justify="center" py="xl">
              <Loader size="sm" color="terracotta" />
            </Group>
          ) : (
            <Box style={{ maxHeight: 380, overflowY: "auto", border: results.length ? "1px solid #eceae4" : "none" }}>
              {results.map((r) => (
                <Group
                  key={r.id}
                  align="flex-start"
                  gap="sm"
                  wrap="nowrap"
                  p="sm"
                  style={{ borderBottom: "1px solid #f4f3ef", cursor: "pointer" }}
                  onClick={() => setPicked((p) => ({ ...p, [r.id]: !p[r.id] }))}
                >
                  <Checkbox
                    mt={2}
                    size="xs"
                    color="terracotta"
                    checked={!!picked[r.id]}
                    onChange={(e) => setPicked((p) => ({ ...p, [r.id]: e.currentTarget.checked }))}
                    aria-label="select"
                  />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} lh={1.35}>
                      {r.title}
                    </Text>
                    <Text size="xs" c="dimmed" mt={2}>
                      {r.authors.slice(0, 4).join(", ")}
                      {r.authors.length > 4 ? " et al." : ""}
                      {r.venue ? ` · ${r.venue}` : ""}
                      {r.year ? ` · ${r.year}` : ""}
                    </Text>
                    <Group gap={6} mt={6}>
                      <Badge size="xs" variant="light" color="gray" tt="none">
                        ✳ {r.citations} cites
                      </Badge>
                      {r.openAccess && (
                        <Badge size="xs" variant="light" color="green" tt="none">
                          open access
                        </Badge>
                      )}
                      {r.sources.map((s) => (
                        <Badge key={s} size="xs" variant="light" color="blue" tt="none">
                          {s}
                        </Badge>
                      ))}
                      {r.pdfUrl && (
                        <Anchor href={r.pdfUrl} target="_blank" size="xs" onClick={(e) => e.stopPropagation()}>
                          PDF
                        </Anchor>
                      )}
                    </Group>
                  </Box>
                </Group>
              ))}
            </Box>
          )}

          {results.length > 0 && (
            <Group justify="flex-end">
              <Button radius={0} variant="default" onClick={onClose}>
                Close
              </Button>
              <Button radius={0} color="dark" disabled={!pickedCount} loading={loading && pickedCount > 0} onClick={doImport}>
                Import {pickedCount || ""} selected
              </Button>
            </Group>
          )}
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Upload PDFs from your machine. We'll extract the title, authors and abstract on import.
          </Text>
          <Box
            style={{
              border: "1.5px dashed #d8d5ce",
              padding: "36px 16px",
              textAlign: "center",
              cursor: "pointer",
            }}
            component="label"
          >
            <input type="file" accept="application/pdf" multiple style={{ display: "none" }} />
            <FileUp size={26} color="#a8a49d" style={{ margin: "0 auto 8px" }} />
            <Text size="sm" fw={600}>
              Drop PDFs here or click to browse
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              PDF · up to 50 MB each
            </Text>
          </Box>
          <Group justify="flex-end">
            <Button radius={0} variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button radius={0} color="dark" disabled>
              Upload
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
