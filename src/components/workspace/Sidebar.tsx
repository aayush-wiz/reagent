import { ActionIcon, Avatar, Box, Group, Text } from "@mantine/core";
import type { ReactNode } from "react";
import {
  Plus,
  MessageSquare,
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
  BookText,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MenuItemVal, NavVal } from "./types";
import RecentPanel from "./RecentPanel";
import { useAuth } from "../../lib/AuthProvider";

// Proper icon per left-nav section (keyed by label). Shared by every section page.
export const NAV_ICON: Record<string, ReactNode> = {
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

interface Props {
  nav: NavVal[];
  query?: string;
  onQuery?: (v: string) => void;
  openTask: () => void;
  menuOpen: boolean;
  toggleMenu: () => void;
  menuItems: MenuItemVal[];
}

/** The Twenty-style left navigation rail, shared across section pages. */
export default function Sidebar({ nav, openTask }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Our documentation site (external) — opened in a new tab from the Docs link.
  const DOCS_URL = "http://localhost:4337/";
  const signOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };
  return (
    <nav style={{ width: 216, flex: "0 0 216px", display: "flex", flexDirection: "column", background: "#ffffff", borderRight: "1px solid #ebe9e4", padding: "10px 8px" }}>
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

      {/* Docs — opens our documentation site in a new tab (external link) */}
      <a
        className="crm-nav-item"
        href={DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{ marginTop: 4, textDecoration: "none" }}
      >
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, color: "#847f76" }}>
          <BookText size={15} />
        </span>
        <span style={{ flex: 1, textAlign: "left" }}>Docs</span>
        <ArrowUpRight size={14} color="#a29e97" />
      </a>

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
  );
}
