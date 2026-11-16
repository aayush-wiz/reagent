import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Code,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  Activity,
  ArrowLeft,
  Bot,
  Brain,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Clock,
  Coins,
  Cpu,
  Database,
  Gauge,
  MessageSquare,
  Play,
  Save,
  Search,
  Settings2,
  ShieldQuestion,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";

interface Props {
  title: string;
  meta?: string;
  status?: string;
  backToSection: () => void;
}

interface Run {
  id: string;
  target: string;
  status: "success" | "failed" | "running";
  started: string;
  duration: string;
  tokens: string;
}

const RUNS: Run[] = [
  { id: "run_8f21", target: "Retrieval-Augmented Meta-Analysis", status: "success", started: "2m ago", duration: "1.84s", tokens: "128k" },
  { id: "run_8e09", target: "effects.parquet", status: "success", started: "1h ago", duration: "4.2s", tokens: "96k" },
  { id: "run_8d77", target: "Publication bias in ML benchmarks", status: "running", started: "just now", duration: "—", tokens: "41k" },
  { id: "run_8c15", target: "Cross-domain effect-size survey", status: "failed", started: "3h ago", duration: "0.6s", tokens: "12k" },
  { id: "run_8b02", target: "subgroups.csv", status: "success", started: "yesterday", duration: "2.1s", tokens: "88k" },
];

const RUN_BADGE: Record<Run["status"], { color: string; icon: React.ReactNode }> = {
  success: { color: "green", icon: <CircleCheck size={13} /> },
  failed: { color: "red", icon: <CircleX size={13} /> },
  running: { color: "blue", icon: <Activity size={13} /> },
};

// ---- Langfuse-style trace: nested spans of the agent's run ----
type SpanType = "reasoning" | "tool" | "approval" | "output" | "error";
interface Span {
  type: SpanType;
  name: string;
  offset: string; // start offset in the trace
  duration: string;
  tokens?: string;
  reasoning?: string;
  input?: Record<string, unknown>;
  output?: string;
  decision?: "approved" | "rejected";
  by?: string;
  text?: string;
}

const SPAN_META: Record<SpanType, { color: string; icon: React.ReactNode; label: string }> = {
  reasoning: { color: "grape", icon: <Brain size={13} />, label: "reasoning" },
  tool: { color: "blue", icon: <Terminal size={13} />, label: "tool" },
  approval: { color: "orange", icon: <ShieldQuestion size={13} />, label: "approval" },
  output: { color: "green", icon: <MessageSquare size={13} />, label: "output" },
  error: { color: "red", icon: <CircleX size={13} />, label: "error" },
};

function traceFor(run: Run): Span[] {
  const spans: Span[] = [
    {
      type: "reasoning",
      name: "Plan the analysis",
      offset: "0ms",
      duration: "320ms",
      tokens: "2.1k",
      reasoning:
        `The task targets “${run.target}”. I'll (1) retrieve the relevant papers, (2) extract reported effect sizes and variances, ` +
        "(3) pool them with a random-effects model, and (4) test for small-study effects. Starting with retrieval.",
    },
    {
      type: "tool",
      name: "search_papers",
      offset: "340ms",
      duration: "410ms",
      tokens: "0.4k",
      input: { query: "effect sizes; variance; retrieval-augmented", top_k: 50 },
      output: "42 papers matched (14 ML · 11 genomics · 9 physics · 8 climate).",
    },
    {
      type: "tool",
      name: "read_pdf",
      offset: "760ms",
      duration: "520ms",
      tokens: "18k",
      input: { batch: 42, sections: ["methods", "results"] },
      output: "Extracted 42 (effect_size, variance) pairs. 3 PDFs missing results tables — flagged.",
    },
    {
      type: "reasoning",
      name: "Decide next step",
      offset: "1.28s",
      duration: "180ms",
      tokens: "1.3k",
      reasoning: "Extraction looks complete. Pooling requires executing analysis.py, which writes files — this needs approval per the agent's autonomy setting.",
    },
    {
      type: "approval",
      name: "Run python analysis.py",
      offset: "1.46s",
      duration: "—",
      by: "Dr. Amina Osei",
      decision: "approved",
      text: "Requesting approval to execute analysis.py (writes forest.svg, analysis.py) in the Python sandbox.",
    },
  ];

  if (run.status === "success") {
    spans.push(
      {
        type: "tool",
        name: "python.exec",
        offset: "1.60s",
        duration: "240ms",
        tokens: "0.2k",
        input: { file: "analysis.py", kernel: "python-3.11" },
        output: "Pooled effect g = 0.412\n95% CI [0.318, 0.506]\nI² = 38%\nEgger p = 0.03\nWrote outputs/forest.svg",
      },
      {
        type: "output",
        name: "Final answer",
        offset: "1.84s",
        duration: "—",
        tokens: "3.0k",
        text:
          "Pooled standardized effect **g = 0.41** (95% CI 0.32–0.51) across 42 studies, moderate heterogeneity (I² = 38%). " +
          "Egger's test suggests possible publication bias (p = 0.03) — recommend trim-and-fill. Forest plot and analysis.py saved to Outputs.",
      }
    );
  } else if (run.status === "failed") {
    spans.push({
      type: "error",
      name: "python.exec failed",
      offset: "1.60s",
      duration: "60ms",
      input: { file: "analysis.py" },
      output: "ValueError: no effect sizes parsed — 0 usable (effect, variance) pairs. Aborting run.",
    });
  } else {
    spans.push({
      type: "reasoning",
      name: "In progress",
      offset: "1.60s",
      duration: "…",
      reasoning: "Bootstrapping confidence intervals across 2,000 resamples — still running.",
    });
  }
  return spans;
}

// available datasets the agent can be pointed at
interface DataItem {
  name: string;
  meta: string;
  type: string;
  status: string;
}
const AVAILABLE_DATA: DataItem[] = [
  { name: "effects.parquet", meta: "42 rows · effect sizes + variances", type: "table", status: "clean" },
  { name: "corpus_embeddings.npy", meta: "187 × 1536 · paper vectors", type: "vectors", status: "indexed" },
  { name: "subgroups.csv", meta: "4 subgroups · pooled estimates", type: "table", status: "clean" },
  { name: "egger_test.json", meta: "small-study bias diagnostics", type: "file", status: "flagged" },
  { name: "Full paper library", meta: "187 papers", type: "corpus", status: "ready" },
  { name: "Existing findings", meta: "58 cited items", type: "findings", status: "verified" },
];

const MODELS = [
  { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { value: "gemini-3-flash", label: "Gemini 3 Flash" },
  { value: "gpt-5-5", label: "GPT-5.5" },
  { value: "llama-4-maverick", label: "Llama 4 Maverick" },
];

const TOOLS = [
  { icon: <Cpu size={14} />, label: "Python sandbox", meta: "run code & plots", on: true },
  { icon: <Search size={14} />, label: "Web search", meta: "external literature", on: true },
  { icon: <Wrench size={14} />, label: "Scholar API", meta: "citations & metadata", on: false },
];
const SKILLS = [
  { icon: <Sparkles size={14} />, label: "Extract effect sizes", meta: "parse stats from PDFs", on: true },
  { icon: <Sparkles size={14} />, label: "Run meta-analysis", meta: "random-effects pooling", on: true },
  { icon: <Sparkles size={14} />, label: "Detect publication bias", meta: "Egger, trim-and-fill", on: true },
];

function statusBadgeColor(s: string): string {
  const v = s.toLowerCase();
  if (["indexed", "ready"].includes(v)) return "blue";
  if (["clean", "verified"].includes(v)) return "green";
  if (["flagged"].includes(v)) return "orange";
  return "gray";
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card withBorder padding="md" radius="md">
      <Group gap={7} c="dimmed">
        <ThemeIcon variant="light" color="gray" size="sm" radius="sm">
          {icon}
        </ThemeIcon>
        <Text size="xs" fw={600} c="#57534d">
          {label}
        </Text>
      </Group>
      <Text fw={700} mt={8} style={{ fontSize: 20 }}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {sub}
      </Text>
    </Card>
  );
}

function CapabilityRow({ item }: { item: { icon: React.ReactNode; label: string; meta: string; on: boolean } }) {
  return (
    <Group justify="space-between" wrap="nowrap" py={9} px="sm" style={{ borderBottom: "1px solid #f4f3ef" }}>
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" color={item.on ? "terracotta" : "gray"} size="md" radius="sm">
          {item.icon}
        </ThemeIcon>
        <Box>
          <Text size="sm" fw={500}>
            {item.label}
          </Text>
          <Text size="xs" c="dimmed">
            {item.meta}
          </Text>
        </Box>
      </Group>
      <Switch defaultChecked={item.on} color="terracotta" size="sm" />
    </Group>
  );
}

export default function AgentDetailView({ title, meta, status, backToSection }: Props) {
  const [tab, setTab] = useState<string>("overview");
  const [model, setModel] = useState<string>("claude-opus-4-8");
  const [selected, setSelected] = useState<Record<string, boolean>>({ "effects.parquet": true, "Full paper library": true });
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [saved, setSaved] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const successRate = Math.round((RUNS.filter((r) => r.status === "success").length / RUNS.length) * 100);
  const openRun = openRunId ? RUNS.find((r) => r.id === openRunId) : undefined;
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const dataTypes = useMemo(() => ["all", ...Array.from(new Set(AVAILABLE_DATA.map((d) => d.type)))], []);
  const visibleData = AVAILABLE_DATA.filter((d) => typeFilter === "all" || d.type === typeFilter);

  const toggleData = (name: string) => {
    setSelected((s) => ({ ...s, [name]: !s[name] }));
    setSaved(false);
  };

  // Real attached capabilities from the agent backend.
  const [skills, setSkills] = useState<{ slug: string; category: string; description: string }[]>([]);
  const [mcp, setMcp] = useState<{ name: string; url: string }[]>([]);
  const [llmReady, setLlmReady] = useState(true);
  useEffect(() => {
    api.agentSkills().then((d) => {
      setSkills(d.skills);
      setMcp(d.mcp);
      setLlmReady(d.configured);
    }).catch(() => {});
  }, []);
  const skillsByCat = useMemo(() => {
    const m: Record<string, typeof skills> = {};
    for (const s of skills) (m[s.category] ??= []).push(s);
    return m;
  }, [skills]);

  return (
    <Box style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#ffffff" }}>
      {/* top bar */}
      <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #e2e0da", position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
        <Button variant="subtle" color="gray" size="compact-sm" leftSection={<ArrowLeft size={15} />} onClick={backToSection}>
          Agents
        </Button>
        <Group gap="xs">
          <Button variant="default" size="compact-sm">Edit</Button>
          <Button color="dark" size="compact-sm" leftSection={<Play size={13} />}>
            Run agent
          </Button>
        </Group>
      </Group>

      <Box maw={960} mx="auto" px="lg" py="xl">
        {/* header */}
        <Group gap="md" wrap="nowrap">
          <ThemeIcon variant="light" color="terracotta" size={52} radius="md">
            <Bot size={26} />
          </ThemeIcon>
          <Box>
            <Group gap="sm">
              <Title order={1} fw={600} style={{ fontSize: 18, letterSpacing: "-0.01em" }}>
                {title}
              </Title>
              {status && (
                <Badge variant="light" color={status === "active" ? "green" : status === "paused" ? "orange" : "gray"} tt="none">
                  {status}
                </Badge>
              )}
            </Group>
            {meta && (
              <Text c="dimmed" size="sm" mt={2}>
                {meta}
              </Text>
            )}
          </Box>
        </Group>

        <Tabs value={tab} onChange={(v) => v && setTab(v)} mt="xl">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<Gauge size={14} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="runs" leftSection={<Activity size={14} />}>
              Runs
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<Settings2 size={14} />}>
              Settings
            </Tabs.Tab>
            <Tabs.Tab value="tools" leftSection={<Wrench size={14} />}>
              Tools
            </Tabs.Tab>
          </Tabs.List>

          {/* OVERVIEW */}
          <Tabs.Panel value="overview" pt="lg">
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              <StatCard icon={<Activity size={14} />} label="Total runs" value={String(RUNS.length)} sub="all time" />
              <StatCard icon={<CircleCheck size={14} />} label="Success" value={`${successRate}%`} sub="success rate" />
              <StatCard icon={<Clock size={14} />} label="Avg time" value="1.9s" sub="per run" />
              <StatCard icon={<Cpu size={14} />} label="Model" value={MODELS.find((m) => m.value === model)?.label.split(" ")[0] ?? "—"} sub="active model" />
            </SimpleGrid>

            <Title order={3} fw={600} mt={40} mb="sm" style={{ fontSize: 15 }}>
              Recent runs
            </Title>
            <Card withBorder padding={0} radius="md">
              {RUNS.slice(0, 4).map((r) => (
                <Group
                  key={r.id}
                  justify="space-between"
                  px="md"
                  py="sm"
                  style={{ borderBottom: "1px solid #f4f3ef", cursor: "pointer" }}
                  onClick={() => {
                    setOpenRunId(r.id);
                    setTab("runs");
                  }}
                >
                  <Group gap="sm">
                    <Badge variant="light" color={RUN_BADGE[r.status].color} leftSection={RUN_BADGE[r.status].icon} tt="none">
                      {r.status}
                    </Badge>
                    <Text size="sm" fw={500} truncate maw={360}>
                      {r.target}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {r.started}
                  </Text>
                </Group>
              ))}
            </Card>
          </Tabs.Panel>

          {/* RUNS — record + clickable logs */}
          <Tabs.Panel value="runs" pt="lg">
            {openRun ? (
              <>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ActionIcon variant="default" onClick={() => setOpenRunId(null)} aria-label="Back to runs">
                      <ChevronLeft size={16} />
                    </ActionIcon>
                    <Text ff="monospace" fw={600}>
                      {openRun.id}
                    </Text>
                    <Badge variant="light" color={RUN_BADGE[openRun.status].color} leftSection={RUN_BADGE[openRun.status].icon} tt="none" size="sm">
                      {openRun.status}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {openRun.target} · {openRun.started} · {openRun.tokens} tokens
                  </Text>
                </Group>
                {/* trace summary */}
                <Group gap="xs" mb="md" wrap="wrap">
                  <Badge variant="light" color="gray" leftSection={<Clock size={12} />} tt="none" size="sm">
                    {openRun.duration} latency
                  </Badge>
                  <Badge variant="light" color="gray" leftSection={<Coins size={12} />} tt="none" size="sm">
                    {openRun.tokens} tokens
                  </Badge>
                  <Badge variant="light" color="gray" leftSection={<Cpu size={12} />} tt="none" size="sm">
                    {MODELS.find((m) => m.value === model)?.label ?? "—"}
                  </Badge>
                  <Badge variant="light" color="gray" tt="none" size="sm">
                    {traceFor(openRun).length} spans
                  </Badge>
                </Group>

                {/* span tree */}
                <Accordion
                  multiple
                  defaultValue={traceFor(openRun).map((_, i) => `s${i}`)}
                  variant="separated"
                  radius="md"
                  chevronPosition="right"
                >
                  {traceFor(openRun).map((sp, i) => {
                    const m = SPAN_META[sp.type];
                    return (
                      <Accordion.Item key={i} value={`s${i}`}>
                        <Accordion.Control>
                          <Group gap="sm" wrap="nowrap">
                            <ThemeIcon variant="light" color={m.color} size="md" radius="sm">
                              {m.icon}
                            </ThemeIcon>
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Group gap={8} wrap="nowrap">
                                <Badge variant="light" color={m.color} size="xs" tt="uppercase">
                                  {m.label}
                                </Badge>
                                <Text size="sm" fw={600} truncate>
                                  {sp.name}
                                </Text>
                              </Group>
                            </Box>
                            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                              {sp.offset} · {sp.duration}
                              {sp.tokens ? ` · ${sp.tokens}` : ""}
                            </Text>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap="sm" pl={44}>
                            {sp.reasoning && (
                              <Box>
                                <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4} style={{ letterSpacing: "0.05em" }}>
                                  Reasoning
                                </Text>
                                <Text size="sm" c="#3a3733" style={{ lineHeight: 1.6 }}>
                                  {sp.reasoning}
                                </Text>
                              </Box>
                            )}
                            {sp.input && (
                              <Box>
                                <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4} style={{ letterSpacing: "0.05em" }}>
                                  Input
                                </Text>
                                <Code block fz="xs">
                                  {JSON.stringify(sp.input, null, 2)}
                                </Code>
                              </Box>
                            )}
                            {sp.output && (
                              <Box>
                                <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4} style={{ letterSpacing: "0.05em" }}>
                                  Output
                                </Text>
                                <Code block fz="xs" color={sp.type === "error" ? "red" : undefined}>
                                  {sp.output}
                                </Code>
                              </Box>
                            )}
                            {sp.type === "approval" && (
                              <Box>
                                <Text size="sm" c="#3a3733" mb={8} style={{ lineHeight: 1.6 }}>
                                  {sp.text}
                                </Text>
                                <Group gap="xs">
                                  <Badge color="green" variant="light" leftSection={<CircleCheck size={12} />} tt="none">
                                    {sp.decision} by {sp.by}
                                  </Badge>
                                  <Button size="compact-xs" variant="default" disabled>
                                    Approve
                                  </Button>
                                  <Button size="compact-xs" variant="default" color="red" disabled>
                                    Reject
                                  </Button>
                                </Group>
                              </Box>
                            )}
                            {sp.text && sp.type === "output" && (
                              <Text size="sm" c="#3a3733" style={{ lineHeight: 1.6 }}>
                                {sp.text}
                              </Text>
                            )}
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    );
                  })}
                </Accordion>
              </>
            ) : (
              <>
                <Text size="sm" c="dimmed" mb="sm">
                  Every task this agent has executed — click a run to see its logs.
                </Text>
                <Card withBorder padding={0} radius="md">
                  <Table.ScrollContainer minWidth={640}>
                    <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Run</Table.Th>
                          <Table.Th>Target</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th ta="right">Duration</Table.Th>
                          <Table.Th ta="right">Tokens</Table.Th>
                          <Table.Th ta="right">Started</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {RUNS.map((r) => (
                          <Table.Tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setOpenRunId(r.id)}>
                            <Table.Td ff="monospace" fz="xs">
                              {r.id}
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" truncate maw={280}>
                                {r.target}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" color={RUN_BADGE[r.status].color} leftSection={RUN_BADGE[r.status].icon} tt="none" size="sm">
                                {r.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="right" ff="monospace" fz="xs">
                              {r.duration}
                            </Table.Td>
                            <Table.Td ta="right" ff="monospace" fz="xs">
                              {r.tokens}
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text size="xs" c="dimmed">
                                {r.started}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Card>
              </>
            )}
          </Tabs.Panel>

          {/* SETTINGS */}
          <Tabs.Panel value="settings" pt="lg">
            <Stack gap="xl">
              <Box>
                <Text fw={600} size="sm" mb={4}>
                  Instructions
                </Text>
                <Card withBorder padding="md" radius="md" bg="#faf9f6">
                  <Text size="sm" c="#3a3733" style={{ lineHeight: 1.6 }}>
                    You are {title}. {meta ?? "Assist with research tasks."} Pool effect sizes with a random-effects model,
                    verify every claim against source papers, and flag possible publication bias.
                  </Text>
                </Card>
              </Box>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Card withBorder padding="md" radius="md">
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={8} style={{ letterSpacing: "0.05em" }}>
                    Model
                  </Text>
                  <Select
                    data={MODELS}
                    value={model}
                    onChange={(v) => v && setModel(v)}
                    leftSection={<Cpu size={14} />}
                    allowDeselect={false}
                    comboboxProps={{ withinPortal: true }}
                  />
                </Card>
                <Card withBorder padding="md" radius="md">
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={8} style={{ letterSpacing: "0.05em" }}>
                    Autonomy
                  </Text>
                  <Select
                    data={["Ask before acting", "Run autonomously", "Run on schedule"]}
                    defaultValue="Ask before acting"
                    allowDeselect={false}
                    comboboxProps={{ withinPortal: true }}
                  />
                </Card>
              </SimpleGrid>

              {/* DATA SOURCES — dropdown filter + selectable table + save */}
              <Box>
                <Group justify="space-between" mb={8}>
                  <Text fw={600} size="sm">
                    Data sources
                  </Text>
                  <Group gap="xs">
                    <Select
                      size="xs"
                      w={150}
                      value={typeFilter}
                      onChange={(v) => setTypeFilter(v || "all")}
                      data={dataTypes.map((t) => ({ value: t, label: t === "all" ? "All types" : t }))}
                      leftSection={<Database size={13} />}
                      allowDeselect={false}
                      comboboxProps={{ withinPortal: true }}
                    />
                    <Button
                      size="compact-sm"
                      color="terracotta"
                      variant={saved ? "light" : "filled"}
                      leftSection={saved ? <CircleCheck size={14} /> : <Save size={14} />}
                      onClick={() => setSaved(true)}
                    >
                      {saved ? "Saved" : `Save (${selectedCount})`}
                    </Button>
                  </Group>
                </Group>
                <Card withBorder padding={0} radius="md">
                  <Table.ScrollContainer minWidth={560}>
                    <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th w={40} />
                          <Table.Th>Name</Table.Th>
                          <Table.Th>Details</Table.Th>
                          <Table.Th>Type</Table.Th>
                          <Table.Th ta="right">Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {visibleData.map((d) => (
                          <Table.Tr key={d.name} style={{ cursor: "pointer" }} onClick={() => toggleData(d.name)}>
                            <Table.Td onClick={(e) => e.stopPropagation()}>
                              <Checkbox size="xs" radius="sm" color="terracotta" checked={!!selected[d.name]} onChange={() => toggleData(d.name)} aria-label={`select ${d.name}`} />
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={600}>
                                {d.name}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {d.meta}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" color="gray" size="sm" tt="none">
                                {d.type}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Badge variant="light" color={statusBadgeColor(d.status)} size="sm" tt="none">
                                {d.status}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Card>
              </Box>

              <Box>
                <Text fw={600} size="sm" mb={6}>
                  Skills
                </Text>
                <Card withBorder padding={0} radius="md">
                  {SKILLS.map((s) => (
                    <CapabilityRow key={s.label} item={s} />
                  ))}
                </Card>
              </Box>
            </Stack>
          </Tabs.Panel>

          {/* TOOLS — real skills / connectors / MCP attached to the agent */}
          <Tabs.Panel value="tools" pt="lg">
            <Group justify="space-between" mb="sm">
              <Text size="sm" c="dimmed">
                {skills.length} skills the agent can call during a run — grounded in live scientific databases.
              </Text>
              <Badge variant="light" color={llmReady ? "green" : "orange"} tt="none">
                {llmReady ? "LLM connected" : "set OPENROUTER_API_KEY"}
              </Badge>
            </Group>

            {Object.entries(skillsByCat).map(([cat, list]) => (
              <Box key={cat} mb="md">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={6} style={{ letterSpacing: "0.05em" }}>
                  {cat}
                </Text>
                <Card withBorder padding={0} radius="md">
                  {list.map((s) => (
                    <Group key={s.slug} justify="space-between" wrap="nowrap" py={9} px="sm" style={{ borderBottom: "1px solid #f4f3ef" }}>
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                        <ThemeIcon variant="light" color="terracotta" size="md" radius="sm">
                          <Wrench size={13} />
                        </ThemeIcon>
                        <Box style={{ minWidth: 0 }}>
                          <Text size="sm" fw={500} ff="monospace">
                            {s.slug}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {s.description}
                          </Text>
                        </Box>
                      </Group>
                      <Switch defaultChecked color="terracotta" size="sm" />
                    </Group>
                  ))}
                </Card>
              </Box>
            ))}

            <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={6} mt="lg" style={{ letterSpacing: "0.05em" }}>
              MCP servers
            </Text>
            <Card withBorder padding="md" radius="md">
              {mcp.length ? (
                mcp.map((m) => (
                  <Group key={m.url} justify="space-between">
                    <Text size="sm" fw={500}>{m.name}</Text>
                    <Text size="xs" c="dimmed">{m.url}</Text>
                  </Group>
                ))
              ) : (
                <Text size="sm" c="dimmed">
                  No MCP servers attached. Add them via <Code>REAGENT_MCP_SERVERS</Code> in .env to expose their tools to the agent.
                </Text>
              )}
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Box>
    </Box>
  );
}
