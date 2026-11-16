import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, Group, Loader, Table, Text, Tooltip } from "@mantine/core";
import { BookOpen, Plus, FlaskConical, Globe } from "lucide-react";
import { api, type ApiPaper } from "../../lib/api";
import Sidebar from "../../components/workspace/Sidebar";
import PaperReader from "../../components/workspace/PaperReader";
import ColumnFilter, { useColumnFilters } from "../../components/workspace/ColumnFilter";
import type { HomeChrome } from "./shared";

interface Props {
  sub?: string;
  chrome: HomeChrome;
  openPapersModal: () => void;
  papersModalOpen: boolean;
}

export default function PapersPage({ sub, chrome, openPapersModal, papersModalOpen }: Props) {
  const navigate = useNavigate();
  const [allPapers, setAllPapers] = useState<ApiPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const cf = useColumnFilters();
  const scopeOf = (p: ApiPaper) => ((p.inResearches ?? 1) > 1 ? "Public (shared)" : "Single research");

  const isDetail = sub !== undefined;
  const itemId = isDetail ? decodeURIComponent(sub) : "";
  const backToSection = () => navigate("/papers");

  // Reloads when the import modal closes so freshly-imported papers show up.
  useEffect(() => {
    if (isDetail) return;
    let alive = true;
    setLoading(true);
    api
      .listPapers()
      .then(({ papers }) => alive && setAllPapers(papers))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [isDetail, papersModalOpen]);

  const q = query.trim().toLowerCase();
  const researchValues = useMemo(
    () => Array.from(new Set(allPapers.map((p) => p.researchTitle ?? "").filter(Boolean))).sort(),
    [allPapers],
  );
  const scopeValues = ["Single research", "Public (shared)"];
  const rows = useMemo(
    () =>
      allPapers.filter((p) => {
        if (q && !`${p.title} ${p.byline} ${p.venue} ${p.researchTitle ?? ""}`.toLowerCase().includes(q)) return false;
        if (!cf.pass("research", p.researchTitle ?? "")) return false;
        if (!cf.pass("scope", scopeOf(p))) return false;
        return true;
      }),
    [allPapers, q, cf],
  );

  if (isDetail) {
    return <PaperReader paperId={itemId} backToSection={backToSection} />;
  }

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
            <BookOpen size={16} color="#847f76" />
            <Box>
              <Text fw={600} size="md">{chrome.homeTitle}</Text>
              <Text size="xs" c="dimmed">{rows.length} papers in your library</Text>
            </Box>
          </Group>
          <Button size="compact-sm" variant="default" leftSection={<Plus size={14} />} onClick={openPapersModal}>
            Import papers
          </Button>
        </Group>

        {loading ? (
          <Group justify="center" py={60}>
            <Loader color="terracotta" />
          </Group>
        ) : rows.length === 0 ? (
          <Box style={{ textAlign: "center", padding: "60px 20px" }}>
            <BookOpen size={24} color="#c4bfb2" />
            <Text size="sm" c="dimmed" mt={8}>
              {allPapers.length === 0 ? "No papers yet. Import papers or let the agent add them." : `No papers match “${query}”.`}
            </Text>
          </Box>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table className="crm-table" verticalSpacing={8} horizontalSpacing="md" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ paddingLeft: 20 }}>Paper</Table.Th>
                  <Table.Th w={280}>
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
                      <ColumnFilter
                        label="Scope"
                        columnKey="scope"
                        values={scopeValues}
                        selected={cf.sel.scope}
                        active={cf.active("scope")}
                        onToggle={(v) => cf.toggle("scope", v)}
                        onSelectAll={(vs) => cf.selectAll("scope", vs)}
                        onClear={() => cf.clear("scope")}
                      />
                    </Group>
                  </Table.Th>
                  <Table.Th w={100} ta="right">Citations</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((p) => (
                  <Table.Tr key={p.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/papers/${encodeURIComponent(p.id)}`)}>
                    <Table.Td style={{ paddingLeft: 20, maxWidth: 460 }}>
                      <Text size="sm" fw={600} lineClamp={1}>{p.title}</Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {[p.byline, p.venue, p.year].filter(Boolean).join(" · ")}
                      </Text>
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Group gap={6} wrap="nowrap">
                        {p.researchTitle ? (
                          <Badge
                            variant="light"
                            color="gray"
                            size="sm"
                            tt="none"
                            radius="sm"
                            leftSection={<FlaskConical size={11} />}
                            style={{ cursor: "pointer", maxWidth: 190 }}
                            onClick={() => p.researchId && navigate(`/researches/${encodeURIComponent(p.researchId)}`)}
                          >
                            {p.researchTitle}
                          </Badge>
                        ) : (
                          <Text size="xs" c="dimmed">—</Text>
                        )}
                        {(p.inResearches ?? 1) > 1 && (
                          <Tooltip label={`Shared across ${p.inResearches} researches`}>
                            <Badge variant="light" color="blue" size="sm" tt="none" radius="sm" leftSection={<Globe size={11} />}>
                              Public
                            </Badge>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="xs" c="dimmed">✳ {p.citations}</Text>
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
