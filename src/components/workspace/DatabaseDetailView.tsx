import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge, Box, Button, Center, Group, Loader, Table, Tabs, Text, Title } from "@mantine/core";
import { ArrowLeft, BookText, Database, TableProperties, Table2, FileText } from "lucide-react";
import { api, type CatalogSkill, type DbSample } from "../../lib/api";

interface Props {
  name: string;
  backToSection: () => void;
}

/** Pull a named "## Section" out of the SKILL.md markdown. */
function section(md: string, heading: string): string {
  const re = new RegExp(`(^|\\n)##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n`, "i");
  const m = md.match(re);
  if (!m) return "";
  const start = m.index! + m[0].length;
  const next = md.slice(start).search(/\n##\s+/);
  return (next === -1 ? md.slice(start) : md.slice(start, start + next)).trim();
}

export default function DatabaseDetailView({ name, backToSection }: Props) {
  const [tab, setTab] = useState("overview");
  const [doc, setDoc] = useState<{ skill: CatalogSkill; markdown: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sample, setSample] = useState<DbSample | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.skillDoc(name).then((d) => alive && setDoc(d)).catch(() => {}).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [name]);

  // Load the live sample the first time the Sample tab is opened.
  useEffect(() => {
    if (tab !== "sample" || sample || sampleLoading) return;
    setSampleLoading(true);
    api.dbSample(name).then(setSample).catch(() => setSample({ columns: [], rows: [], note: "Couldn't load a sample." })).finally(() => setSampleLoading(false));
  }, [tab, name, sample, sampleLoading]);

  const md = doc?.markdown.replace(/^---[\s\S]*?---\n/, "") ?? "";
  const overview = useMemo(() => section(md, "Overview"), [md]);
  const whenToUse = useMemo(() => section(md, "When to Use This Skill"), [md]);
  const title = name.replace(/-database$/, "").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Box style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#ffffff" }}>
      <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #e2e0da", position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
        <Button variant="subtle" color="gray" size="compact-sm" leftSection={<ArrowLeft size={15} />} onClick={backToSection}>
          Data
        </Button>
        <Badge variant="light" color="green" tt="none">
          database · connected
        </Badge>
      </Group>

      <Box maw={900} mx="auto" px="lg" py="xl">
        <Group gap="sm" mb={4}>
          <Database size={20} color="#3a7d44" />
          <Title order={1} fw={600} style={{ fontSize: 20, letterSpacing: "-0.01em" }}>
            {title}
          </Title>
        </Group>

        <Tabs value={tab} onChange={(v) => v && setTab(v)} mt="md">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<BookText size={14} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="sample" leftSection={<TableProperties size={14} />}>
              Data sample
            </Tabs.Tab>
            <Tabs.Tab value="reference" leftSection={<BookText size={14} />}>
              Reference
            </Tabs.Tab>
          </Tabs.List>

          {/* OVERVIEW — concise, extracted from the SKILL doc */}
          <Tabs.Panel value="overview" pt="lg">
            {loading ? (
              <Center py="xl"><Loader color="terracotta" /></Center>
            ) : (
              <div className="agent-md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {overview || md.slice(0, 600)}
                </ReactMarkdown>
                {whenToUse && (
                  <>
                    <h3>When to use</h3>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{whenToUse}</ReactMarkdown>
                  </>
                )}
              </div>
            )}
          </Tabs.Panel>

          {/* DATA SAMPLE — record structure (schema) + live records preview */}
          <Tabs.Panel value="sample" pt="lg">
            {sampleLoading ? (
              <Center py="xl"><Loader color="terracotta" /></Center>
            ) : sample && (sample.rows?.length || sample.fields?.length || sample.collections?.length) ? (
              <>
                {/* ---- 1. DESCRIPTION ---- */}
                {sample.description && (
                  <Box mb="xl">
                    <Group gap={8} mb={6}>
                      <BookText size={15} color="#847f76" />
                      <Text fw={600} size="sm">What this database is</Text>
                    </Group>
                    <Text size="sm" c="#3a3733" style={{ lineHeight: 1.55 }}>{sample.description}</Text>
                  </Box>
                )}

                {/* ---- 2. TABLES / COLLECTIONS (names only) ---- */}
                {sample.collections && sample.collections.length > 0 && (
                  <Box mb="xl">
                    <Group gap={8} mb={6}>
                      <Table2 size={15} color="#847f76" />
                      <Text fw={600} size="sm">
                        {sample.collections.some((c) => c.kind === "file") ? "Collections & files" : "Tables"}
                      </Text>
                      <Badge variant="light" color="gray" size="sm">{sample.collections.length}</Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mb="sm">
                      What this source contains — the entities you can query (names only, not the full data).
                    </Text>
                    <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
                      {sample.collections.map((col) => (
                        <Box
                          key={col.name}
                          style={{
                            border: `1px solid ${col.name === sample.previewOf ? "#d4b3a3" : "#eceae4"}`,
                            background: col.name === sample.previewOf ? "#fbf6f2" : "#fff",
                            borderRadius: 9,
                            padding: "9px 11px",
                          }}
                        >
                          <Group gap={6} wrap="nowrap" mb={2}>
                            {col.kind === "file" ? <FileText size={13} color="#847f76" /> : <Table2 size={13} color="#847f76" />}
                            <Text ff="monospace" fw={600} size="xs">{col.name}</Text>
                            {col.name === sample.previewOf && (
                              <Badge variant="light" color="terracotta" size="xs" tt="none">previewed</Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed" lineClamp={2}>{col.description}</Text>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* ---- 3. PREVIEW ---- */}
                {(sample.fields?.length || sample.rows?.length) ? (
                  <Group gap={8} mb={2}>
                    <Database size={15} color="#847f76" />
                    <Text fw={600} size="sm">Preview{sample.previewOf ? ` · ${sample.previewOf}` : ""}</Text>
                  </Group>
                ) : null}
                {sample.source && (
                  <Text size="xs" c="dimmed" mb="md">
                    Live from {sample.source}
                  </Text>
                )}

                {/* ---- RECORD STRUCTURE: every field of one real record ---- */}
                {sample.fields && sample.fields.length > 0 && (
                  <Box mb="xl">
                    <Group gap={8} mb={6}>
                      <TableProperties size={15} color="#847f76" />
                      <Text fw={600} size="sm">Record structure</Text>
                      <Badge variant="light" color="gray" size="sm">{sample.fields.length} fields</Badge>
                      {sample.recordId && (
                        <Text size="xs" c="dimmed" ff="monospace">example: {sample.recordId}</Text>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" mb="sm">
                      The fields a single record exposes — the shape of the data (nested/unstructured values shown as JSON).
                    </Text>
                    <Table.ScrollContainer minWidth={520}>
                      <Table withTableBorder withRowBorders verticalSpacing={6} horizontalSpacing="md" fz="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th w={200}>Field</Table.Th>
                            <Table.Th w={90}>Type</Table.Th>
                            <Table.Th>Example value</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {sample.fields.map((f) => (
                            <Table.Tr key={f.name}>
                              <Table.Td ff="monospace" fw={600}>{f.name}</Table.Td>
                              <Table.Td>
                                <Badge variant="light" color="gray" size="xs" tt="none">{f.type}</Badge>
                              </Table.Td>
                              <Table.Td ff="monospace" c="#57534d" style={{ wordBreak: "break-word" }}>{f.example}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Box>
                )}

                {/* ---- RECORDS PREVIEW ---- */}
                {sample.rows.length > 0 && (
                  <Box>
                    <Group gap={8} mb={8}>
                      <Database size={15} color="#847f76" />
                      <Text fw={600} size="sm">Records preview</Text>
                      <Badge variant="light" color="gray" size="sm">{sample.recordCount ?? sample.rows.length} records</Badge>
                    </Group>
                    <Table.ScrollContainer minWidth={520}>
                      <Table withTableBorder withRowBorders highlightOnHover verticalSpacing="sm" horizontalSpacing="md" fz="sm">
                        <Table.Thead>
                          <Table.Tr>
                            {sample.columns.map((col) => (
                              <Table.Th key={col}>{col}</Table.Th>
                            ))}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {sample.rows.map((row, ri) => (
                            <Table.Tr key={ri}>
                              {row.map((cell, ci) => (
                                <Table.Td key={ci} ff={ci === 0 ? "monospace" : undefined}>
                                  {cell}
                                </Table.Td>
                              ))}
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Box>
                )}
              </>
            ) : (
              <Text c="dimmed" py="xl" ta="center">
                {sample?.note ?? "No sample available."}
              </Text>
            )}
          </Tabs.Panel>

          {/* REFERENCE — full SKILL.md */}
          <Tabs.Panel value="reference" pt="lg">
            {loading ? (
              <Center py="xl"><Loader color="terracotta" /></Center>
            ) : (
              <div className="agent-md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
              </div>
            )}
          </Tabs.Panel>
        </Tabs>
      </Box>
    </Box>
  );
}
