import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Group, Menu, Text } from "@mantine/core";
import { Search, MoreHorizontal, SquarePen, Check, X, FlaskConical, List } from "lucide-react";
import { api } from "../../lib/api";

type RecentChat = { id: string; title: string; updatedAt: number; researchId: string; researchTitle: string | null; running?: boolean };
type GroupBy = "none" | "research";

/**
 * The always-present "Recent" chat list in the left rail (shared by every
 * section via <Sidebar>). Self-contained: fetches recent chat sessions, and
 * offers search, group-by, and a new-chat pencil — like a sessions panel.
 */
export default function RecentPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<RecentChat[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  // Active chat (when on /chat/:id) — highlight it.
  const activeId = location.pathname.startsWith("/chat/") ? decodeURIComponent(location.pathname.split("/")[2] ?? "") : undefined;

  useEffect(() => {
    let alive = true;
    const load = () => api.chatRecent().then(({ sessions }) => alive && setItems(sessions)).catch(() => {});
    load();
    // Poll so a chat that starts/finishes running updates its shimmer live.
    const poll = setInterval(load, 3500);
    return () => {
      alive = false;
      clearInterval(poll);
    };
    // refetch when the route changes (a new chat may have been created)
  }, [location.pathname]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) => (r.title || "").toLowerCase().includes(q) || (r.researchTitle || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const groups = useMemo(() => {
    if (groupBy !== "research") return null;
    const map = new Map<string, RecentChat[]>();
    for (const r of filtered) {
      const key = r.researchTitle || "Untitled research";
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    return [...map.entries()];
  }, [filtered, groupBy]);

  const row = (r: RecentChat) => (
    <button
      key={r.id}
      className="crm-nav-item"
      data-active={r.id === activeId}
      onClick={() => navigate(`/chat/${encodeURIComponent(r.id)}`)}
      style={{ flexDirection: "column", alignItems: "flex-start", gap: 1, padding: "6px 9px" }}
    >
      <span className={r.running ? "recent-shimmer" : undefined} style={{ fontSize: 13, color: "#3a3733", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
        {r.title || "New chat"}
      </span>
      {groupBy !== "research" && (
        <span style={{ fontSize: 11, color: "#a29e97", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
          {r.researchTitle ?? "Research"}
        </span>
      )}
    </button>
  );

  return (
    <Box style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 12 }}>
      {/* header row: label + controls */}
      <Group justify="space-between" px={9} mb={4} wrap="nowrap">
        <Text size="10px" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: "0.06em" }}>
          Recent
        </Text>
        <Group gap={2} wrap="nowrap">
          <button
            className="crm-recent-icon"
            data-active={searchOpen}
            title="Search sessions"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search size={13} />
          </button>

          <Menu position="bottom-end" width={210} shadow="md">
            <Menu.Target>
              <button className="crm-recent-icon" title="Group & filter">
                <MoreHorizontal size={13} />
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Group by</Menu.Label>
              <Menu.Item
                leftSection={<List size={14} />}
                rightSection={groupBy === "none" ? <Check size={13} /> : null}
                onClick={() => setGroupBy("none")}
              >
                None
              </Menu.Item>
              <Menu.Item
                leftSection={<FlaskConical size={14} />}
                rightSection={groupBy === "research" ? <Check size={13} /> : null}
                onClick={() => setGroupBy("research")}
              >
                Research
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<List size={14} />} onClick={() => navigate("/researches")}>
                View all researches
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <button className="crm-recent-icon" title="New chat" onClick={() => navigate("/chat")}>
            <SquarePen size={13} />
          </button>
        </Group>
      </Group>

      {/* search input (toggled) */}
      {searchOpen && (
        <Box px={7} mb={4}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "#efede8", borderRadius: 8 }}>
            <Search size={12} color="#a29e97" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search sessions…"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12.5, fontFamily: "inherit", color: "#1c1b19", minWidth: 0 }}
            />
            <button
              onClick={() => { setQuery(""); setSearchOpen(false); }}
              style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: "#a29e97", padding: 0 }}
              title="Clear"
            >
              <X size={12} />
            </button>
          </div>
        </Box>
      )}

      {/* list */}
      <Box style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {filtered.length === 0 && <Text size="xs" c="dimmed" px={9} py={4}>No chats yet</Text>}
        {groups
          ? groups.map(([research, rows]) => (
              <Box key={research} mb={2}>
                <Text size="10px" c="dimmed" fw={600} px={9} pt={6} pb={2} truncate style={{ display: "block" }}>
                  {research}
                </Text>
                {rows.map(row)}
              </Box>
            ))
          : filtered.map(row)}
      </Box>
    </Box>
  );
}
