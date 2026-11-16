import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Group, Menu, Text } from "@mantine/core";
import { ArrowUp, ArrowLeft, ChevronDown, ChevronUp, Check, Plus, MessageSquare, GitBranch, BookOpen, BarChart3, ShieldCheck } from "lucide-react";
import Sidebar from "../../components/workspace/Sidebar";
import { MODELS } from "../../components/workspace/WorkspaceView";
import { AgentMessage, type ChatMsg } from "../../components/workspace/AgentMessage";
import { QuestionCard, pendingAsk } from "../../components/workspace/QuestionCard";
import { api, type ApiMessage } from "../../lib/api";
import { createPartsAccumulator } from "../../lib/partsReducer";
import { useRuns } from "../../lib/RunProvider";
import type { HomeChrome } from "./shared";

interface Props {
  sub?: string; // when present, this is a chat session id (/chat/:id)
  chrome: HomeChrome;
}

/**
 * The Chat home. A chat is a normal research *session* — it always belongs to a
 * research (a real one you picked, or one auto-created with an AI-generated
 * name). But the chat SURFACE is a clean conversation page (sidebar + thread +
 * bottom composer) — NOT the research workspace. It uses the SAME agent + the
 * same streaming message renderer + the same async run plumbing as the research
 * chat; it just drops the papers/library/outputs panels. Recent chats live in
 * the shared <Sidebar> (always visible), not here.
 */
export default function ChatPage({ sub, chrome }: Props) {
  if (sub) return <ChatConversation key={sub} sessionId={sub} chrome={chrome} />;
  return <ChatLanding chrome={chrome} />;
}

/* Rotating hero prompts — cycle every few seconds for a bit of wit. */
const RESEARCH_PROMPTS = [
  "What should we research?",
  "Curiosity, meet compute.",
  "What are we proving today?",
  "Point me at a hard question.",
  "Let's settle it with evidence.",
  "Ask the literature anything.",
];

/* Starter suggestion chips under the hero heading. Clicking one seeds the composer
   with a fuller prompt (and focuses it) so the user can finish the thought. */
const SUGGESTIONS = [
  { icon: BookOpen, label: "Survey the literature", prompt: "Survey the recent literature on " },
  { icon: GitBranch, label: "Compare hypotheses", prompt: "Put these competing hypotheses in a tournament and tell me which the evidence favors: " },
  { icon: BarChart3, label: "Analyze a dataset", prompt: "Analyze this dataset and tell me what it actually shows: " },
  { icon: ShieldCheck, label: "Fact-check a claim", prompt: "Fact-check this claim against the primary sources: " },
];

/* ---------------- landing composer ---------------- */
function ChatLanding({ chrome }: { chrome: HomeChrome }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(MODELS[0]);
  const [researchId, setResearchId] = useState<string | null>(null);
  const [researches, setResearches] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [headingIdx, setHeadingIdx] = useState(0);
  const [headingShown, setHeadingShown] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cross-fade the hero heading to the next witty prompt every few seconds.
  useEffect(() => {
    let alive = true;
    const id = setInterval(() => {
      if (!alive) return;
      setHeadingShown(false);
      setTimeout(() => {
        if (!alive) return;
        setHeadingIdx((i) => (i + 1) % RESEARCH_PROMPTS.length);
        setHeadingShown(true);
      }, 340);
    }, 3400);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    api.listResearches().then(({ researches }) => setResearches(researches.map((r) => ({ id: r.id, title: r.title })))).catch(() => {});
  }, []);

  const start = async () => {
    const prompt = draft.trim();
    if (!prompt || busy) return;
    setBusy(true);
    try {
      const { sessionId } = await api.chatStart({ prompt, researchId, model });
      navigate(`/chat/${encodeURIComponent(sessionId)}`, { state: { prompt, autoSend: true, model } });
    } catch {
      setBusy(false);
    }
  };

  const researchLabel = researchId ? researches.find((r) => r.id === researchId)?.title ?? "Research" : "New research";

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#ffffff" }}>
      <Sidebar nav={chrome.nav} openTask={chrome.openTask} menuOpen={chrome.menuOpen} toggleMenu={chrome.toggleMenu} menuItems={chrome.menuItems} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#ffffff" }}>
        <Text ta="center" style={{ fontSize: 30, fontWeight: 600, color: "#1c1b19", marginBottom: 18, minHeight: 40, transition: "opacity 0.34s ease", opacity: headingShown ? 1 : 0 }}>
          {RESEARCH_PROMPTS[headingIdx]}
        </Text>

        <div style={{ display: "flex", flexWrap: "nowrap", justifyContent: "center", gap: 8, marginBottom: 24, maxWidth: "100%" }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => { setDraft(s.prompt); inputRef.current?.focus(); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap", color: "#3a3733", background: "#f6f5f2", border: "1px solid #e6e4de", borderRadius: 0, cursor: "pointer", transition: "background 0.15s ease, border-color 0.15s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#efeee9"; e.currentTarget.style.borderColor = "#d9d6cf"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f6f5f2"; e.currentTarget.style.borderColor = "#e6e4de"; }}
            >
              <s.icon size={14} color="#8a8680" />
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ width: "100%", maxWidth: 720 }}>
          <div style={{ border: "1px solid #e3e0da", background: "#fff", borderRadius: 4, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  start();
                }
              }}
              placeholder="Ask anything, or describe what to research…"
              rows={3}
              style={{ width: "100%", border: "none", outline: "none", resize: "none", padding: "16px 16px 8px", fontSize: 15, fontFamily: "inherit", color: "#1c1b19", background: "transparent", lineHeight: 1.5 }}
            />
            <Group justify="space-between" px={10} py={8} style={{ borderTop: "1px solid #f0eee9" }}>
              <Group gap={8}>
                <Menu position="bottom-start" width={260} shadow="md">
                  <Menu.Target>
                    <button className="crm-composer-chip">
                      <MessageSquare size={13} />
                      <span>{researchLabel}</span>
                      <ChevronDown size={13} />
                    </button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<Plus size={13} />} onClick={() => setResearchId(null)}>
                      New research (auto-named)
                    </Menu.Item>
                    {researches.length > 0 && <Menu.Divider />}
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {researches.map((r) => (
                        <Menu.Item key={r.id} onClick={() => setResearchId(r.id)}>
                          {r.title}
                        </Menu.Item>
                      ))}
                    </div>
                  </Menu.Dropdown>
                </Menu>

                <Menu position="bottom-start" width={220} shadow="md">
                  <Menu.Target>
                    <button className="crm-composer-chip">
                      <span>{model}</span>
                      <ChevronDown size={13} />
                    </button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {MODELS.map((m) => (
                      <Menu.Item key={m} onClick={() => setModel(m)}>{m}</Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              </Group>

              <button onClick={start} disabled={!draft.trim() || busy} className="crm-composer-send" aria-label="Send">
                <ArrowUp size={16} />
              </button>
            </Group>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- conversation view (/chat/:sessionId) ---------------- */
function ChatConversation({ sessionId, chrome }: { sessionId: string; chrome: HomeChrome }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { attach: attachRun, runs } = useRuns();

  const [researchId, setResearchId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [researchTitle, setResearchTitle] = useState("");
  const [thread, setThread] = useState<ApiMessage[] | null>(null);
  const [overlay, setOverlay] = useState<ChatMsg[]>([]);
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState((location.state as { model?: string } | null)?.model ?? MODELS[0]);
  const [pendingSend, setPendingSend] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ tokens: number; limit: number; real?: boolean } | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const answeredRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Context usage — refetch when a run finishes (busy → false) or the model changes.
  useEffect(() => {
    if (!sessionId) { setUsage(null); return; }
    let alive = true;
    api.sessionUsage(sessionId, model).then((u) => alive && setUsage(u)).catch(() => {});
    return () => { alive = false; };
  }, [sessionId, busy, model]);

  // Resolve the session → research, load the thread.
  useEffect(() => {
    let alive = true;
    setThread(null);
    setOverlay([]);
    setLiveRunId(null);
    api
      .getSession(sessionId)
      .then(({ session, research }) => {
        if (!alive) return;
        setResearchId(research?.id ?? session.researchId);
        setTitle(session.title);
        setResearchTitle(research?.title ?? "");
      })
      .catch(() => {});
    api
      .sessionMessages(sessionId)
      .then(({ messages }) => alive && setThread(messages))
      .catch(() => alive && setThread([]));
    api.touchSession(sessionId).catch(() => {});
    return () => {
      alive = false;
    };
  }, [sessionId]);

  // Pick up an auto-send handoff from the landing composer.
  useEffect(() => {
    const st = location.state as { prompt?: string; autoSend?: boolean } | null;
    if (st?.autoSend && st.prompt) {
      setPendingSend(st.prompt);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Reattach to a still-running run when entering / returning to this chat.
  useEffect(() => {
    if (liveRunId) return;
    let alive = true;
    api
      .activeRun(sessionId)
      .then(({ run }) => {
        if (!alive || !run) return;
        setOverlay([{ role: "user", parts: [{ type: "text", text: run.prompt }] }]);
        setLiveRunId(run.id);
        attachRun(run.id);
        setBusy(true);
        setStreaming(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // React to the live run finishing.
  useEffect(() => {
    if (!liveRunId) return;
    const st = runs[liveRunId]?.status;
    if (st === "done") {
      api.sessionMessages(sessionId).then(({ messages }) => setThread(messages)).catch(() => {});
      setOverlay([]);
      setLiveRunId(null);
      setBusy(false);
      setStreaming(false);
    } else if (st === "failed" || st === "canceled") {
      setBusy(false);
      setStreaming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, liveRunId, sessionId]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || busy || !researchId) return;
    setDraft("");

    const prior = thread ?? [];
    const history = [
      ...prior.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
      { role: "user", content: text },
    ];

    setOverlay([{ role: "user", parts: [{ type: "text", text }] }]);
    setBusy(true);
    setStreaming(true);
    try {
      const { task } = await api.createTask({
        prompt: text,
        kind: "chat",
        researchId,
        sessionId,
        messages: history,
        model,
      });
      setLiveRunId(task.id);
      attachRun(task.id);
    } catch {
      setOverlay([
        { role: "user", parts: [{ type: "text", text }] },
        { role: "ai", parts: [{ type: "text", text: "Agent unreachable — is the API running?" }] },
      ]);
      setBusy(false);
      setStreaming(false);
    }
  }

  // Fire the auto-send once the research is resolved.
  useEffect(() => {
    if (!pendingSend || !researchId || busy) return;
    const t = pendingSend;
    setPendingSend(null);
    send(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSend, researchId, busy]);

  const liveRun = liveRunId ? runs[liveRunId] : undefined;
  // A pending ask_user the agent is parked on — render an inline question card.
  const ask =
    liveRun && (liveRun.status === "running" || liveRun.status === "queued")
      ? pendingAsk(liveRun.parts)
      : null;
  const showAsk = ask && !answeredRef.current.has(ask.toolCallId) ? ask : null;

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

  const liveAi: ChatMsg[] = liveRun
    ? [{ role: "ai", parts: liveRun.parts.length ? liveRun.parts : liveRun.error ? [{ type: "text", text: liveRun.error }] : [] }]
    : [];
  const messages: ChatMsg[] = useMemo(
    () => [
      ...(thread ?? []).map((m): ChatMsg => {
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
    ],
    [thread, overlay, liveAi]
  );
  const isStreaming = streaming || (!!liveRun && (liveRun.status === "running" || liveRun.status === "queued"));

  // Keep the view pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#faf9f6" }}>
      <Sidebar nav={chrome.nav} openTask={chrome.openTask} menuOpen={chrome.menuOpen} toggleMenu={chrome.toggleMenu} menuItems={chrome.menuItems} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* header */}
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderBottom: "1px solid #ebe9e4", background: "#faf9f6" }}>
          <button onClick={() => navigate("/chat")} title="New chat" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "1px solid #e6e4de", background: "#fff", color: "#57534d", cursor: "pointer" }}>
            <ArrowLeft size={15} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text fw={600} size="sm" truncate>{title || "New chat"}</Text>
            {researchTitle && (
              <Group gap={5} wrap="nowrap">
                <MessageSquare size={11} color="#a29e97" />
                <Text size="11px" c="dimmed" truncate>{researchTitle}</Text>
              </Group>
            )}
          </div>
          {researchId && (
            <button
              onClick={() => navigate(`/researches/${encodeURIComponent(researchId)}`)}
              style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid #e6e4de", background: "#fff", color: "#3a3733", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit" }}
            >
              <MessageSquare size={13} color="#8a8680" />
              Open research
            </button>
          )}
        </div>

        {/* thread */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "20px 22px 8px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {messages.map((m, i) => (
              <AgentMessage key={i} message={m} streaming={isStreaming && m.role === "ai" && i === messages.length - 1} />
            ))}
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <div className="home-row assistant">
                <div className="home-assistant-main">
                  <span className="typing"><i /><i /><i /></span>
                </div>
              </div>
            )}
            {showAsk && (
              <QuestionCard
                key={showAsk.toolCallId}
                input={showAsk.input}
                submitting={answeringId === showAsk.toolCallId}
                onSubmit={(answers) => submitAnswers(showAsk.toolCallId, answers)}
              />
            )}
          </div>
        </div>

        {/* composer */}
        <div style={{ flex: "0 0 auto", padding: "10px 22px 18px", background: "#faf9f6" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", padding: "14px 16px 10px", background: "#fff", border: "1px solid #e2e0da", borderRadius: 0, boxShadow: "0 1px 3px rgba(28,27,25,0.04)" }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder="Reply to the research agent…"
              style={{ width: "100%", border: "none", outline: "none", resize: "none", fontFamily: "inherit", fontSize: 14, lineHeight: 1.55, padding: 0, color: "#1c1b19", background: "transparent", minHeight: 44, maxHeight: 200, overflowY: "auto" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <Menu position="top-start" width={190} radius={0} shadow="md">
                <Menu.Target>
                  <button title="Choose model" style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: 0, border: "1px solid #e6e4de", background: "#faf9f6", color: "#3a3733", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit" }}>
                    {model}
                    <ChevronUp size={13} color="#8a8680" />
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Model</Menu.Label>
                  {MODELS.map((m) => (
                    <Menu.Item key={m} onClick={() => setModel(m)} rightSection={m === model ? <Check size={13} /> : null}>
                      {m}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
              <button
                onClick={() => send()}
                disabled={!draft.trim() || busy}
                className="crm-composer-send"
                title="Send"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>

          {/* Context usage — full history (incl. tool calls/results) vs the model's window */}
          {usage && usage.limit > 0 && (() => {
            const pct = Math.min(100, Math.round((usage.tokens / usage.limit) * 100));
            const near = pct >= 80;
            const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`);
            return (
              <div style={{ maxWidth: 720, margin: "7px auto 0", display: "flex", alignItems: "center", gap: 9, fontSize: 11.5, color: near ? "#b3402e" : "#a29e97" }}>
                <div style={{ flex: 1, height: 3, background: "#ececec", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: near ? "#b3402e" : "#3F7355" }} />
                </div>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "nowrap" }}>
                  {usage.real === false ? "~" : ""}{k(usage.tokens)} / {k(usage.limit)} · {pct}%
                </span>
                {near && (
                  <button onClick={() => navigate("/chat")} style={{ border: "none", background: "none", padding: 0, color: "#b3402e", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "inherit" }}>
                    Start new session →
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
