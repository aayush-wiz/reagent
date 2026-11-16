/**
 * PublicLibrary — the "Public" tab of the left library panel.
 *
 *   Browses the shared public paper pool (every paper across all researches,
 *   deduped) and lets the user select papers and add them into the CURRENT
 *   research's library. Each research keeps its own library (bound to its
 *   researchId); this is how you populate it from the shared pool.
 */
import { useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, Center, Group, Loader, Text, TextInput } from "@mantine/core";
import { Check, Plus, Search } from "lucide-react";
import { api, type PublicPaper } from "../../lib/api";

interface Props {
  researchId: string;
  onAdded: () => void; // refresh the research's own library after adding
}

export default function PublicLibrary({ researchId, onAdded }: Props) {
  const [papers, setPapers] = useState<PublicPaper[] | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .listPublicPapers()
      .then((r) => alive && setPapers(r.papers))
      .catch(() => alive && setPapers([]));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (papers ?? []).filter((p) => !t || p.title.toLowerCase().includes(t) || p.byline.toLowerCase().includes(t));
  }, [papers, q]);

  function toggle(key: string) {
    setSel((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function add() {
    if (!sel.size || adding) return;
    setAdding(true);
    try {
      await api.addToLibrary(researchId, [...sel]);
      setSel(new Set());
      onAdded();
    } finally {
      setAdding(false);
    }
  }

  return (
    <Box style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box px={14} py={11} style={{ borderBottom: "1px solid #edece7" }}>
        <TextInput
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search the public library…"
          size="xs"
          leftSection={<Search size={13} />}
          styles={{ input: { background: "#f4f3ef", borderColor: "#e6e4de" } }}
        />
      </Box>

      {sel.size > 0 && (
        <Box px={14} py={8} style={{ borderBottom: "1px solid #edece7", background: "#f7f9fd" }}>
          <Button size="compact-sm" fullWidth color="terracotta" leftSection={<Plus size={14} />} loading={adding} onClick={add}>
            Add {sel.size} to library
          </Button>
        </Box>
      )}

      <Box style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {!papers ? (
          <Center py="xl">
            <Loader size="sm" color="terracotta" />
          </Center>
        ) : filtered.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" py="xl" px="md">
            {papers.length === 0 ? "The public library is empty. Papers imported into any research show up here." : "No matches."}
          </Text>
        ) : (
          filtered.map((p) => {
            const on = sel.has(p.key);
            return (
              <div
                key={p.key}
                onClick={() => toggle(p.key)}
                style={{ padding: "11px 14px", borderBottom: "1px solid #f2f1ec", cursor: "pointer", background: on ? "#f7f9fd" : "#fff", borderLeft: `2px solid ${on ? "#2b5fd1" : "transparent"}` }}
              >
                <Group gap={9} wrap="nowrap" align="flex-start">
                  <div
                    style={{
                      flex: "0 0 auto",
                      width: 16,
                      height: 16,
                      marginTop: 1,
                      borderRadius: 5,
                      border: `1.5px solid ${on ? "#2b5fd1" : "#d2cfc8"}`,
                      background: on ? "#2b5fd1" : "#fff",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {on && <Check size={11} />}
                  </div>
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Text fw={600} size="sm" style={{ lineHeight: 1.32, color: "#211f1c" }}>
                      {p.title}
                    </Text>
                    <Text size="xs" c="dimmed" truncate mt={3}>
                      {p.byline}
                    </Text>
                    <Group gap={8} mt={6} wrap="nowrap">
                      <Text size="xs" c="dimmed">
                        ✳ {p.citations}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {p.year}
                      </Text>
                      {p.inResearches > 1 && (
                        <Badge size="xs" variant="light" color="gray" tt="none">
                          in {p.inResearches} researches
                        </Badge>
                      )}
                    </Group>
                  </Box>
                </Group>
              </div>
            );
          })
        )}
      </Box>
    </Box>
  );
}
