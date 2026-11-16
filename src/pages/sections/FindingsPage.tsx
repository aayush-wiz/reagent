import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionIcon, Badge, Box, Group, Loader, Table, Text, Tooltip } from "@mantine/core";
import { CircleCheck, AlertTriangle, RefreshCw, FlaskConical } from "lucide-react";
import { api, type GlobalFinding } from "../../lib/api";
import Sidebar from "../../components/workspace/Sidebar";
import ColumnFilter, { useColumnFilters } from "../../components/workspace/ColumnFilter";
import type { HomeChrome } from "./shared";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

function relTime(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

export default function FindingsPage({ chrome }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [findings, setFindings] = useState<GlobalFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const cf = useColumnFilters();

  const typeLabel = (f: GlobalFinding) => (f.kind === "warn" ? "review" : "verified");

  const refresh = () => {
    setLoading(true);
    api
      .listFindings()
      .then((d) => setFindings(d.findings))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const q = query.trim().toLowerCase();
  const researchValues = useMemo(
    () => Array.from(new Set(findings.map((f) => f.researchTitle ?? "").filter(Boolean))).sort(),
    [findings],
  );
  const typeValues = ["verified", "review"];
  const rows = useMemo(
    () =>
      findings.filter((f) => {
        if (q && !`${f.text} ${f.researchTitle ?? ""}`.toLowerCase().includes(q)) return false;
        if (!cf.pass("research", f.researchTitle ?? "")) return false;
        if (!cf.pass("type", typeLabel(f))) return false;
        return true;
      }),
    [findings, q, cf],
  );

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#ffffff" }}>
      <Sidebar
        nav={chrome.nav}
        query={query}
        onQuery={setQuery}
        openTask={chrome.openTask}
        menuOpen={chrome.menuOpen}
        toggleMenu={chrome.toggleMenu}
        menuItems={chrome.menuItems}
      />

      <section style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#ffffff", display: "flex", flexDirection: "column" }}>
        <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #f0efea" }}>
          <Group gap={8}>
            <CircleCheck size={16} color="#847f76" />
            <Box>
              <Text fw={600} size="md">{chrome.homeTitle}</Text>
              <Text size="xs" c="dimmed">{rows.length} findings across all researches, cited to source</Text>
            </Box>
          </Group>
          <Tooltip label="Refresh">
            <ActionIcon variant="default" onClick={refresh} aria-label="refresh">
              <RefreshCw size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {loading ? (
          <Group justify="center" py={60}>
            <Loader color="terracotta" />
          </Group>
        ) : rows.length === 0 ? (
          <Box style={{ textAlign: "center", padding: "60px 20px" }}>
            <CircleCheck size={24} color="#c4bfb2" />
            <Text size="sm" c="dimmed" mt={8}>
              {findings.length === 0 ? "No findings recorded yet. The agent adds findings as it works." : `No findings match “${query}”.`}
            </Text>
          </Box>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table className="crm-table" verticalSpacing={8} horizontalSpacing="md" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ paddingLeft: 20 }}>Finding</Table.Th>
                  <Table.Th w={230}>
                    <Group gap={5} wrap="nowrap">
                      Research
                      <ColumnFilter
                        label="Research"
                        columnKey="research"
                        values={researchValues}
                        selected={cf.sel.research}
                        active={cf.active("research")}
                        onToggle={(v) => cf.toggle("research", v)}
                        onSelectAll={(vs) => cf.selectAll("research", vs)}
                        onClear={() => cf.clear("research")}
                      />
                    </Group>
                  </Table.Th>
                  <Table.Th w={110}>
                    <Group gap={5} wrap="nowrap">
                      Type
                      <ColumnFilter
                        label="Type"
                        columnKey="type"
                        values={typeValues}
                        selected={cf.sel.type}
                        active={cf.active("type")}
                        onToggle={(v) => cf.toggle("type", v)}
                        onSelectAll={(vs) => cf.selectAll("type", vs)}
                        onClear={() => cf.clear("type")}
                      />
                    </Group>
                  </Table.Th>
                  <Table.Th w={100} ta="right">When</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((f) => (
                  <Table.Tr key={f.id}>
                    <Table.Td style={{ paddingLeft: 20, maxWidth: 520 }}>
                      <Group gap={8} wrap="nowrap" align="flex-start">
                        {f.kind === "warn" ? (
                          <AlertTriangle size={14} color="#b07419" style={{ marginTop: 3, flexShrink: 0 }} />
                        ) : (
                          <CircleCheck size={14} color="#3a7d44" style={{ marginTop: 3, flexShrink: 0 }} />
                        )}
                        <Text size="sm">{f.text}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {f.researchTitle ? (
                        <Badge
                          variant="light"
                          color="gray"
                          size="sm"
                          tt="none"
                          radius="sm"
                          leftSection={<FlaskConical size={11} />}
                          style={{ cursor: "pointer", maxWidth: 210 }}
                          onClick={() => f.researchId && navigate(`/researches/${encodeURIComponent(f.researchId)}`)}
                        >
                          {f.researchTitle}
                        </Badge>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={f.kind === "warn" ? "orange" : "green"} size="sm" radius="sm" tt="none" fw={500}>
                        {f.kind === "warn" ? "review" : "verified"}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="xs" c="dimmed">{relTime(f.createdAt)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </section>
    </div>
  );
}
