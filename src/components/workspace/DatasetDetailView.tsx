import { useState } from "react";
import {
  Accordion,
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  List,
  NavLink,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  Database,
  Download,
  FileJson,
  FileText,
  GitBranch,
  Globe,
  MessageSquare,
  Eye,
  Cpu,
  SquarePlay,
  Table as TableIcon,
} from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  backToSection: () => void;
}

const ACTIONS: { icon: React.ReactNode; label: string }[] = [
  { icon: <Database size={15} />, label: "Dataset" },
  { icon: <SquarePlay size={15} />, label: "Notebook" },
  { icon: <Globe size={15} />, label: "Website" },
  { icon: <FileText size={15} />, label: "Paper" },
  { icon: <GitBranch size={15} />, label: "Github" },
  { icon: <Download size={15} />, label: "Download" },
];

// ---------------- README content ----------------
const CHARACTERISTICS: { name: string; text: string; link?: string }[] = [
  { name: "Multi-dimensional evaluation", text: "The benchmark is stratified into five capability dimensions — tables, charts, content faithfulness, semantic formatting, and visual grounding — each with task-specific metrics designed to capture what agentic workflows depend on." },
  { name: "Real-world enterprise documents", text: "The evaluation set contains ~2,000 human-verified pages from over 1,200 publicly available documents spanning insurance, finance, government, and other domains, ranging from straightforward to adversarially hard." },
  { name: "Dense test coverage", text: "Over 169K test rules across the five dimensions, providing fine-grained diagnostic power over precisely where a parser breaks down." },
  { name: "Human-verified annotations", text: "All annotations are produced through a two-pass pipeline: frontier VLM auto-labeling followed by targeted human correction." },
  { name: "Evaluation code suite", text: "The benchmark ships with a full evaluation framework supporting end-to-end pipeline evaluation, per-dimension scoring, and cross-pipeline comparison. The evaluation code can be found at", link: "ParseBench" },
];

interface DimRow {
  dimension: string;
  metric: string;
  pages: string;
  docs: string;
  rules: string;
  bold?: boolean;
}
const DIMENSIONS: DimRow[] = [
  { dimension: "Tables", metric: "GTRM (GriTS + TableRecordMatch)", pages: "503", docs: "284", rules: "—" },
  { dimension: "Charts", metric: "ChartDataPointMatch", pages: "568", docs: "99", rules: "4,864" },
  { dimension: "Content Faithfulness", metric: "Content Faithfulness Score", pages: "506", docs: "506", rules: "141,322" },
  { dimension: "Semantic Formatting", metric: "Semantic Formatting Score", pages: "476", docs: "476", rules: "5,997" },
  { dimension: "Layout (Visual Grounding)", metric: "Element Pass Rate", pages: "500", docs: "321", rules: "16,325" },
  { dimension: "Total (unique)", metric: "", pages: "2,078", docs: "1,211", rules: "169,011", bold: true },
];

const STATS = [
  { icon: <Eye size={15} />, label: "Views", value: "10.5K", sub: "total" },
  { icon: <Cpu size={15} />, label: "Models", value: "14", sub: "evaluated" },
  { icon: <MessageSquare size={15} />, label: "Comments", value: "0", sub: "posted" },
];

// ---------------- Data assets (tables / files that exist for the dataset) ----------------
type AssetKind = "table" | "json";
interface DataAsset {
  name: string;
  kind: AssetKind;
  meta: string;
  columns?: string[];
  rows?: string[][];
  /** right-aligned columns (numeric) for tables */
  numeric?: number[];
  preview?: string;
}

const DATA_ASSETS: DataAsset[] = [
  {
    name: "dimension_stats.csv",
    kind: "table",
    meta: "6 rows · 5 cols",
    columns: ["dimension", "metric", "pages", "docs", "rules"],
    numeric: [2, 3, 4],
    rows: DIMENSIONS.map((d) => [d.dimension, d.metric || "—", d.pages, d.docs, d.rules]),
  },
  {
    name: "documents.parquet",
    kind: "table",
    meta: "1,211 rows · 6 cols",
    columns: ["doc_id", "domain", "pages", "source", "difficulty", "verified"],
    numeric: [2],
    rows: [
      ["doc_00042", "insurance", "18", "SEC filing", "hard", "true"],
      ["doc_00108", "finance", "9", "annual report", "medium", "true"],
      ["doc_00311", "government", "24", "public record", "hard", "true"],
      ["doc_00517", "insurance", "6", "policy doc", "easy", "true"],
      ["doc_00822", "finance", "31", "10-K", "adversarial", "true"],
      ["doc_01044", "government", "12", "regulation", "medium", "true"],
    ],
  },
  {
    name: "table_records.parquet",
    kind: "table",
    meta: "284 docs · GTRM",
    columns: ["doc_id", "table_id", "rows", "cols", "merged_cells", "gtrm"],
    numeric: [2, 3, 4, 5],
    rows: [
      ["doc_00042", "t1", "14", "6", "3", "0.91"],
      ["doc_00042", "t2", "8", "4", "0", "0.98"],
      ["doc_00108", "t1", "22", "9", "7", "0.74"],
      ["doc_00311", "t3", "5", "3", "1", "0.96"],
      ["doc_00822", "t1", "40", "12", "11", "0.61"],
    ],
  },
  {
    name: "chart_points.parquet",
    kind: "table",
    meta: "4,864 rules",
    columns: ["doc_id", "chart_type", "series", "points", "match"],
    numeric: [2, 3],
    rows: [
      ["doc_00108", "bar", "3", "24", "0.88"],
      ["doc_00517", "line", "2", "40", "0.79"],
      ["doc_00822", "pie", "1", "6", "0.95"],
      ["doc_01044", "compound", "4", "56", "0.67"],
    ],
  },
  {
    name: "annotations.jsonl",
    kind: "json",
    meta: "169,011 rules",
    preview: `{"doc_id":"doc_00042","dim":"tables","rule":"header_row_match","pass":true}
{"doc_id":"doc_00042","dim":"tables","rule":"merged_cell_span","pass":false}
{"doc_id":"doc_00108","dim":"charts","rule":"datapoint(3,axis=y)","pass":true}
{"doc_id":"doc_00311","dim":"faithfulness","rule":"no_omission","pass":true}
{"doc_id":"doc_00822","dim":"formatting","rule":"strikethrough_preserved","pass":false}`,
  },
];

export default function DatasetDetailView({ title, subtitle, backToSection }: Props) {
  const [tab, setTab] = useState<string>("readme");
  const [openAsset, setOpenAsset] = useState<string | null>(null);
  const asset = openAsset ? DATA_ASSETS.find((a) => a.name === openAsset) : undefined;
  const shortName = title.split(":")[0];

  return (
    <Box style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#ffffff" }}>
      {/* top bar */}
      <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #e2e0da", position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
        <Button variant="subtle" color="gray" size="compact-sm" leftSection={<ArrowLeft size={15} />} onClick={backToSection}>
          Data
        </Button>
        <Group gap="xs">
          <Button variant="default" size="compact-sm">Share</Button>
          <Button color="dark" size="compact-sm">Use dataset</Button>
        </Group>
      </Group>

      <Box maw={960} mx="auto" px="lg" py="xl">
        <Title order={1} fw={600} style={{ fontSize: 18, letterSpacing: "-0.01em" }}>
          {title}
        </Title>
        <Text c="dimmed" mt="xs" size="md">
          {subtitle ?? "A benchmark for evaluating document parsing systems on real-world enterprise documents"}
        </Text>

        {/* action chips */}
        <Group gap="xs" mt="lg" wrap="wrap">
          {ACTIONS.map((a) => (
            <Button key={a.label} variant="default" size="compact-sm" leftSection={a.icon} radius="xl">
              {a.label}
            </Button>
          ))}
        </Group>

        <Tabs value={tab} onChange={(v) => v && setTab(v)} mt="lg">
          <Tabs.List>
            <Tabs.Tab value="readme" leftSection={<FileText size={14} />}>
              README
            </Tabs.Tab>
            <Tabs.Tab value="data" leftSection={<TableIcon size={14} />}>
              Data
            </Tabs.Tab>
          </Tabs.List>

          {/* ============ README ============ */}
          <Tabs.Panel value="readme" pt="lg">
            <Title order={2} fw={700} style={{ fontSize: 18 }}>
              About Dataset
            </Title>
            <Text size="sm" c="#3a3733" mt="lg" style={{ lineHeight: 1.6 }}>
              <b>{shortName}</b> is a benchmark for evaluating document parsing systems on real-world enterprise documents,
              with the following characteristics:
            </Text>

            <List mt="md" spacing="md" size="sm">
              {CHARACTERISTICS.map((c) => (
                <List.Item key={c.name}>
                  <Text component="span" fw={700}>
                    {c.name}.
                  </Text>{" "}
                  <Text component="span" c="#3a3733">
                    {c.text}
                  </Text>
                  {c.link ? (
                    <>
                      {" "}
                      <Anchor>{c.link}</Anchor>.
                    </>
                  ) : null}
                </List.Item>
              ))}
            </List>

            <Title order={3} mt={40} fw={600} style={{ fontSize: 15 }}>
              Dataset composition
            </Title>
            <Table.ScrollContainer minWidth={520} mt="md">
              <Table verticalSpacing="md" horizontalSpacing="md" withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Dimension</Table.Th>
                    <Table.Th>Metric</Table.Th>
                    <Table.Th ta="right">Pages</Table.Th>
                    <Table.Th ta="right">Docs</Table.Th>
                    <Table.Th ta="right">Rules</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {DIMENSIONS.map((d) => (
                    <Table.Tr key={d.dimension} style={d.bold ? { borderTop: "2px solid #e2e0da" } : undefined}>
                      <Table.Td fw={d.bold ? 700 : 400}>{d.dimension}</Table.Td>
                      <Table.Td c="#57534d">{d.metric}</Table.Td>
                      <Table.Td ta="right" ff="monospace" fw={d.bold ? 700 : 400}>{d.pages}</Table.Td>
                      <Table.Td ta="right" ff="monospace" fw={d.bold ? 700 : 400}>{d.docs}</Table.Td>
                      <Table.Td ta="right" ff="monospace" fw={d.bold ? 700 : 400}>{d.rules}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {/* Metadata */}
            <Group mt={40} gap="xs">
              <ThemeIcon variant="light" color="gray" size="md" radius="sm">
                <FileText size={16} />
              </ThemeIcon>
              <Title order={3} fw={600} style={{ fontSize: 15 }}>
                Metadata
              </Title>
            </Group>
            <Accordion mt="md" multiple variant="default" chevronPosition="right">
              <Accordion.Item value="collaborators">
                <Accordion.Control>
                  <Text fw={600}>Collaborators (5)</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Group gap="lg">
                    {["Ada L.", "Rao K.", "Mei S.", "Jonas P.", "Tariq B."].map((n) => (
                      <Group key={n} gap="xs">
                        <Avatar size="sm" radius="xl" color="gray">
                          {n[0]}
                        </Avatar>
                        <Text size="sm">{n}</Text>
                      </Group>
                    ))}
                  </Group>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="license">
                <Accordion.Control>
                  <Text fw={600}>License</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm" c="#3a3733">
                    CC BY 4.0 — free to share and adapt with attribution.
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="citation">
                <Accordion.Control>
                  <Text fw={600}>Citation</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="xs" ff="monospace" c="#3a3733" style={{ whiteSpace: "pre-wrap" }}>
                    {`@misc{${shortName.toLowerCase()}2026,\n  title={${title}},\n  year={2026}\n}`}
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="provenance">
                <Accordion.Control>
                  <Text fw={600}>Provenance</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm" c="#3a3733">
                    Sourced from publicly available enterprise filings; human-verified and de-identified.
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

            {/* Activity */}
            <Group mt={40} gap="xs">
              <ThemeIcon variant="light" color="gray" size="md" radius="sm">
                <BarChart3 size={16} />
              </ThemeIcon>
              <Title order={3} fw={600} style={{ fontSize: 15 }}>
                Activity Overview
              </Title>
            </Group>
            <Group mt="md" gap="xl" wrap="wrap">
              {STATS.map((st) => (
                <Box key={st.label} pl="sm" style={{ borderLeft: "3px solid #e2e0da", minWidth: 140 }}>
                  <Group gap={6} c="dimmed">
                    {st.icon}
                    <Text size="sm" fw={600} c="#3a3733">
                      {st.label}
                    </Text>
                  </Group>
                  <Text fw={700} mt={6} style={{ fontSize: 20 }}>
                    {st.value}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {st.sub}
                  </Text>
                </Box>
              ))}
            </Group>

            <Divider my="xl" />
          </Tabs.Panel>

          {/* ============ DATA ============ */}
          <Tabs.Panel value="data" pt="lg">
            {asset ? (
              <>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ActionIcon variant="default" onClick={() => setOpenAsset(null)} aria-label="Back to data">
                      <ChevronLeft size={16} />
                    </ActionIcon>
                    <Group gap={6}>
                      {asset.kind === "table" ? <TableIcon size={16} /> : <FileJson size={16} />}
                      <Text fw={600}>{asset.name}</Text>
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {asset.meta}
                  </Text>
                </Group>

                {asset.kind === "table" ? (
                  <Table.ScrollContainer minWidth={520}>
                    <Table verticalSpacing="sm" horizontalSpacing="md" withTableBorder withRowBorders highlightOnHover stickyHeader>
                      <Table.Thead>
                        <Table.Tr>
                          {asset.columns!.map((col, i) => (
                            <Table.Th key={col} ta={asset.numeric?.includes(i) ? "right" : "left"}>
                              {col}
                            </Table.Th>
                          ))}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {asset.rows!.map((row, ri) => (
                          <Table.Tr key={ri}>
                            {row.map((cell, ci) => (
                              <Table.Td
                                key={ci}
                                ta={asset.numeric?.includes(ci) ? "right" : "left"}
                                ff={asset.numeric?.includes(ci) ? "monospace" : undefined}
                              >
                                {cell}
                              </Table.Td>
                            ))}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                ) : (
                  <Box
                    p="md"
                    style={{ border: "1px solid #e6e4de", borderRadius: 10, background: "#faf9f6" }}
                  >
                    <Text ff="monospace" size="xs" c="#3a3733" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                      {asset.preview}
                    </Text>
                  </Box>
                )}
              </>
            ) : (
              <>
                <Text size="sm" c="dimmed" mb="md">
                  {DATA_ASSETS.length} data files in this dataset — tables, records, and annotations.
                </Text>
                <Box style={{ border: "1px solid #e6e4de", borderRadius: 10, overflow: "hidden" }}>
                  {DATA_ASSETS.map((a) => (
                    <NavLink
                      key={a.name}
                      label={a.name}
                      description={a.meta}
                      leftSection={
                        a.kind === "table" ? (
                          <ThemeIcon variant="light" color="blue" size="md" radius="sm">
                            <TableIcon size={15} />
                          </ThemeIcon>
                        ) : (
                          <ThemeIcon variant="light" color="grape" size="md" radius="sm">
                            <FileJson size={15} />
                          </ThemeIcon>
                        )
                      }
                      rightSection={
                        <Badge variant="light" color="gray" size="sm">
                          {a.kind}
                        </Badge>
                      }
                      onClick={() => setOpenAsset(a.name)}
                    />
                  ))}
                </Box>
              </>
            )}
          </Tabs.Panel>
        </Tabs>
      </Box>
    </Box>
  );
}
