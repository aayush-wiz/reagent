import { useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import HomeView from "../../components/workspace/HomeView";
import AgentBuilder from "../../components/workspace/AgentBuilder";
import AgentDetailView from "../../components/workspace/AgentDetailView";
import { datasets, type HomeChrome } from "./shared";
import type { AutonomyVal, ModelVal, ResearchCardVal, ToggleItemVal } from "../../components/workspace/types";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

export default function AgentsPage({ sub, chrome }: Props) {
  const navigate = useNavigate();
  const [agentName, setAgentName] = useState("");
  const [agentInstr, setAgentInstr] = useState("");
  const [agentModel, setAgentModel] = useState("balanced");
  const [agentAutonomy, setAgentAutonomy] = useState("review");
  const [agentSources, setAgentSources] = useState<Record<string, boolean>>({ papers: true, effects: true });
  const [agentSkills, setAgentSkills] = useState<Record<string, boolean>>({ extract: true, metaanalysis: true });
  const [agentTools, setAgentTools] = useState<Record<string, boolean>>({ python: true, search: true });

  const isBuilder = sub === "new";
  const isAgentDetail = sub !== undefined && sub !== "new";
  const agentId = isAgentDetail ? decodeURIComponent(sub) : "";

  const openCard = (title: string) => navigate(`/agents/${encodeURIComponent(title)}`);
  const cards: ResearchCardVal[] = (datasets.agents || []).map((r) => ({
    title: r[0],
    meta: r[1],
    status: r[2],
    updated: r[5],
    icon: r[4],
    open: () => openCard(r[0]),
    iconStyle: `flex:0 0 auto; width:38px; height:38px; border-radius:9px; background:${r[3][1]}; color:${r[3][0]}; display:flex; align-items:center; justify-content:center; font-size:16px;`,
    statusStyle: `font-size:11px; padding:2px 9px; border-radius:12px; background:${r[3][1]}; color:${r[3][0]}; font-weight:500;`,
  }));

  const newAction = () => {
    setAgentName("");
    setAgentInstr("");
    navigate("/agents/new");
  };
  const backToAgents = () => navigate("/agents");

  const onAgentName = (e: ChangeEvent<HTMLInputElement>) => setAgentName(e.target.value);
  const onAgentInstr = (e: ChangeEvent<HTMLTextAreaElement>) => setAgentInstr(e.target.value);

  function toggleRecord(setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, key: string) {
    setter((prev) => {
      const n = { ...prev };
      if (n[key]) delete n[key];
      else n[key] = true;
      return n;
    });
  }

  function mkToggleGrid(
    items: [string, string, string, string][],
    current: Record<string, boolean>,
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  ): ToggleItemVal[] {
    return items.map((x) => {
      const on = !!current[x[0]];
      return {
        label: x[1],
        meta: x[2],
        icon: x[3],
        toggle: () => toggleRecord(setter, x[0]),
        style: `display:flex; align-items:center; gap:11px; padding:12px 14px; border-radius:11px; cursor:pointer; border:1px solid ${on ? "#2b5fd1" : "#e6e4de"}; background:${on ? "#eef2fc" : "#fff"};`,
        checkStyle: `flex:0 0 auto; width:18px; height:18px; border-radius:5px; border:1.5px solid ${on ? "#2b5fd1" : "#d2cfc8"}; background:${on ? "#2b5fd1" : "#fff"}; color:#fff; font-size:11px; display:flex; align-items:center; justify-content:center;`,
        check: on ? "✓" : "",
        iconStyle: `width:30px; height:30px; flex:0 0 auto; border-radius:8px; background:${on ? "#dde6fa" : "#f4f3ef"}; color:${on ? "#2b5fd1" : "#8a8680"}; display:flex; align-items:center; justify-content:center; font-size:14px;`,
      };
    });
  }

  const sources = mkToggleGrid(
    [
      ["papers", "Full paper library", "187 papers", "◫"],
      ["effects", "effects.parquet", "42 rows", "▦"],
      ["core", "Core effect-size methods", "collection · 18", "▤"],
      ["notebooks", "Notebooks", "12 files", "❯"],
      ["findings", "Existing findings", "58 items", "✓"],
      ["web", "Web search", "external", "⌕"],
    ],
    agentSources,
    setAgentSources
  );
  const skills = mkToggleGrid(
    [
      ["extract", "Extract effect sizes", "parse stats & tables from PDFs", "◆"],
      ["metaanalysis", "Run meta-analysis", "random/fixed-effects pooling", "◆"],
      ["bias", "Detect publication bias", "Egger, trim-and-fill", "◆"],
      ["cluster", "Cluster literature", "group papers by topic", "◆"],
      ["summarize", "Summarize findings", "cited plain-language summaries", "◆"],
      ["reproduce", "Reproduce analysis", "re-run reported results", "◆"],
    ],
    agentSkills,
    setAgentSkills
  );
  const tools = mkToggleGrid(
    [
      ["python", "Python sandbox", "run code & plots", "▷"],
      ["search", "Web search", "external literature", "⌕"],
      ["scholar", "Scholar API", "citations & metadata", "◫"],
      ["latex", "LaTeX render", "equations & reports", "∑"],
      ["db", "SQL / dataframes", "query datasets", "▦"],
      ["email", "Email digest", "send scheduled reports", "✉"],
    ],
    agentTools,
    setAgentTools
  );

  const modelDefs: Record<string, [string, string]> = {
    fast: ["Fast", "quick scans, cheap"],
    balanced: ["Balanced", "default for most tasks"],
    deep: ["Deep", "careful multi-step reasoning"],
  };
  const models: ModelVal[] = ["fast", "balanced", "deep"].map((m) => {
    const on = agentModel === m;
    const lab = modelDefs[m];
    return {
      name: lab[0],
      desc: lab[1],
      select: () => setAgentModel(m),
      style: `flex:1; padding:12px 13px; border-radius:11px; cursor:pointer; text-align:left; border:1px solid ${on ? "#2b5fd1" : "#e6e4de"}; background:${on ? "#eef2fc" : "#fff"};`,
      nameStyle: `font-size:13px; font-weight:600; color:${on ? "#2b5fd1" : "#1c1b19"};`,
    };
  });

  const autonomyLabels: Record<string, string> = { review: "Ask before acting", auto: "Run autonomously", scheduled: "Run on schedule" };
  const autonomy: AutonomyVal[] = ["review", "auto", "scheduled"].map((a) => {
    const on = agentAutonomy === a;
    return {
      label: autonomyLabels[a],
      select: () => setAgentAutonomy(a),
      style: `padding:7px 14px; border-radius:9px; cursor:pointer; font-size:12.5px; border:1px solid ${on ? "#2b5fd1" : "#e2e0da"}; background:${on ? "#2b5fd1" : "#f7f6f2"}; color:${on ? "#fff" : "#57534d"}; font-weight:${on ? "500" : "400"};`,
    };
  });

  const saveAgent = () => navigate("/agents");
  const agentRow = isAgentDetail ? (datasets.agents || []).find((r) => r[0] === agentId) : undefined;

  if (isBuilder) {
    return (
      <AgentBuilder
        agentName={agentName}
        onAgentName={onAgentName}
        agentInstr={agentInstr}
        onAgentInstr={onAgentInstr}
        sources={sources}
        skills={skills}
        tools={tools}
        models={models}
        autonomy={autonomy}
        backToAgents={backToAgents}
        saveAgent={saveAgent}
      />
    );
  }

  if (isAgentDetail) {
    return (
      <AgentDetailView
        title={agentId}
        meta={agentRow?.[1]}
        status={agentRow?.[2]}
        backToSection={backToAgents}
      />
    );
  }

  return (
    <HomeView
      nav={chrome.nav}
      homeTitle={chrome.homeTitle}
      homeSub={chrome.homeSub}
      researches={cards}
      openTask={chrome.openTask}
      newAction={newAction}
      menuOpen={chrome.menuOpen}
      toggleMenu={chrome.toggleMenu}
      menuItems={chrome.menuItems}
    />
  );
}
