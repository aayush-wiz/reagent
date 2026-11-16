import { useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box, Code, NavLink, Text } from "@mantine/core";
import { FileCode, FileJson, FileText, Image as ImageIcon, Table2 } from "lucide-react";
import BrowserShell from "./BrowserShell";

type FileKind = "md" | "py" | "json" | "csv" | "svg";

interface FileEntry {
  name: string;
  kind: FileKind;
  size: string;
  content: string;
}

const FILES: FileEntry[] = [
  {
    name: "README.md",
    kind: "md",
    size: "2.1 KB",
    content: `# Retrieval-Augmented Meta-Analysis

Random-effects meta-analysis of standardized effect sizes reported for retrieval-augmented
methods, pooled across **42 studies** spanning ML, genomics, physics, and climate.

## Contents

- \`analysis.py\` — DerSimonian–Laird pooling + Egger's test for publication bias
- \`extract_effects.ipynb\` — PDF → effect-size extraction
- \`forest_plot.py\` — forest plot figure generation
- \`corpus/effects.parquet\` — extracted effect sizes and variances

## Headline result

Pooled standardized effect **g = 0.41** (95% CI 0.32–0.51), moderate heterogeneity (I² = 38%).
Egger's test suggests possible publication bias (p = 0.03) — recommend trim-and-fill as a
follow-up.

| Subgroup | k | g | 95% CI |
| --- | --- | --- | --- |
| ML benchmarks | 14 | 0.49 | 0.40–0.58 |
| Genomics | 11 | 0.44 | 0.31–0.57 |
| Physics/materials | 9 | 0.35 | 0.22–0.48 |
| Climate | 8 | 0.29 | 0.14–0.44 |

## Reproducing

\`\`\`bash
python analysis.py
\`\`\`

Cites every pooled number back to its source paper — see the *Findings* tab for the
extracted, cited claims.
`,
  },
  {
    name: "analysis.py",
    kind: "py",
    size: "1.4 KB",
    content: `import pandas as pd
import numpy as np
from scipy import stats

# Effect sizes extracted from 42 selected papers
df = pd.read_parquet("corpus/effects.parquet")
df = df[df.selected == True]

# Random-effects meta-analysis (DerSimonian-Laird)
w = 1 / (df.var + tau2(df))
pooled = np.average(df.effect, weights=w)
ci = confint(pooled, w)

print(f"Pooled effect g = {pooled:.3f}")
print(f"95% CI [{ci[0]:.3f}, {ci[1]:.3f}]")
plot_forest(df, pooled, ci)
`,
  },
  {
    name: "egger_test.json",
    kind: "json",
    size: "612 B",
    content: `{
  "test": "egger",
  "intercept": 1.84,
  "se": 0.79,
  "p_value": 0.03,
  "interpretation": "possible small-study effects",
  "recommendation": "trim-and-fill"
}
`,
  },
  {
    name: "effects.parquet",
    kind: "csv",
    size: "9.8 KB",
    content: `study,domain,g,var
Kaplan 2024,ML,0.56,0.012
Okoro 2023,Bio,0.42,0.018
Petrov 2024,Physics,0.35,0.021
Silva 2025,Climate,0.29,0.026
Fischer 2024,ML,0.50,0.015
Chen 2023,ML,0.34,0.019
`,
  },
  {
    name: "forest.svg",
    kind: "svg",
    size: "18.4 KB",
    content: "forest.svg · generated figure (binary — open in Charts tab)",
  },
];

const KIND_ICON: Record<FileKind, ReactNode> = {
  md: <FileText size={15} />,
  py: <FileCode size={15} />,
  json: <FileJson size={15} />,
  csv: <Table2 size={15} />,
  svg: <ImageIcon size={15} />,
};

interface Props {
  fill?: boolean;
  files?: { name: string; kind: string; size: string; content: string }[];
}

export default function FileBrowser({ fill, files }: Props) {
  const LIST: FileEntry[] =
    files && files.length
      ? files.map((f) => ({ name: f.name, kind: (["md", "py", "json", "csv", "svg"].includes(f.kind) ? f.kind : "md") as FileKind, size: f.size, content: f.content }))
      : FILES;
  const [openName, setOpenName] = useState<string | null>(null);
  const file = openName ? LIST.find((f) => f.name === openName) : undefined;

  // ---- a file is open: replace the list entirely with its content + a back button ----
  if (file) {
    return (
      <BrowserShell title={file.name} onBack={() => setOpenName(null)} right={file.size} fill={fill} scroll>
        {file.kind === "md" ? (
          <Box className="agent-md" px="lg" py="md" bg="white">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content}</ReactMarkdown>
          </Box>
        ) : file.kind === "svg" ? (
          <Box
            p="md"
            style={{
              minHeight: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundImage: "repeating-linear-gradient(45deg,#f6f5f1 0 9px,#fbfaf8 9px 18px)",
            }}
          >
            <Text ff="monospace" size="xs" c="dimmed">
              {file.content}
            </Text>
          </Box>
        ) : (
          <Code block m="md">
            {file.content}
          </Code>
        )}
      </BrowserShell>
    );
  }

  // ---- no file open: show only the list ----
  return (
    <BrowserShell title="Files" fill={fill}>
      {LIST.map((f) => (
        <NavLink
          key={f.name}
          label={f.name}
          leftSection={KIND_ICON[f.kind]}
          rightSection={
            <Text size="xs" c="dimmed">
              {f.size}
            </Text>
          }
          onClick={() => setOpenName(f.name)}
        />
      ))}
    </BrowserShell>
  );
}
