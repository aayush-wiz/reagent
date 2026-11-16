import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PapersModal from "../components/workspace/PapersModal";
import TaskModal from "../components/workspace/TaskModal";
import { api } from "../lib/api";
import { NAV_SECTIONS, navItems, navMeta, type HomeChrome } from "./sections/shared";
import type { MenuItemVal, NavVal } from "../components/workspace/types";
import ResearchesPage from "./sections/ResearchesPage";
import ChatPage from "./sections/ChatPage";
import AgentsPage from "./sections/AgentsPage";
import SkillsPage from "./sections/SkillsPage";
import DataPage from "./sections/DataPage";
import NotebooksPage from "./sections/NotebooksPage";
import FindingsPage from "./sections/FindingsPage";
import PapersPage from "./sections/PapersPage";
import CollectionsPage from "./sections/CollectionsPage";
import ToolsPage from "./sections/ToolsPage";
import TasksPage from "./sections/TasksPage";
import ReportsPage from "./sections/ReportsPage";
import DocsPage from "./sections/DocsPage";
import ArticlesPage from "./sections/ArticlesPage";

export default function WorkspaceShell() {
  const location = useLocation();
  const navigate = useNavigate();

  // ---- global chrome state (sidebar user menu + assign-task + import-papers modals) ----
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState("");
  const [taskResearch, setTaskResearch] = useState<string | null>(null);
  const [researchList, setResearchList] = useState<{ id: string; title: string }[]>([]);
  const [papersModalOpen, setPapersModalOpen] = useState(false);

  // Real researches for the "New task" research dropdown.
  useEffect(() => {
    api.listResearches().then(({ researches }) => setResearchList(researches.map((r) => ({ id: r.id, title: r.title })))).catch(() => {});
  }, []);

  // The post-login app uses Google Sans Flex — flag <body> so the font (and Mantine's portalled
  // modals/tooltips, which mount on document.body, outside this subtree) switch to
  // Google Sans Flex. Landing, auth, and dashboard-preview screens (no WorkspaceShell) stay Geist Pixel.
  useEffect(() => {
    document.body.classList.add("app-active");
    return () => document.body.classList.remove("app-active");
  }, []);

  // ---- section/sub derived from the URL ----
  const segments = location.pathname.split("/").filter(Boolean);
  const section = NAV_SECTIONS.includes(segments[0]) ? segments[0] : "researches";
  const sub = segments[1] as string | undefined;

  // ---- sidebar nav ----
  const nav: NavVal[] = navItems.map((n) => {
    const on = section === n[0];
    return {
      label: n[1],
      icon: n[2],
      count: n[3],
      select: () => navigate(`/${n[0]}`),
      style: `display:flex; align-items:center; gap:9px; width:100%; padding:8px 10px; margin-bottom:2px; border:none; border-radius:8px; cursor:pointer; font-size:13px; background:${on ? "#f2f4f9" : "transparent"}; color:${on ? "#1c1b19" : "#57534d"}; font-weight:${on ? "600" : "400"};`,
    };
  });
  const [homeTitle, homeSub] = navMeta[section];

  const menuItems: MenuItemVal[] = ([
    ["◍", "Profile"],
    ["⚙", "Settings"],
    ["⇥", "Log out"],
  ] as [string, string][]).map((m, i) => ({
    icon: m[0],
    label: m[1],
    style: `display:flex; align-items:center; gap:9px; width:100%; padding:8px 11px; border:none; background:none; border-radius:8px; cursor:pointer; font-size:13px; text-align:left; color:${i === 2 ? "#b3402e" : "#3a3733"};`,
  }));

  const chrome: HomeChrome = {
    nav,
    homeTitle,
    homeSub,
    menuOpen,
    toggleMenu: () => setMenuOpen((v) => !v),
    closeMenu: () => setMenuOpen(false),
    menuItems,
    openTask: () => setTaskOpen(true),
  };

  // ---- TaskModal ----
  // Fire a fully-async run: it executes in the worker (keeps running even if you
  // leave), and you watch it in the Tasks tab.
  const runTask = async () => {
    const prompt = taskDraft.trim();
    if (!prompt) return;
    setTaskOpen(false);
    setTaskDraft("");
    const target = taskResearch;
    setTaskResearch(null);
    try {
      const { task } = await api.createTask({ prompt, researchId: target ?? undefined, kind: "task" });
      navigate(`/tasks/${encodeURIComponent(task.id)}`);
    } catch {
      navigate("/tasks");
    }
  };
  const closeTask = () => setTaskOpen(false);

  // ---- section switch: a distinct component type per section, keyed by
  // section, so navigating between sections UNMOUNTS the previous section's
  // page (killing any stale table/list left over from the old section). ----
  let content: JSX.Element;
  if (section === "chat") content = <ChatPage key="chat" sub={sub} chrome={chrome} />;
  else if (section === "docs") content = <DocsPage key="docs" sub={sub} chrome={chrome} />;
  else if (section === "tasks") content = <TasksPage key="tasks" sub={sub} chrome={chrome} />;
  else if (section === "reports") content = <ReportsPage key="reports" sub={sub} chrome={chrome} />;
  else if (section === "agents") content = <AgentsPage key="agents" sub={sub} chrome={chrome} />;
  else if (section === "skills") content = <SkillsPage key="skills" sub={sub} chrome={chrome} />;
  else if (section === "data") content = <DataPage key="data" sub={sub} chrome={chrome} />;
  else if (section === "notebooks") content = <NotebooksPage key="notebooks" sub={sub} chrome={chrome} />;
  else if (section === "findings") content = <FindingsPage key="findings" sub={sub} chrome={chrome} />;
  else if (section === "papers") content = <PapersPage key="papers" sub={sub} chrome={chrome} openPapersModal={() => setPapersModalOpen(true)} papersModalOpen={papersModalOpen} />;
  else if (section === "collections") content = <CollectionsPage key="collections" sub={sub} chrome={chrome} />;
  else if (section === "tools") content = <ToolsPage key="tools" sub={sub} chrome={chrome} />;
  else if (section === "my-articles") content = <ArticlesPage key="my-articles" sub={sub} chrome={chrome} />;
  else content = <ResearchesPage key="researches" sub={sub} chrome={chrome} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden", background: "#ffffff", color: "#1c1b19", fontFamily: "'Google Sans Flex', system-ui, sans-serif" }}>
      {content}

      <PapersModal opened={papersModalOpen} onClose={() => setPapersModalOpen(false)} researchId="r_meta_analysis" />

      <TaskModal
        opened={taskOpen}
        onClose={closeTask}
        value={taskDraft}
        onChange={setTaskDraft}
        researches={researchList}
        research={taskResearch}
        onResearch={setTaskResearch}
        onRun={runTask}
      />
    </div>
  );
}
