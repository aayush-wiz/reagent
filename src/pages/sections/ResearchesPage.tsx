import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, type Workspace, type ApiMessage, type ApiResearch } from "../../lib/api";
import { useRuns } from "../../lib/RunProvider";
import { createPartsAccumulator } from "../../lib/partsReducer";
import type { ChatMsg } from "../../components/workspace/AgentMessage";
import { pendingAsk } from "../../components/workspace/QuestionCard";
import WorkspaceView from "../../components/workspace/WorkspaceView";
import HomeView from "../../components/workspace/HomeView";
import { Modal, TextInput, Textarea, Button, Group, Stack } from "@mantine/core";
import { datasets, statusMap, type HomeChrome } from "./shared";
import type { EnvVal, ForestVal, PaperVal, ResearchCardVal, TableRowVal, TagVal } from "../../components/workspace/types";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

export default function ResearchesPage({ sub, chrome }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  // ---- section-local UI state ----
  const [tab, setTab] = useState<"chat" | "code">("chat");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [resName, setResName] = useState("");
  const [resGoal, setResGoal] = useState("");
  const [resEnv, setResEnv] = useState("conda");

  // ---- workspace (API) state ----
  const [ws, setWs] = useState<Workspace | null>(null);
  const [wsLoading, setWsLoading] = useState(false);
  const [overlay, setOverlay] = useState<ChatMsg[]>([]);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatModel, setChatModel] = useState("GLM 5.2");
  const [outputsRefresh, setOutputsRefresh] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMsgs, setSessionMsgs] = useState<ApiMessage[] | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [usage, setUsage] = useState<{ tokens: number; limit: number; real?: boolean } | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  // The live run driving the chat (a queued/running task). Its stream lives in
  // the global RunProvider, so leaving and returning keeps it going.
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const answeredRef = useRef<Set<string>>(new Set());
  const { attach: attachRun, runs } = useRuns();
  // Real researches for the home list (from the DB, not the mock).
  const [homeResearches, setHomeResearches] = useState<ApiResearch[]>([]);

  const isNewResearch = sub === "new";
  const isWorkspace = sub !== undefined && !isNewResearch;

  // Load the real researches for the home list.
  useEffect(() => {
    if (isWorkspace || isNewResearch) return;
    let alive = true;
    api.listResearches().then(({ researches }) => alive && setHomeResearches(researches)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [isWorkspace, isNewResearch]);

  // A "New task" from the sidebar navigates here carrying the task text in
  // router state. Prefill the chat composer (existing research) or the goal
  // (new research) with it, then clear it so it doesn't re-apply on re-render.
  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt;
    if (!prompt) return;
    if (isNewResearch) setResGoal(prompt);
    else if (isWorkspace) setDraft(prompt);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, isNewResearch, isWorkspace]);

  // React to the live run finishing: persist-refresh on done; stop busy on end.
  useEffect(() => {
    if (!liveRunId) return;
    const st = runs[liveRunId]?.status;
    if (st === "done") {
      if (activeSessionId) api.sessionMessages(activeSessionId).then(({ messages }) => setSessionMsgs(messages)).catch(() => {});
      if (ws) {
        const rid = ws.research.id;
        api
          .getWorkspace(rid)
          .then((data) => setWs((prev) => (prev && prev.research.id === rid ? { ...prev, papers: data.papers, documents: data.documents, findings: data.findings, sessions: data.sessions } : prev)))
          .catch(() => {});
      }
      setOutputsRefresh((n) => n + 1);
      setOverlay([]);
      setLiveRunId(null);
      setAgentBusy(false);
      setChatStreaming(false);
    } else if (st === "failed" || st === "canceled") {
      setAgentBusy(false);
      setChatStreaming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, liveRunId, activeSessionId]);

  // Reattach to a still-running run when entering / returning to this session —
  // this is what makes a processing chat "still be there" when you come back.
  useEffect(() => {
    if (!activeSessionId || liveRunId) return;
    let alive = true;
    api
      .activeRun(activeSessionId)
      .then(({ run }) => {
        if (!alive || !run) return;
        setOverlay([{ role: "user", parts: [{ type: "text", text: run.prompt }] }]);
        setLiveRunId(run.id);
        attachRun(run.id);
        setAgentBusy(true);
        setChatStreaming(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // ---- load the workspace (papers / chat / outputs) from the API ----
  useEffect(() => {
    if (!isWorkspace || !sub) {
      setWs(null);
      return;
    }
    setOverlay([]);
    let alive = true;
    const wanted = decodeURIComponent(sub);
    setWsLoading(true);
    api
      .listResearches()
      .then(({ researches }) => {
        const match = researches.find((r) => r.title === wanted || r.id === wanted);
        return match ? api.getWorkspace(match.id) : null;
      })
      .then(async (data) => {
        if (!alive) return;
        // Pick the LAST-USED session SYNCHRONOUSLY, in the same tick as setWs, so
        // the workspace renders the right conversation immediately — no flicker
        // from a stale session to the resolved one.
        const lastUsed = data?.sessions?.length ? [...data.sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0].id : null;
        setWs(data);
        setActiveSessionId(lastUsed);
        // Load its thread explicitly (the [activeSessionId] effect won't fire on
        // navigate-back when the same session is reopened).
        if (lastUsed) {
          const { messages } = await api.sessionMessages(lastUsed).catch(() => ({ messages: [] }));
          if (alive) setSessionMsgs(messages);
        } else if (alive) {
          setSessionMsgs(null);
        }

        // Only if a DIFFERENT session has a live run, switch to it (rare; e.g.
        // you left a run going in an older session). This is the sole case that
        // may change the shown session after the initial paint.
        if (!data?.sessions?.length) return;
        const { run } = await api.activeRunForResearch(data.research.id).catch(() => ({ run: null }));
        if (alive && run?.sessionId && run.sessionId !== lastUsed && data.sessions.some((s) => s.id === run.sessionId)) {
          setActiveSessionId(run.sessionId);
          const { messages } = await api.sessionMessages(run.sessionId).catch(() => ({ messages: [] }));
          if (alive) setSessionMsgs(messages);
        }
      })
      .catch(() => {
        if (alive) setWs(null);
      })
      .finally(() => {
        if (alive) setWsLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkspace, sub]);

  // ---- load the active session's message thread ----
  useEffect(() => {
    // Clear immediately so switching sessions never flashes the previous
    // session's messages while the new one loads.
    setSessionMsgs(activeSessionId ? [] : null);
    if (!activeSessionId) return;
    let alive = true;
    api
      .sessionMessages(activeSessionId)
      .then(({ messages }) => alive && setSessionMsgs(messages))
      .catch(() => alive && setSessionMsgs([]));
    return () => {
      alive = false;
    };
  }, [activeSessionId]);

  // Opening a session counts as "using" it → bump its last-used time so
  // returning to the research reopens the session you last had open.
  useEffect(() => {
    if (activeSessionId) api.touchSession(activeSessionId).catch(() => {});
  }, [activeSessionId]);

  // Context usage — real token count vs the model's window, same logic as the Chat page.
  // Refetch when a run finishes (agentBusy → false) or the model changes.
  useEffect(() => {
    if (!activeSessionId) { setUsage(null); return; }
    let alive = true;
    api.sessionUsage(activeSessionId, chatModel).then((u) => alive && setUsage(u)).catch(() => {});
    return () => { alive = false; };
  }, [activeSessionId, agentBusy, chatModel]);

  function toggleTag(t: string) {
    setActiveTag((cur) => (cur === t ? null : t));
  }

  const tagList = ["ML", "Bio", "Physics", "Climate"];
  const tags: TagVal[] = tagList.map((t) => {
    const on = activeTag === t;
    return {
      label: t,
      toggle: () => toggleTag(t),
      style: `padding:4px 11px; font-size:11.5px; border-radius:14px; cursor:pointer; border:1px solid ${on ? "#2b5fd1" : "#e2e0da"}; background:${on ? "#2b5fd1" : "#f7f6f2"}; color:${on ? "#fff" : "#57534d"};`,
    };
  });

  const forestData: [string, number, number][] = [
    ["Kaplan 2024", 0.52, 0.6],
    ["Delgado 2023", 0.31, 0.52],
    ["Fischer 2024", 0.44, 0.56],
    ["Suzuki 2024", 0.61, 0.66],
    ["Chen 2023", 0.22, 0.46],
    ["Grewal 2023", 0.38, 0.55],
  ];
  const forest: ForestVal[] = forestData.map((d) => {
    const est = (d[1] + d[2]) / 2;
    const center = 50 + est * 55;
    const width = (d[2] - d[1]) * 55;
    return { label: d[0], value: est.toFixed(2), center, width };
  });

  const tableRows: TableRowVal[] = [
    { name: "ML benchmarks", k: "14", g: "0.49", ci: "0.40–0.58" },
    { name: "Genomics", k: "11", g: "0.44", ci: "0.31–0.57" },
    { name: "Physics/materials", k: "9", g: "0.35", ci: "0.22–0.48" },
    { name: "Climate", k: "8", g: "0.29", ci: "0.14–0.44" },
  ];

  const filterLabels: Record<string, string> = { all: "All", docs: "Docs", findings: "Findings", charts: "Charts", tables: "Tables", files: "Files" };
  const [filter, setFilter] = useState("all");
  const onFilterChange = (f: string) => setFilter(f);
  const F = filter;

  const tabStyle = (active: boolean) =>
    `display:flex; align-items:center; padding:0 15px; font-size:13px; cursor:pointer; background:none; border:none; border-bottom:2px solid ${active ? "#1c1b19" : "transparent"}; color:${active ? "#1c1b19" : "#8a8680"}; font-weight:${active ? "600" : "400"};`;

  // ---- home cards (real researches from the DB) ----
  const cards: ResearchCardVal[] = homeResearches.map((r) => ({
    title: r.title,
    meta: r.meta,
    status: r.status,
    updated: r.updatedLabel,
    icon: r.icon,
    open: () => navigate(`/researches/${encodeURIComponent(r.id)}`),
    iconStyle: `flex:0 0 auto; width:38px; height:38px; border-radius:9px; background:${r.color}1a; color:${r.color}; display:flex; align-items:center; justify-content:center; font-size:16px;`,
    statusStyle: `font-size:11px; padding:2px 9px; border-radius:12px; background:${r.color}1a; color:${r.color}; font-weight:500;`,
  }));

  const newAction = () => {
    setResName("");
    setResGoal("");
    setNewModalOpen(true);
  };

  // Visiting /researches/new directly (incl. a "New task" that carries a goal in router
  // state) pops the create modal, then drops to the list URL. Field prefill is handled by
  // the location.state effect above — do NOT reset the fields here or it clobbers the goal.
  useEffect(() => {
    if (isNewResearch) {
      setNewModalOpen(true);
      navigate("/researches", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewResearch]);

  const envs: EnvVal[] = (
    [
      ["conda", "Conda", "scientific Python · reproducible env", "🅒"],
      ["python", "Python venv", "lightweight pip environment", "🐍"],
      ["node", "Node.js", "JS/TS tooling & scrapers", "⬢"],
      ["r", "R", "stats & tidyverse", "®"],
      ["julia", "Julia", "high-perf numerical computing", "◍"],
      ["docker", "Custom Docker", "bring your own image", "🐳"],
    ] as [string, string, string, string][]
  ).map((x) => {
    const on = resEnv === x[0];
    return {
      id: x[0],
      label: x[1],
      meta: x[2],
      icon: x[3],
      select: () => setResEnv(x[0]),
      style: `display:flex; align-items:center; gap:12px; padding:13px 15px; border-radius:12px; cursor:pointer; border:1px solid ${on ? "#2b5fd1" : "#e6e4de"}; background:${on ? "#eef2fc" : "#fff"};`,
      iconStyle: `width:34px; height:34px; flex:0 0 auto; border-radius:9px; background:${on ? "#dde6fa" : "#f4f3ef"}; display:flex; align-items:center; justify-content:center; font-size:17px;`,
      radioStyle: `flex:0 0 auto; width:18px; height:18px; border-radius:50%; border:1.5px solid ${on ? "#2b5fd1" : "#d2cfc8"}; display:flex; align-items:center; justify-content:center;`,
      dotStyle: on ? "width:9px; height:9px; border-radius:50%; background:#2b5fd1;" : "display:none;",
    };
  });

  const backToResearches = () => navigate("/researches");
  const onResName = (e: ChangeEvent<HTMLInputElement>) => setResName(e.target.value);
  const onResGoal = (e: ChangeEvent<HTMLTextAreaElement>) => setResGoal(e.target.value);
  const createResearch = async () => {
    setNewModalOpen(false);
    const title = resName || "untitled-research";
    try {
      await api.createResearch(title, resGoal || undefined);
    } catch {
      /* if it already exists / fails, still navigate */
    }
    navigate(`/researches/${encodeURIComponent(title)}`);
  };

  // ============ workspace data from the API (papers / chat / outputs) ============
  function wsTogglePaper(paperId: string) {
    setWs((prev) => (prev ? { ...prev, papers: prev.papers.map((p) => (p.id === paperId ? { ...p, selected: !p.selected } : p)) } : prev));
    api.togglePaper(paperId).catch(() => {
      setWs((prev) => (prev ? { ...prev, papers: prev.papers.map((p) => (p.id === paperId ? { ...p, selected: !p.selected } : p)) } : prev));
    });
  }
  function refreshDocs() {
    if (!ws) return;
    const rid = ws.research.id;
    api.listDocuments(rid).then(({ documents }) => setWs((prev) => (prev && prev.research.id === rid ? { ...prev, documents } : prev))).catch(() => {});
    api.listSessions(rid).then(({ sessions }) => setWs((prev) => (prev && prev.research.id === rid ? { ...prev, sessions } : prev))).catch(() => {});
    setOutputsRefresh((n) => n + 1);
  }
  function reloadLibrary() {
    if (!ws) return;
    const rid = ws.research.id;
    api.getWorkspace(rid).then((data) => setWs((prev) => (prev && prev.research.id === rid ? { ...prev, papers: data.papers } : prev))).catch(() => {});
  }
  function onSelectSession(id: string) {
    if (id === activeSessionId) return;
    setOverlay([]);
    setActiveSessionId(id);
  }
  async function onNewSession() {
    if (!ws) return;
    try {
      const { session } = await api.createSession(ws.research.id);
      setWs((prev) => (prev ? { ...prev, sessions: [session, ...prev.sessions] } : prev));
      setOverlay([]);
      setSessionMsgs([]);
      setActiveSessionId(session.id);
    } catch {
      /* ignore */
    }
  }

  async function wsSend() {
    const d = draft.trim();
    if (!d || agentBusy) return;

    let cur = ws;
    if (!cur) {
      const title = decodeURIComponent(sub || "").trim();
      if (!title) return;
      try {
        const { researches } = await api.listResearches();
        let match = researches.find((r) => r.title === title || r.id === title);
        if (!match) match = (await api.createResearch(title)).research;
        cur = await api.getWorkspace(match.id);
        setWs(cur);
        setActiveSessionId(cur.sessions?.[0]?.id ?? null);
        setSessionMsgs(null);
      } catch {
        return;
      }
    }

    setDraft("");

    let sid = activeSessionId;
    if (!sid) {
      try {
        const { session } = await api.createSession(cur.research.id, d.slice(0, 60));
        setWs((prev) => (prev ? { ...prev, sessions: [session, ...prev.sessions] } : prev));
        setSessionMsgs([]);
        setActiveSessionId(session.id);
        sid = session.id;
      } catch {
        /* fall back to server auto-session */
      }
    }

    const prior = sessionMsgs ?? cur.messages;
    const history = [
      ...prior.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
      { role: "user", content: d },
    ];

    const selectedForTurn = (cur.papers ?? []).filter((p) => p.selected);
    const selectedPaperIds = selectedForTurn.map((p) => p.id);

    // Optimistically show the user's message; the AI side renders from the live run.
    const userMsg: ChatMsg = {
      role: "user",
      parts: [{ type: "text", text: d }],
      papers: selectedForTurn.map((p) => ({ title: p.title, year: p.year })),
    };
    setOverlay([userMsg]);
    setAgentBusy(true);
    setChatStreaming(true);
    try {
      // Enqueue a CHAT run — it executes in the worker, so it keeps going even
      // if you leave the chat; we attach to its live stream via RunProvider.
      const { task } = await api.createTask({
        prompt: d,
        kind: "chat",
        researchId: cur.research.id,
        sessionId: sid,
        messages: history,
        model: chatModel,
        selectedPaperIds,
      });
      setLiveRunId(task.id);
      attachRun(task.id);
    } catch {
      setOverlay([userMsg, { role: "ai", parts: [{ type: "text", text: "Agent unreachable — is the API running?" }] }]);
      setAgentBusy(false);
      setChatStreaming(false);
    }
  }

  const wsQ = search.trim().toLowerCase();
  const wsFiltered = (ws?.papers ?? []).filter(
    (p) => (!activeTag || p.tag === activeTag) && (!wsQ || p.title.toLowerCase().includes(wsQ) || p.byline.toLowerCase().includes(wsQ))
  );
  const wsSelCount = (ws?.papers ?? []).filter((p) => p.selected).length;
  const wsPapers: PaperVal[] = wsFiltered.map((p, i) => {
    const on = p.selected;
    const [dc, sl] = statusMap[p.status];
    return {
      id: i,
      title: p.title,
      byline: p.byline,
      year: p.year,
      venue: p.venue,
      citations: p.citations,
      tag: p.tag,
      status: p.status,
      toggle: () => wsTogglePaper(p.id),
      cardStyle: `padding:11px 14px; border-bottom:1px solid #f2f1ec; cursor:pointer; background:${on ? "#f7f9fd" : "#fff"}; border-left:2px solid ${on ? "#2b5fd1" : "transparent"};`,
      checkStyle: `flex:0 0 auto; width:16px; height:16px; margin-top:1px; border-radius:5px; border:1.5px solid ${on ? "#2b5fd1" : "#d2cfc8"}; background:${on ? "#2b5fd1" : "#fff"}; color:#fff; font-size:10px; display:flex; align-items:center; justify-content:center;`,
      checkMark: on ? "✓" : "",
      statusLabel: sl,
      statusStyle: `display:inline-flex; align-items:center; gap:4px; font-size:10.5px; color:${dc};`,
      dotStyle: `width:5px; height:5px; border-radius:50%; background:${dc};${p.status === "reading" ? "animation:pulse 1.4s infinite;" : ""}`,
    };
  });
  // The chat shows ONLY the active session's own messages. Never fall back to
  // the research-wide message list — an empty session must render empty, not
  // another session's chats.
  const wsThread = activeSessionId ? sessionMsgs ?? [] : ws?.messages ?? [];
  const liveRun = liveRunId ? runs[liveRunId] : undefined;
  const liveAi: ChatMsg[] = liveRun
    ? [{ role: "ai", parts: liveRun.parts.length ? liveRun.parts : liveRun.error ? [{ type: "text", text: liveRun.error }] : [] }]
    : [];
  const chatMessages: ChatMsg[] = [
    ...wsThread.map((m): ChatMsg => {
      // Replay the persisted UI-stream timeline (reasoning + tool calls + text)
      // so a completed run shows the SAME thinking view it streamed live — the
      // chat page (ChatPage.tsx) already does this; the workspace must too, or a
      // reloaded turn collapses to final-text-only. Fall back to text for old
      // turns saved before `parts` was persisted.
      const raw = (m as { parts?: unknown[] }).parts;
      if (m.role === "ai" && Array.isArray(raw) && raw.length) {
        const acc = createPartsAccumulator();
        for (const ev of raw) acc.apply(ev as Record<string, unknown>);
        return { role: "ai", parts: acc.parts };
      }
      return { role: m.role as "user" | "ai", parts: [{ type: "text", text: m.text }] };
    }),
    ...overlay,
    ...liveAi,
  ];
  const isStreaming = chatStreaming || (!!liveRun && (liveRun.status === "running" || liveRun.status === "queued"));

  // A pending ask_user the agent parked on — surfaces the same inline question
  // card here in the research page as in the standalone chat page.
  const rawAsk =
    liveRun && (liveRun.status === "running" || liveRun.status === "queued") ? pendingAsk(liveRun.parts) : null;
  const ask = rawAsk && !answeredRef.current.has(rawAsk.toolCallId) ? rawAsk : null;

  async function submitAnswers(toolCallId: string, answers: { question: string; answer: string }[]) {
    if (!liveRunId) return;
    answeredRef.current.add(toolCallId);
    setAnsweringId(toolCallId);
    try {
      await api.answerAsk(liveRunId, toolCallId, answers);
    } catch {
      answeredRef.current.delete(toolCallId); // let them retry on failure
    } finally {
      setAnsweringId((id) => (id === toolCallId ? null : id));
    }
  }

  const wsOutputs = ws?.outputs ?? [];
  const forestOut = wsOutputs.find((o) => o.type === "chart" && /forest/i.test(o.name));
  const wsForest = ((forestOut?.data as { forest?: ForestVal[] } | undefined)?.forest ?? forest) as ForestVal[];
  const tableOut = wsOutputs.find((o) => o.type === "table");
  const wsTableRows = ((tableOut?.data as { rows?: TableRowVal[] } | undefined)?.rows ?? tableRows) as TableRowVal[];
  const wsFindings = ws?.findings ?? [];
  const wsFiles = wsOutputs
    .filter((o) => o.type === "file")
    .map((o) => ({ name: o.name, kind: (o.data as { kind?: string }).kind ?? "md", size: o.meta, content: (o.data as { content?: string }).content ?? "" }));
  const wsCharts = wsOutputs.filter((o) => o.type === "chart").map((o) => ({ name: o.name, meta: o.meta }));
  const wsLogLines = ((wsOutputs.find((o) => o.type === "log")?.data as { lines?: { t: string; msg: string }[] } | undefined)?.lines ?? []) as { t: string; msg: string }[];

  const totalLabel = `${wsFiltered.length} of ${(ws?.papers ?? []).length}`;
  const selectedLabel = `${wsSelCount} papers in context`;
  const ctxK = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  const contextLabel =
    usage && usage.limit > 0
      ? `${wsSelCount} papers · ${usage.real === false ? "~" : ""}${ctxK(usage.tokens)} / ${ctxK(usage.limit)} ctx`
      : `${wsSelCount} papers`;

  const onSearch = (e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);
  const onDraft = (e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value);
  const clearSel = () => {};
  const goHome = () => {
    chrome.closeMenu();
    navigate("/researches");
  };
  const runCode = () => setTab("code");
  const showChat = () => setTab("chat");
  const showCode = () => setTab("code");

  if (isWorkspace) {
    return (
      <WorkspaceView
        goHome={goHome}
        tags={tags}
        totalLabel={totalLabel}
        search={search}
        onSearch={onSearch}
        selectedLabel={selectedLabel}
        clearSelection={clearSel}
        papers={wsPapers}
        loading={wsLoading && !ws}
        researchTitle={ws?.research.title ?? decodeURIComponent(sub ?? "")}
        isChat={tab === "chat"}
        isCode={tab === "code"}
        chatTabStyle={tabStyle(tab === "chat")}
        codeTabStyle={tabStyle(tab === "code")}
        showChat={showChat}
        showCode={showCode}
        contextLabel={contextLabel}
        chatMessages={chatMessages}
        chatStreaming={isStreaming}
        ask={ask}
        askSubmitting={!!ask && answeringId === ask.toolCallId}
        onAnswer={submitAnswers}
        model={chatModel}
        onModelChange={setChatModel}
        selectedPapers={(ws?.papers ?? []).filter((p) => p.selected).map((p) => ({ id: p.id, title: p.title, year: p.year }))}
        onDeselectPaper={wsTogglePaper}
        draft={draft}
        onDraft={onDraft}
        onKey={(e) => { if (e.key === "Enter") wsSend(); }}
        send={wsSend}
        runCode={runCode}
        filterValue={F}
        filterLabels={filterLabels}
        onFilterChange={onFilterChange}
        showChart={F === "all" || F === "charts"}
        chartsExclusive={F === "charts"}
        showFindings={F === "all" || F === "findings"}
        showTable={F === "all" || F === "tables"}
        tablesExclusive={F === "tables"}
        showLogs={false}
        showFiles={F === "all" || F === "files"}
        filesExclusive={F === "files"}
        showDocs={F === "docs"}
        docsExclusive={F === "docs"}
        researchId={ws?.research.id}
        documents={ws?.documents}
        onRefreshDocs={refreshDocs}
        outputsRefresh={outputsRefresh}
        onLibraryChanged={reloadLibrary}
        sessions={ws?.sessions?.map((sess) => ({ id: sess.id, title: sess.title, updatedAt: sess.updatedAt }))}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        forest={wsForest}
        tableRows={wsTableRows}
        findings={wsFindings}
        files={wsFiles}
        charts={wsCharts}
        logLines={wsLogLines}
      />
    );
  }

  return (
    <>
      <HomeView
        nav={chrome.nav}
        homeTitle={chrome.homeTitle}
        homeSub={chrome.homeSub}
        researches={cards}
        openTask={chrome.openTask}
        newAction={newAction}
        newLabel="New research"
        menuOpen={chrome.menuOpen}
        toggleMenu={chrome.toggleMenu}
        menuItems={chrome.menuItems}
      />

      <Modal opened={newModalOpen} onClose={() => setNewModalOpen(false)} title="New research" centered radius="md" size="lg">
        <Stack gap="md">
          <TextInput
            label="Research name"
            placeholder="e.g. Retrieval-Augmented Meta-Analysis"
            value={resName}
            onChange={onResName}
            data-autofocus
          />
          <Textarea
            label="Goal of the research"
            description="What question are you trying to answer? This guides the agent's work."
            placeholder="e.g. Determine whether reported effect sizes for retrieval-augmented methods hold up across domains, and quantify any publication bias."
            value={resGoal}
            onChange={onResGoal}
            autosize
            minRows={3}
            maxRows={8}
          />
          <Group justify="flex-end" gap="sm" mt="xs">
            <Button variant="default" onClick={() => setNewModalOpen(false)}>Cancel</Button>
            <Button color="dark" onClick={createResearch}>Create research</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
