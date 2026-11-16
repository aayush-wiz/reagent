import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { Box, Code, List, Menu, Tabs, Text, ThemeIcon } from "@mantine/core";
import { Check, ChevronDown, ChevronUp, MessagesSquare, Plus, TriangleAlert } from "lucide-react";
import DocsBrowser from "./DocsBrowser";
import WorkspaceOutputs from "./WorkspaceOutputs";
import PublicLibrary from "./PublicLibrary";
import { AgentMessage, type ChatMsg } from "./AgentMessage";
import { QuestionCard, type AskInput } from "./QuestionCard";

// First = the default/primary (GLM 5.2, OpenRouter, ~1M context). Sonnet stays selectable.
export const MODELS = ["GLM 5.2", "Claude Sonnet 4.6", "DeepSeek V4 Flash", "Llama 4 Maverick", "Qwen 3.7 Plus"];
import { parseStyleString } from "../../lib/parseStyleString";
import BrowserShell from "./BrowserShell";
import FileBrowser from "./FileBrowser";
import ChartBrowser from "./ChartBrowser";
import TableBrowser from "./TableBrowser";
import type { ForestVal, MessageVal, PaperVal, TableRowVal, TagVal } from "./types";

function FindingIcon({ kind }: { kind: "ok" | "warn" }) {
  return kind === "ok" ? (
    <ThemeIcon size={18} radius="sm" color="green" variant="light">
      <Check size={12} />
    </ThemeIcon>
  ) : (
    <ThemeIcon size={18} radius="sm" color="orange" variant="light">
      <TriangleAlert size={12} />
    </ThemeIcon>
  );
}

const OUTPUTS_MIN_WIDTH = 340;
const OUTPUTS_MAX_WIDTH = 820;
const LIBRARY_WIDTH = 300;
const DIVIDER_WIDTH = 6;
// The chat/code column is never allowed to get narrower than this — the Outputs
// panel is capped so the three columns always fit the window (no horizontal scroll).
const MAIN_MIN_WIDTH = 300;
// Composer grows with content up to this height, then scrolls internally.
const COMPOSER_MAX_HEIGHT = 180;

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
}
// Default split of the space remaining after the Library column: ~55% chat/code, ~45% Outputs
// (chat widened ~20% from the previous 46/54 split — the extra room is taken from the Outputs panel on the right).
const OUTPUTS_DEFAULT_RATIO = 0.448;

/** Largest the Outputs panel may be right now without pushing the middle column below its minimum. */
function maxOutputsWidth(): number {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const fits = viewportWidth - LIBRARY_WIDTH - DIVIDER_WIDTH - MAIN_MIN_WIDTH;
  return Math.max(OUTPUTS_MIN_WIDTH, Math.min(OUTPUTS_MAX_WIDTH, fits));
}

function computeDefaultOutputsWidth(): number {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const remaining = viewportWidth - LIBRARY_WIDTH - DIVIDER_WIDTH;
  const desired = Math.round(remaining * OUTPUTS_DEFAULT_RATIO);
  return Math.min(maxOutputsWidth(), Math.max(OUTPUTS_MIN_WIDTH, desired));
}

interface Props {
  goHome: () => void;
  tags: TagVal[];
  totalLabel: string;
  search: string;
  onSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  selectedLabel: string;
  clearSelection: () => void;
  papers: PaperVal[];
  isChat: boolean;
  isCode: boolean;
  chatTabStyle: string;
  codeTabStyle: string;
  showChat: () => void;
  showCode: () => void;
  contextLabel: string;
  chatMessages: ChatMsg[];
  chatStreaming: boolean;
  // A pending ask_user the live run is parked on — renders an inline question card
  // in the research-page chat (same HITL flow as the standalone chat page).
  ask?: { toolCallId: string; input: AskInput } | null;
  askSubmitting?: boolean;
  onAnswer?: (toolCallId: string, answers: { question: string; answer: string }[]) => void;
  model?: string;
  onModelChange?: (m: string) => void;
  selectedPapers?: { id: string; title: string; year: string }[];
  onDeselectPaper?: (id: string) => void;
  draft: string;
  onDraft: (e: ChangeEvent<HTMLInputElement>) => void;
  onKey: (e: KeyboardEvent<HTMLInputElement>) => void;
  send: () => void;
  runCode: () => void;
  filterValue: string;
  filterLabels: Record<string, string>;
  onFilterChange: (v: string) => void;
  showChart: boolean;
  chartsExclusive: boolean;
  showFindings: boolean;
  showTable: boolean;
  tablesExclusive: boolean;
  showLogs: boolean;
  showFiles: boolean;
  filesExclusive: boolean;
  forest: ForestVal[];
  tableRows: TableRowVal[];
  loading?: boolean;
  researchTitle?: string;
  findings?: { id: string; kind: "ok" | "warn"; text: string }[];
  files?: { name: string; kind: string; size: string; content: string }[];
  charts?: { name: string; meta: string }[];
  logLines?: { t: string; msg: string }[];
  // Docs tab (per-research working documents).
  researchId?: string;
  documents?: DocMetaVal[];
  showDocs?: boolean;
  docsExclusive?: boolean;
  onRefreshDocs?: () => void;
  outputsRefresh?: number;
  onLibraryChanged?: () => void;
  // Session switcher.
  sessions?: SessionVal[];
  activeSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  onNewSession?: () => void;
}

interface DocMetaVal {
  name: string;
  title: string;
  hint: string;
  exists: boolean;
  updatedAt: number | null;
  chars: number;
}
interface SessionVal {
  id: string;
  title: string;
  updatedAt?: number;
}

/** Compact "last used" label: time today, else date. */
function sessionWhen(ms?: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function WorkspaceView({
  goHome,
  tags,
  totalLabel,
  search,
  onSearch,
  selectedLabel,
  clearSelection,
  papers,
  isChat,
  isCode,
  chatTabStyle,
  codeTabStyle,
  showChat,
  showCode,
  contextLabel,
  chatMessages,
  chatStreaming,
  ask,
  askSubmitting,
  onAnswer,
  model: modelProp,
  onModelChange,
  selectedPapers,
  onDeselectPaper,
  draft,
  onDraft,
  onKey,
  send,
  runCode,
  filterValue,
  filterLabels,
  onFilterChange,
  showChart,
  chartsExclusive,
  showFindings,
  showTable,
  tablesExclusive,
  showLogs,
  showFiles,
  filesExclusive,
  forest,
  tableRows,
  loading,
  researchTitle,
  findings,
  files,
  charts,
  logLines,
  researchId,
  documents,
  showDocs,
  docsExclusive,
  onRefreshDocs,
  outputsRefresh,
  onLibraryChanged,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: Props) {
  const [outputsWidth, setOutputsWidth] = useState(computeDefaultOutputsWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [modelLocal, setModelLocal] = useState(MODELS[0]);
  const model = modelProp ?? modelLocal;
  const setModel = onModelChange ?? setModelLocal;
  const [libTab, setLibTab] = useState<"library" | "public">("library");

  // Keep the panel within the space the window can actually give it when the window is resized.
  useEffect(() => {
    const onResize = () => setOutputsWidth((w) => Math.min(maxOutputsWidth(), Math.max(OUTPUTS_MIN_WIDTH, w)));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: outputsWidth };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - moveEvent.clientX;
      const next = Math.min(maxOutputsWidth(), Math.max(OUTPUTS_MIN_WIDTH, dragRef.current.startWidth + delta));
      setOutputsWidth(next);
    };
    const onMouseUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <>
      {/* TOP BAR */}
      <header style={{ height: 52, flex: "0 0 52px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", background: "#ffffff", borderBottom: "1px solid #e2e0da" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={goHome} title="All researches" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e0da", background: "#f4f3ef", color: "#57534d", fontSize: 15, cursor: "pointer" }}>
            ←
          </button>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "#1c1b19", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Google Sans Flex',sans-serif", fontWeight: 700, fontSize: 15 }}>
            R
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontFamily: "'Google Sans Flex',sans-serif", fontWeight: 600, fontSize: 14.5 }}>{researchTitle || "Research"}</span>
            <span style={{ fontSize: 11, color: "#8a8680" }}>Workspace · autosaved 2m ago</span>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* ============ LEFT: PAPERS ============ */}
        <aside style={{ width: LIBRARY_WIDTH, flex: `0 0 ${LIBRARY_WIDTH}px`, display: "flex", flexDirection: "column", background: "#ffffff", borderRight: "1px solid #e2e0da", minHeight: 0 }}>
          {/* Library / Public tabs */}
          <div style={{ display: "flex", alignItems: "stretch", padding: "0 8px", borderBottom: "1px solid #edece7" }}>
            {(["library", "public"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setLibTab(t)}
                style={{
                  padding: "11px 12px 9px",
                  fontSize: 13,
                  fontWeight: libTab === t ? 600 : 400,
                  color: libTab === t ? "#1c1b19" : "#8a8680",
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${libTab === t ? "#1c1b19" : "transparent"}`,
                  cursor: "pointer",
                }}
              >
                {t === "library" ? "Library" : "Public"}
                {t === "library" && <span style={{ marginLeft: 6, fontSize: 11, color: "#a8a49d", fontWeight: 400 }}>{totalLabel}</span>}
              </button>
            ))}
          </div>
          {libTab === "library" && (
            <div style={{ padding: "11px 14px", borderBottom: "1px solid #edece7" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f4f3ef", border: "1px solid #e6e4de", borderRadius: 8 }}>
                <span style={{ color: "#a8a49d", fontSize: 13 }}>⌕</span>
                <input
                  value={search}
                  onChange={onSearch}
                  placeholder="Search this library…"
                  style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, width: "100%", color: "#1c1b19" }}
                />
              </div>
            </div>
          )}

          {/* PUBLIC library — browse the shared pool, add to this research */}
          {libTab === "public" && researchId && (
            <PublicLibrary researchId={researchId} onAdded={() => onLibraryChanged?.()} />
          )}

          {/* LIBRARY — this research's own papers */}
          {libTab === "library" && (
            <>
              {/* tag filters */}
              <div style={{ padding: "11px 14px 9px", borderBottom: "1px solid #edece7" }}>
                <div style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#a29e97", marginBottom: 8 }}>Clusters</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tags.map((tag) => (
                    <button key={tag.label} onClick={tag.toggle} style={parseStyleString(tag.style)}>
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* selection status */}
              <div style={{ padding: "9px 14px", borderBottom: "1px solid #edece7", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f7f9fd" }}>
                <span style={{ fontSize: 11.5, color: "#2b5fd1", fontWeight: 500 }}>{selectedLabel}</span>
                <button onClick={clearSelection} style={{ fontSize: 11, color: "#8a8680", background: "none", border: "none", cursor: "pointer" }}>
                  Clear
                </button>
              </div>

              {/* paper list */}
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                {papers.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "#8a8680" }}>
                    No papers yet. Switch to <b>Public</b> to add some, or ask the agent to find papers.
                  </div>
                ) : (
                  papers.map((p) => (
                    <div key={p.id} onClick={p.toggle} style={parseStyleString(p.cardStyle)}>
                      <div style={{ display: "flex", gap: 9 }}>
                        <div style={parseStyleString(p.checkStyle)}>{p.checkMark}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontFamily: "'Google Sans Flex',sans-serif", fontSize: 12.8, fontWeight: 600, lineHeight: 1.32, color: "#211f1c" }}>{p.title}</div>
                          <div style={{ fontSize: 11, color: "#8a8680", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.byline}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                            <span style={parseStyleString(p.statusStyle)}>
                              <span style={parseStyleString(p.dotStyle)} />
                              {p.statusLabel}
                            </span>
                            <span style={{ fontSize: 10.5, color: "#a8a49d" }}>✳ {p.citations}</span>
                            <span style={{ fontSize: 10.5, color: "#a8a49d" }}>{p.year}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </aside>

        {/* ============ MIDDLE: CHAT / CODE ============ */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", background: "#faf9f6", minHeight: 0, minWidth: MAIN_MIN_WIDTH }}>
          {/* tab bar */}
          <div style={{ height: 44, flex: "0 0 44px", display: "flex", alignItems: "stretch", padding: "0 8px", background: "#ffffff", borderBottom: "1px solid #e2e0da" }}>
            {/* session switcher — now occupies the old Chat-tab position (Chat is the only view) */}
            {onSelectSession && (
              <Menu shadow="md" width={260} position="bottom-start">
                <Menu.Target>
                  <button
                    style={parseStyleString(
                      "display:flex; align-items:center; gap:6px; padding:0 10px; margin:6px 6px; font-size:12px; cursor:pointer; background:#ffffff; border:1px solid #e2e0da; border-radius:7px; color:#57534d; max-width:220px;",
                    )}
                    title="Switch chat session"
                  >
                    <MessagesSquare size={13} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sessions?.find((x) => x.id === activeSessionId)?.title ?? "New session"}
                    </span>
                    <ChevronDown size={13} />
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Chat sessions</Menu.Label>
                  {[...(sessions ?? [])]
                    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
                    .map((sess) => (
                      <Menu.Item
                        key={sess.id}
                        onClick={() => onSelectSession(sess.id)}
                        leftSection={<MessagesSquare size={13} />}
                        rightSection={
                          sess.updatedAt ? <span style={{ fontSize: 10.5, color: "#a8a49d", marginLeft: 10 }}>{sessionWhen(sess.updatedAt)}</span> : null
                        }
                        style={{ fontWeight: sess.id === activeSessionId ? 600 : 400 }}
                      >
                        {sess.title}
                      </Menu.Item>
                    ))}
                  {(sessions?.length ?? 0) > 0 && <Menu.Divider />}
                  <Menu.Item onClick={() => onNewSession?.()} leftSection={<Plus size={13} />}>
                    New session
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", paddingRight: 8, fontSize: 11, color: "#a8a49d" }}>{contextLabel}</div>
          </div>

          {/* CHAT view */}
          {isChat && (
            <>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "20px 22px 8px" }}>
                <div style={{ maxWidth: 864, margin: "0 auto" }}>
                  {chatMessages.map((m, i) => (
                    <AgentMessage
                      key={i}
                      message={m}
                      streaming={chatStreaming && m.role === "ai" && i === chatMessages.length - 1}
                    />
                  ))}
                  {/* placeholder while the assistant turn hasn't started yet */}
                  {chatStreaming && chatMessages[chatMessages.length - 1]?.role === "user" && (
                    <div className="home-row assistant">
                      <div className="home-assistant-main">
                        <span className="typing"><i /><i /><i /></span>
                      </div>
                    </div>
                  )}
                  {/* ask_user HITL — the run is parked on a question; answer it inline */}
                  {ask && (
                    <QuestionCard
                      key={ask.toolCallId}
                      input={ask.input}
                      submitting={askSubmitting}
                      onSubmit={(answers) => onAnswer?.(ask.toolCallId, answers)}
                    />
                  )}
                </div>
              </div>
              {/* composer */}
              <div style={{ flex: "0 0 auto", padding: "10px 22px 18px", background: "#faf9f6" }}>
                <div
                  style={{
                    maxWidth: 864,
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    padding: "14px 16px 10px",
                    background: "#fff",
                    border: "1px solid #e2e0da",
                    borderRadius: 0,
                    boxShadow: "0 1px 3px rgba(28,27,25,0.04)",
                  }}
                >
                  {/* attached (selected) papers — sent with the turn as context */}
                  {selectedPapers && selectedPapers.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {selectedPapers.map((p) => (
                        <span key={p.id} className="paper-badge" title={p.title}>
                          <span className="paper-badge-icon">◈</span>
                          {p.title.length > 30 ? p.title.slice(0, 30) + "…" : p.title}
                          <span className="paper-badge-x" onClick={() => onDeselectPaper?.(p.id)} title="Remove from context">
                            ×
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(e) => {
                      onDraft(e as unknown as ChangeEvent<HTMLInputElement>);
                      autoGrow(e.currentTarget);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                        requestAnimationFrame(() => composerRef.current && autoGrow(composerRef.current));
                      }
                    }}
                    rows={2}
                    placeholder="Ask about the selected papers, or request an analysis…"
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      resize: "none",
                      fontFamily: "inherit",
                      fontSize: 14,
                      lineHeight: 1.55,
                      padding: 0,
                      color: "#1c1b19",
                      background: "transparent",
                      minHeight: 56,
                      maxHeight: COMPOSER_MAX_HEIGHT,
                      overflowY: "auto",
                    }}
                  />
                  {/* bottom toolbar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <Menu position="top-start" width={190} radius={0} shadow="md">
                      <Menu.Target>
                        <button
                          title="Choose model"
                          style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: 0, border: "1px solid #e6e4de", background: "#faf9f6", color: "#3a3733", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit" }}
                        >
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: "#a8a49d" }}>{contextLabel}</span>
                      <button
                        onClick={send}
                        title="Send"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 0, background: "#1c1b19", color: "#fff", border: "none", cursor: "pointer", fontSize: 15 }}
                      >
                        ↑
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CODE view */}
          {isCode && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#1f2228" }}>
              <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "#24272e", borderBottom: "1px solid #30343c" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: "#9aa0ab" }}>
                  <span style={{ color: "#6b7280" }}>◐</span> analysis.py · Python 3.11 · kernel ready
                </div>
                <button onClick={runCode} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 13px", background: "#2b5fd1", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, cursor: "pointer" }}>
                  ▶ Run
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto", minHeight: 0, padding: "14px 4px 14px 0", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, lineHeight: 1.75 }}>
                <pre style={{ margin: 0, color: "#c8cdd6" }}>
                  <span style={{ color: "#5f6672" }}>  1</span>  <span style={{ color: "#c678dd" }}>import</span> pandas <span style={{ color: "#c678dd" }}>as</span> pd{"\n"}
                  <span style={{ color: "#5f6672" }}>  2</span>  <span style={{ color: "#c678dd" }}>import</span> numpy <span style={{ color: "#c678dd" }}>as</span> np{"\n"}
                  <span style={{ color: "#5f6672" }}>  3</span>  <span style={{ color: "#c678dd" }}>from</span> scipy <span style={{ color: "#c678dd" }}>import</span> stats{"\n"}
                  <span style={{ color: "#5f6672" }}>  4</span>
                  {"\n"}
                  <span style={{ color: "#5f6672" }}>  5</span>  <span style={{ color: "#7f8894" }}># Effect sizes extracted from 42 selected papers</span>
                  {"\n"}
                  <span style={{ color: "#5f6672" }}>  6</span>  df = pd.<span style={{ color: "#61afef" }}>read_parquet</span>(<span style={{ color: "#98c379" }}>"corpus/effects.parquet"</span>)
                  {"\n"}
                  <span style={{ color: "#5f6672" }}>  7</span>  df = df[df.<span style={{ color: "#e5c07b" }}>selected</span> == <span style={{ color: "#d19a66" }}>True</span>]
                  {"\n"}
                  <span style={{ color: "#5f6672" }}>  8</span>
                  {"\n"}
                  <span style={{ color: "#5f6672" }}>  9</span>  <span style={{ color: "#7f8894" }}># Random-effects meta-analysis (DerSimonian–Laird)</span>
                  {"\n"}
                  <span style={{ color: "#5f6672" }}> 10</span>  w = <span style={{ color: "#d19a66" }}>1</span> / (df.<span style={{ color: "#e5c07b" }}>var</span> + <span style={{ color: "#61afef" }}>tau2</span>(df))
                  {"\n"}
                  <span style={{ color: "#5f6672" }}> 11</span>  pooled = np.<span style={{ color: "#61afef" }}>average</span>(df.<span style={{ color: "#e5c07b" }}>effect</span>, weights=w)
                  {"\n"}
                  <span style={{ color: "#5f6672" }}> 12</span>  ci = <span style={{ color: "#61afef" }}>confint</span>(pooled, w)
                  {"\n"}
                  <span style={{ color: "#5f6672" }}> 13</span>
                  {"\n"}
                  <span style={{ color: "#5f6672" }}> 14</span>  <span style={{ color: "#61afef" }}>print</span>(<span style={{ color: "#98c379" }}>f"Pooled effect g = </span><span style={{ color: "#d19a66" }}>{"{pooled:.3f}"}</span><span style={{ color: "#98c379" }}>"</span>)
                  {"\n"}
                  <span style={{ color: "#5f6672" }}> 15</span>  <span style={{ color: "#61afef" }}>print</span>(<span style={{ color: "#98c379" }}>f"95% CI [</span><span style={{ color: "#d19a66" }}>{"{ci[0]:.3f}"}</span><span style={{ color: "#98c379" }}>, </span><span style={{ color: "#d19a66" }}>{"{ci[1]:.3f}"}</span><span style={{ color: "#98c379" }}>]"</span>)
                  {"\n"}
                  <span style={{ color: "#5f6672" }}> 16</span>  <span style={{ color: "#61afef" }}>plot_forest</span>(df, pooled, ci)
                </pre>
              </div>
              <div style={{ flex: "0 0 auto", maxHeight: 150, overflow: "auto", padding: "10px 16px", background: "#191c21", borderTop: "1px solid #30343c", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, lineHeight: 1.7, color: "#9aa0ab" }}>
                <div style={{ color: "#6b7280" }}>$ python analysis.py</div>
                <div style={{ color: "#98c379" }}>Pooled effect g = 0.412</div>
                <div style={{ color: "#98c379" }}>95% CI [0.318, 0.506]</div>
                <div style={{ color: "#7f8894" }}>Forest plot written → outputs/forest.svg</div>
                <div style={{ color: "#c8cdd6" }}>
                  ✓ completed in 1.84s <span style={{ animation: "blink 1.1s infinite" }}>▋</span>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ============ DIVIDER (drag to resize Outputs) ============ */}
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          style={{
            flex: `0 0 ${DIVIDER_WIDTH}px`,
            width: DIVIDER_WIDTH,
            cursor: "col-resize",
            background: "transparent",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, transform: "translateX(-50%)", background: "#e2e0da" }} />
        </div>

        {/* ============ RIGHT: OUTPUTS ============ */}
        <aside style={{ width: outputsWidth, flex: `0 0 ${outputsWidth}px`, display: "flex", flexDirection: "column", background: "#ffffff", minHeight: 0, overflow: "hidden" }}>
          <Box px="md" pt="sm" style={{ flex: "0 0 auto" }}>
            <Tabs value={filterValue} onChange={(v) => v && onFilterChange(v)} variant="default">
              <Tabs.List>
                {Object.entries(filterLabels).map(([value, label]) => (
                  <Tabs.Tab key={value} value={value}>
                    {label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          </Box>

          {(() => {
            // A single tab is shown on its own → that one card fills the height and scrolls internally.
            // "All" (and findings-only / logs-only) → a plain BLOCK scroll column so each card keeps its
            // natural height and the panel scrolls. A flex column would shrink the cards → clipping.
            const singleFill = chartsExclusive || tablesExclusive || filesExclusive || docsExclusive;
            const containerStyle = singleFill
              ? ({ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } as const)
              : ({ flex: 1, minHeight: 0, overflowY: "auto" } as const);
            const fillWrap = { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } as const;

            return (
              <Box p="md" style={containerStyle}>
                {/* DOCS — per-research working documents */}
                {showDocs && researchId && (
                  <Box style={docsExclusive ? fillWrap : { marginBottom: "var(--mantine-spacing-md)" }}>
                    <DocsBrowser
                      researchId={researchId}
                      documents={documents ?? []}
                      fill={docsExclusive}
                      onRefresh={onRefreshDocs}
                    />
                  </Box>
                )}

                {/* CHARTS — real figures the agent saved to the workspace */}
                {showChart && researchId && (
                  <Box style={chartsExclusive ? fillWrap : { marginBottom: "var(--mantine-spacing-md)" }}>
                    <WorkspaceOutputs researchId={researchId} show={["chart"]} fill={chartsExclusive} refreshKey={outputsRefresh} />
                  </Box>
                )}

                {/* FINDINGS */}
                {showFindings && (findings?.length ?? 0) > 0 && (
                  <Box mb="md">
                    <BrowserShell title="Extracted findings">
                      <List spacing="xs" size="sm" p="sm" center listStyleType="none">
                        {findings!.map((f) => (
                          <List.Item key={f.id} icon={<FindingIcon kind={f.kind} />}>
                            {f.text}
                          </List.Item>
                        ))}
                      </List>
                    </BrowserShell>
                  </Box>
                )}

                {/* TABLES — real csv/parquet data files in the workspace */}
                {showTable && researchId && (
                  <Box style={tablesExclusive ? fillWrap : { marginBottom: "var(--mantine-spacing-md)" }}>
                    <WorkspaceOutputs researchId={researchId} show={["table"]} fill={tablesExclusive} refreshKey={outputsRefresh} />
                  </Box>
                )}

                {/* LOGS */}
                {showLogs && (logLines?.length ?? 0) > 0 && (
                  <Box mb="md">
                    <BrowserShell title="Run log">
                      <Code block ff="monospace" p="sm" style={{ background: "transparent", fontSize: 11, lineHeight: 1.85, color: "#6b6864" }}>
                        {logLines!.map((line) => (
                          <div key={line.t}>
                            <Text component="span" c="dimmed" inherit>
                              {line.t}
                            </Text>{" "}
                            {line.msg}
                          </div>
                        ))}
                      </Code>
                    </BrowserShell>
                  </Box>
                )}

                {/* FILES — everything in the compute workspace */}
                {showFiles && researchId && (
                  <Box style={filesExclusive ? fillWrap : undefined}>
                    <WorkspaceOutputs
                      researchId={researchId}
                      show={filterValue === "all" ? ["file"] : ["chart", "table", "file"]}
                      fill={filesExclusive}
                      refreshKey={outputsRefresh}
                    />
                  </Box>
                )}
              </Box>
            );
          })()}
        </aside>
      </div>
    </>
  );
}
