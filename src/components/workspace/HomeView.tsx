import { useMemo, useState } from "react";
import { ActionIcon, Avatar, Badge, Box, Button, Checkbox, Group, Menu, ScrollArea, Table, Text, TextInput } from "@mantine/core";
// Checkbox is still used inside the per-column filter dropdowns below.
import type { ReactNode } from "react";
import {
  ArrowDownAZ,
  LogOut,
  ChevronUp,
  ChevronDown,
  Clock,
  CircleDot,
  AlignLeft,
  Filter,
  Plus,
  Search,
  Settings2,
  Tag,
  LayoutList,
  FlaskConical,
  Sparkles,
  Database,
  NotebookText,
  CircleCheck,
  BookOpen,
  Layers,
  Wrench,
  Blocks,
  ListChecks,
  FileBarChart,
  MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseStyleString } from "../../lib/parseStyleString";
import RecentPanel from "./RecentPanel";
import { useAuth } from "../../lib/AuthProvider";
import type { MenuItemVal, NavVal, ResearchCardVal } from "./types";

interface Props {
  nav: NavVal[];
  homeTitle: string;
  homeSub: string;
  researches: ResearchCardVal[];
  openTask: () => void;
  newAction: () => void;
  newLabel?: string;
  menuOpen: boolean;
  toggleMenu: () => void;
  menuItems: MenuItemVal[];
}

type SortKey = "title" | "meta" | "status" | "updated";

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (["running", "shared", "indexed"].includes(s)) return "blue";
  if (["synced", "clean", "verified", "connected", "active"].includes(s)) return "green";
  if (["flagged", "review", "paused"].includes(s)) return "orange";
  return "gray";
}

function swatchColor(iconStyle: string): string {
  const parsed = parseStyleString(iconStyle) as { color?: string };
  return parsed.color || "#c2562e";
}

// Proper icon per left-nav section (keyed by label).
const NAV_ICON: Record<string, ReactNode> = {
  Chat: <MessageSquare size={15} />,
  Researches: <FlaskConical size={15} />,
  Tasks: <ListChecks size={15} />,
  "Reports & Results": <FileBarChart size={15} />,
  Agents: <Sparkles size={15} />,
  Skills: <Blocks size={15} />,
  Data: <Database size={15} />,
  Notebooks: <NotebookText size={15} />,
  Findings: <CircleCheck size={15} />,
  Papers: <BookOpen size={15} />,
  Collections: <Layers size={15} />,
  "Tools & MCP": <Wrench size={15} />,
};

const COLUMNS: { key: SortKey; label: string; icon: React.ReactNode; align?: "right" }[] = [
  { key: "title", label: "Name", icon: <Tag size={13} /> },
  { key: "meta", label: "Details", icon: <AlignLeft size={13} /> },
  { key: "updated", label: "Updated", icon: <Clock size={13} />, align: "right" },
];

export default function HomeView({ nav, homeTitle, homeSub, researches, openTask, newAction, newLabel = "New record" }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [asc, setAsc] = useState(true);
  // Per-column filters (Excel-style): a set of allowed values + a contains-text per column.
  const [colSel, setColSel] = useState<Partial<Record<SortKey, Set<string>>>>({});
  const [colText, setColText] = useState<Partial<Record<SortKey, string>>>({});

  const distinct = useMemo(() => {
    const m = {} as Record<SortKey, string[]>;
    (["title", "meta", "status", "updated"] as SortKey[]).forEach((k) => {
      m[k] = Array.from(new Set(researches.map((r) => String(r[k] ?? "")).filter(Boolean))).sort();
    });
    return m;
  }, [researches]);

  const toggleSel = (key: SortKey, value: string) =>
    setColSel((prev) => {
      const next = new Set(prev[key] ?? []);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...prev, [key]: next };
    });
  const clearCol = (key: SortKey) => {
    setColSel((p) => ({ ...p, [key]: new Set() }));
    setColText((p) => ({ ...p, [key]: "" }));
  };
  const selectAll = (key: SortKey, values: string[]) =>
    setColSel((p) => {
      const next = new Set(p[key] ?? []);
      values.forEach((v) => next.add(v));
      return { ...p, [key]: next };
    });
  const colActive = (key: SortKey) => (colSel[key]?.size ?? 0) > 0;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = researches.filter((r) => {
      if (q && !`${r.title} ${r.meta} ${r.status}`.toLowerCase().includes(q)) return false;
      for (const k of ["title", "meta", "status", "updated"] as SortKey[]) {
        const sel = colSel[k];
        if (sel && sel.size && !sel.has(String(r[k] ?? ""))) return false;
      }
      return true;
    });
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
        return asc ? cmp : -cmp;
      });
    }
    return list;
  }, [researches, query, sortKey, asc, colSel, colText]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(true);
    }
  };

  const sortByName = () => {
    setSortKey("title");
    setAsc(true);
  };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#ffffff" }}>
      {/* ============ SIDEBAR (Twenty style) ============ */}
      <nav style={{ width: 216, flex: "0 0 216px", display: "flex", flexDirection: "column", background: "#ffffff", borderRight: "1px solid #ebe9e4", padding: "10px 8px" }}>
        {/* workspace switcher */}
        {/* Brand — matches the landing page: sage conical-flask mark + lowercase wordmark */}
        <Group px={6} py={4} mb={6}>
          <Group gap={7} wrap="nowrap" align="center">
            <FlaskConical size={20} color="#1c1b19" strokeWidth={1.8} style={{ display: "block" }} />
            <span style={{ fontFamily: "'Geist Pixel', system-ui, sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em", color: "#1c1b19", lineHeight: 1 }}>reagent</span>
          </Group>
        </Group>

        <button className="crm-nav-item crm-new-task" onClick={openTask} style={{ marginTop: 4 }}>
          <Plus size={15} color="#faf9f6" />
          <span style={{ flex: 1, textAlign: "left" }}>New task</span>
        </button>

        <Text size="10px" c="dimmed" fw={600} tt="uppercase" px={9} mt={12} mb={4} style={{ letterSpacing: "0.06em" }}>
          Workspaces
        </Text>

        {nav.map((n) => {
          const active = n.style.includes("#f2f4f9") || n.style.includes("font-weight:600");
          return (
            <button key={n.label} className="crm-nav-item" data-active={active} onClick={n.select}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, color: "#847f76" }}>{NAV_ICON[n.label] ?? n.icon}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{n.label}</span>
            </button>
          );
        })}

        <RecentPanel />

        {/* ---- user row, bottom-left ---- */}
        <div className="crm-nav-item" style={{ padding: "7px 8px", cursor: "default" }}>
          <Avatar size={24} radius="xl" color="initials" name={user?.name || user?.email || "You"} />
          <Box style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <Text size="xs" fw={600} truncate>{user?.name || "Your account"}</Text>
            <Text size="10px" c="dimmed" truncate>{user?.email || ""}</Text>
          </Box>
          <ActionIcon variant="subtle" color="red" onClick={signOut} title="Log out" aria-label="Log out">
            <LogOut size={15} />
          </ActionIcon>
        </div>
      </nav>

      {/* ============ CONTENT ============ */}
      <section style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#ffffff", display: "flex", flexDirection: "column" }}>
        {/* header */}
        <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: "1px solid #f0efea" }}>
          <Group gap={8}>
            <LayoutList size={16} color="#847f76" />
            <Text fw={600} size="md">{homeTitle}</Text>
          </Group>
          <Button size="compact-sm" variant="default" leftSection={<Plus size={14} />} onClick={newAction}>
            {newLabel}
          </Button>
        </Group>

        {/* sub-toolbar */}
        <Group px="lg" py={8} justify="space-between" style={{ borderBottom: "1px solid #f4f3ef" }}>
          <Group gap={7}>
            <LayoutList size={14} color="#a29e97" />
            <Text size="xs" c="#57534d" fw={500}>
              All {homeTitle} · {rows.length}
            </Text>
          </Group>
          <Group gap={4}>
            <Button size="compact-xs" variant="subtle" color="gray">All</Button>
            <Button size="compact-xs" variant="subtle" color="gray" leftSection={<ArrowDownAZ size={13} />} onClick={sortByName}>
              Name A-Z
            </Button>
            <Menu shadow="md" width={170} position="bottom-end">
              <Menu.Target>
                <Button size="compact-xs" variant="subtle" color="gray" leftSection={<Settings2 size={13} />}>
                  Options
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => { setSortKey(null); setQuery(""); }}>Reset view</Menu.Item>
                <Menu.Item onClick={() => toggleSort("updated")}>Sort by updated</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* table */}
        <Box style={{ flex: 1 }}>
          <Table.ScrollContainer minWidth={720}>
            <Table className="crm-table" verticalSpacing={0} horizontalSpacing="md" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  {COLUMNS.map((c) => (
                    <Table.Th key={c.key} ta={c.align}>
                      <Group gap={4} wrap="nowrap" justify={c.align === "right" ? "flex-end" : "flex-start"}>
                        <Group gap={5} wrap="nowrap" style={{ cursor: "pointer" }} onClick={() => toggleSort(c.key)}>
                          {c.icon}
                          {c.label}
                          {sortKey === c.key ? asc ? <ChevronUp size={11} /> : <ChevronDown size={11} /> : null}
                        </Group>
                        <Menu shadow="md" width={240} position="bottom-start" closeOnItemClick={false} withinPortal>
                          <Menu.Target>
                            <ActionIcon
                              variant={colActive(c.key) ? "light" : "subtle"}
                              color={colActive(c.key) ? "terracotta" : "gray"}
                              size="xs"
                              aria-label={`Filter ${c.label}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Filter size={11} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const q = (colText[c.key] ?? "").toLowerCase();
                              const values = q ? distinct[c.key].filter((v) => v.toLowerCase().includes(q)) : distinct[c.key];
                              const selCount = colSel[c.key]?.size ?? 0;
                              return (
                                <>
                                  <TextInput
                                    size="xs"
                                    placeholder={`Search ${c.label}…`}
                                    leftSection={<Search size={12} />}
                                    value={colText[c.key] ?? ""}
                                    onChange={(e) => setColText((p) => ({ ...p, [c.key]: e.currentTarget.value }))}
                                    mb={6}
                                  />
                                  <Group justify="space-between" mb={4}>
                                    <Button size="compact-xs" variant="subtle" color="terracotta" onClick={() => selectAll(c.key, values)}>
                                      Select {q ? "matching" : "all"}
                                    </Button>
                                    <Button size="compact-xs" variant="subtle" color="gray" disabled={!selCount} onClick={() => clearCol(c.key)}>
                                      Clear
                                    </Button>
                                  </Group>
                                  <ScrollArea.Autosize mah={240} type="auto">
                                    {values.map((v) => (
                                      <Checkbox
                                        key={v}
                                        size="xs"
                                        color="terracotta"
                                        label={v}
                                        checked={colSel[c.key]?.has(v) ?? false}
                                        onChange={() => toggleSel(c.key, v)}
                                        py={3}
                                        styles={{ label: { fontSize: 12, lineHeight: 1.3 }, labelWrapper: { maxWidth: 190 } }}
                                      />
                                    ))}
                                    {!values.length && (
                                      <Text size="xs" c="dimmed" py="xs" ta="center">
                                        No matches
                                      </Text>
                                    )}
                                  </ScrollArea.Autosize>
                                  <Text size="10px" c="dimmed" mt={6}>
                                    {selCount} of {distinct[c.key].length} selected
                                  </Text>
                                </>
                              );
                            })()}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.title} onClick={r.open} style={{ cursor: "pointer" }}>
                    <Table.Td style={{ maxWidth: 300, paddingLeft: 20 }}>
                      <Group gap={9} wrap="nowrap">
                        <Avatar size={22} radius="xl" color="initials" name={r.title} styles={{ root: { border: `1.5px solid ${swatchColor(r.iconStyle)}22`, flexShrink: 0 } }} />
                        <Text size="sm" fw={600} truncate maw={240}>
                          {r.title}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ maxWidth: 460 }}>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {r.meta}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="xs" c="dimmed">
                        {r.updated}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {rows.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={COLUMNS.length}>
                      <Text ta="center" c="dimmed" size="sm" py="xl">
                        No results for “{query}”.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Box>
      </section>
    </div>
  );
}
