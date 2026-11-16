import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge, Box, Button, Group, Tabs, Text, Title } from "@mantine/core";
import { ArrowLeft, BarChart3, FileText, FileType } from "lucide-react";

interface Props {
  title: string;
  meta?: string;
  status?: string;
  backToSection: () => void;
}

const CHART_BARS = [
  { label: "ML benchmarks", value: 0.49, k: 14 },
  { label: "Genomics", value: 0.44, k: 11 },
  { label: "Physics/materials", value: 0.35, k: 9 },
  { label: "Climate", value: 0.29, k: 8 },
];

export default function FindingDetailView({ title, meta, status, backToSection }: Props) {
  const [tab, setTab] = useState<string>("markdown");

  const markdown = `## Finding

**${title}**

${meta ? `_${meta}_\n` : ""}
This finding was extracted from the selected corpus and pooled with a random-effects
(DerSimonian–Laird) model. Every number below is traced back to its source paper.

### Evidence

| Subgroup | k | g | 95% CI |
| --- | --- | --- | --- |
| ML benchmarks | 14 | 0.49 | 0.40–0.58 |
| Genomics | 11 | 0.44 | 0.31–0.57 |
| Physics/materials | 9 | 0.35 | 0.22–0.48 |
| Climate | 8 | 0.29 | 0.14–0.44 |

### Notes

- Pooled standardized effect **g = 0.41** (95% CI 0.32–0.51).
- Moderate heterogeneity (I² = 38%).
- Egger's test p = 0.03 → possible publication bias; recommend trim-and-fill.
`;

  const txt = `FINDING
=======
${title}
${meta ?? ""}

pooled_effect_g      = 0.41
ci_95                = [0.32, 0.51]
heterogeneity_I2     = 38%
eggers_test_p        = 0.03
recommendation       = trim-and-fill

source_papers:
  - Kaplan 2024
  - Delgado 2023
  - Fischer 2024
  - Chen 2023
`;

  const maxV = Math.max(...CHART_BARS.map((b) => b.value));

  return (
    <Box style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#ffffff" }}>
      {/* top bar */}
      <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #e2e0da", position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
        <Button variant="subtle" color="gray" size="compact-sm" leftSection={<ArrowLeft size={15} />} onClick={backToSection}>
          Findings
        </Button>
        {status && (
          <Badge variant="light" color={status === "review" ? "orange" : "green"}>
            {status}
          </Badge>
        )}
      </Group>

      <Box maw={900} mx="auto" px="lg" py="xl">
        <Title order={1} fw={600} style={{ fontSize: 18, letterSpacing: "-0.01em", lineHeight: 1.35 }}>
          {title}
        </Title>
        {meta && (
          <Text c="dimmed" mt="xs" size="sm">
            {meta}
          </Text>
        )}

        <Tabs value={tab} onChange={(v) => v && setTab(v)} mt="lg">
          <Tabs.List>
            <Tabs.Tab value="markdown" leftSection={<FileText size={14} />}>
              Markdown
            </Tabs.Tab>
            <Tabs.Tab value="text" leftSection={<FileType size={14} />}>
              Text
            </Tabs.Tab>
            <Tabs.Tab value="charts" leftSection={<BarChart3 size={14} />}>
              Charts
            </Tabs.Tab>
          </Tabs.List>

          {/* Markdown */}
          <Tabs.Panel value="markdown" pt="lg">
            <Box className="agent-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </Box>
          </Tabs.Panel>

          {/* Text */}
          <Tabs.Panel value="text" pt="lg">
            <Box p="md" style={{ border: "1px solid #e6e4de", borderRadius: 10, background: "#faf9f6" }}>
              <Text ff="monospace" size="xs" c="#3a3733" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                {txt}
              </Text>
            </Box>
          </Tabs.Panel>

          {/* Charts */}
          <Tabs.Panel value="charts" pt="lg">
            <Box p="lg" style={{ border: "1px solid #e6e4de", borderRadius: 10 }}>
              <Text fw={600} size="sm" mb="md">
                Effect size by subgroup (g)
              </Text>
              {CHART_BARS.map((b) => (
                <Group key={b.label} gap="md" wrap="nowrap" mb="sm">
                  <Text size="xs" c="dimmed" style={{ width: 130, flexShrink: 0 }} truncate>
                    {b.label}
                  </Text>
                  <Box style={{ flex: 1, background: "#f2f1ec", borderRadius: 6, height: 18, position: "relative", overflow: "hidden" }}>
                    <Box style={{ width: `${(b.value / maxV) * 100}%`, height: "100%", background: "#2b5fd1", borderRadius: 6 }} />
                  </Box>
                  <Text ff="monospace" size="xs" style={{ width: 64, flexShrink: 0 }} ta="right">
                    {b.value.toFixed(2)} · k={b.k}
                  </Text>
                </Group>
              ))}
            </Box>
          </Tabs.Panel>
        </Tabs>
      </Box>
    </Box>
  );
}
