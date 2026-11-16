import { useState } from "react";
import { Box, Group, NavLink, Text } from "@mantine/core";
import { LineChart, ScatterChart } from "lucide-react";
import BrowserShell from "./BrowserShell";
import type { ForestVal } from "./types";

const DEFAULT_CHARTS = [
  { name: "Forest plot · pooled effect", meta: "figure 1" },
  { name: "Funnel plot", meta: "generated figure" },
];

interface Props {
  forest: ForestVal[];
  charts?: { name: string; meta: string }[];
  fill?: boolean;
}

export default function ChartBrowser({ forest, charts, fill }: Props) {
  const CHARTS = charts && charts.length ? charts : DEFAULT_CHARTS;
  const [openName, setOpenName] = useState<string | null>(null);

  if (openName) {
    return (
      <BrowserShell
        title={openName}
        onBack={() => setOpenName(null)}
        right={CHARTS.find((c) => c.name === openName)?.meta}
        fill={fill}
        scroll
      >
        {/forest/i.test(openName) ? (
          <Box p="md">
            {forest.map((r) => (
              <Group key={r.label} gap="xs" wrap="nowrap" mb={9}>
                <Text size="xs" c="dimmed" truncate style={{ width: 88, flexShrink: 0 }}>
                  {r.label}
                </Text>
                <Box style={{ flex: 1, position: "relative", height: 16 }}>
                  <Box style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "#eceae4" }} />
                  <Box style={{ position: "absolute", top: "50%", left: "50%", width: 1, height: 16, transform: "translateY(-50%)", background: "#d8d5ce" }} />
                  <Box
                    style={{ position: "absolute", top: "50%", height: 2, transform: "translateY(-50%)", background: "#b9c6e8", left: `${r.center - r.width / 2}%`, width: `${r.width}%` }}
                  />
                  <Box
                    style={{ position: "absolute", top: "50%", width: 8, height: 8, borderRadius: "50%", transform: "translate(-50%,-50%)", background: "#2b5fd1", left: `${r.center}%` }}
                  />
                </Box>
                <Text ff="monospace" size="xs" ta="right" style={{ width: 52, flexShrink: 0 }}>
                  {r.value}
                </Text>
              </Group>
            ))}
            <Group gap="xs" wrap="nowrap" mt={11} pt={11} style={{ borderTop: "1px solid #edece7" }}>
              <Text size="xs" fw={600} c="#2b5fd1" style={{ width: 88, flexShrink: 0 }}>
                Pooled (RE)
              </Text>
              <Box style={{ flex: 1, position: "relative", height: 16 }}>
                <Box style={{ position: "absolute", top: "50%", left: "50%", width: 1, height: 16, transform: "translateY(-50%)", background: "#d8d5ce" }} />
                <Box style={{ position: "absolute", top: "50%", left: "56%", width: 11, height: 11, transform: "translate(-50%,-50%) rotate(45deg)", background: "#2b5fd1" }} />
              </Box>
              <Text ff="monospace" size="xs" fw={500} c="#2b5fd1" ta="right" style={{ width: 52, flexShrink: 0 }}>
                0.412
              </Text>
            </Group>
          </Box>
        ) : (
          <Box
            m="md"
            style={{
              minHeight: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              backgroundImage: "repeating-linear-gradient(45deg,#f6f5f1 0 9px,#fbfaf8 9px 18px)",
            }}
          >
            <Text ff="monospace" size="xs" c="dimmed">
              funnel.svg · generated figure
            </Text>
          </Box>
        )}
      </BrowserShell>
    );
  }

  return (
    <BrowserShell title="Charts" fill={fill}>
      {CHARTS.map((c) => (
        <NavLink
          key={c.name}
          label={c.name}
          leftSection={c.name.startsWith("Forest") ? <LineChart size={15} /> : <ScatterChart size={15} />}
          rightSection={
            <Text size="xs" c="dimmed">
              {c.meta}
            </Text>
          }
          onClick={() => setOpenName(c.name)}
        />
      ))}
    </BrowserShell>
  );
}
