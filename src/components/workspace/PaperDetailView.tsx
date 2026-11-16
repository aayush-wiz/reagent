import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box, Button, Group, Tabs, Text, Title } from "@mantine/core";
import { ArrowLeft, FileText, Quote } from "lucide-react";

interface Props {
  title: string;
  meta?: string;
  backToSection: () => void;
}

export default function PaperDetailView({ title, meta, backToSection }: Props) {
  const [tab, setTab] = useState<string>("paper");
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16);

  const markdown = `# ${title}

${meta ? `**${meta}**\n` : ""}
## Abstract

We present a study of **${title.toLowerCase()}**. Across a curated corpus we extract reported
effect sizes and variances, pool them with a random-effects model, and test for small-study
effects. Our results indicate a moderate but robust pooled effect with evidence of possible
publication bias.

## 1. Introduction

Reliable synthesis across heterogeneous studies requires careful handling of variance and
between-study heterogeneity. Prior work has largely reported point estimates without
uncertainty, limiting reproducibility.

## 2. Method

We use the DerSimonian–Laird estimator for the between-study variance \\(\\tau^2\\):

\`\`\`python
w = 1 / (var + tau2)
pooled = np.average(effect, weights=w)
\`\`\`

| Step | Description |
| --- | --- |
| Extraction | Parse effect sizes + variances from PDFs |
| Pooling | Random-effects (DerSimonian–Laird) |
| Bias test | Egger's regression |

## 3. Results

Pooled standardized effect **g = 0.41** (95% CI 0.32–0.51), moderate heterogeneity
(I² = 38%). Egger's test suggests possible publication bias (p = 0.03).

> Effect strongest in the ML-benchmark subgroup; attenuated in field studies.

## 4. Conclusion

The synthesis is robust to leave-one-out perturbation. We recommend a trim-and-fill
follow-up to quantify the impact of small-study effects.
`;

  const bibtex = `@article{${slug}2024,
  title   = {${title}},
  author  = {${(meta ?? "Author, A.").split("·")[0].trim()}},
  journal = {Proceedings},
  year    = {2024}
}`;

  return (
    <Box style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#ffffff" }}>
      <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #e2e0da", position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
        <Button variant="subtle" color="gray" size="compact-sm" leftSection={<ArrowLeft size={15} />} onClick={backToSection}>
          Papers
        </Button>
        <Group gap="xs">
          <Button variant="default" size="compact-sm">Add to collection</Button>
          <Button color="dark" size="compact-sm">Cite</Button>
        </Group>
      </Group>

      <Box maw={860} mx="auto" px="lg" py="xl">
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
            <Tabs.Tab value="paper" leftSection={<FileText size={14} />}>
              Paper
            </Tabs.Tab>
            <Tabs.Tab value="bibtex" leftSection={<Quote size={14} />}>
              BibTeX
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="paper" pt="lg">
            <Box className="agent-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="bibtex" pt="lg">
            <Box p="md" style={{ border: "1px solid #e6e4de", borderRadius: 10, background: "#faf9f6" }}>
              <Text ff="monospace" size="xs" c="#3a3733" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                {bibtex}
              </Text>
            </Box>
          </Tabs.Panel>
        </Tabs>
      </Box>
    </Box>
  );
}
