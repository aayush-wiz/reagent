/**
 * AgentMessage — the streaming "thinking + tool calls" chat view for the
 * research agent. A faithful port of worklone/orpex's AgentThread/AgentMessage:
 * an assistant turn is parsed from the AI-SDK message `parts` (in stream order)
 * into ordered blocks — spoken TEXT (markdown) and WORK groups (the collapsible
 * "Worked for Ns" timeline of reasoning + tool steps, each expandable to
 * Input/Result). Styling lives in src/index.css (.work-* classes).
 */
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StreamPart } from "../../lib/agentStream";

export interface ChatMsg {
  id?: string;
  role: "user" | "ai";
  parts: StreamPart[];
  /** Papers attached to this (user) turn — rendered as mini badges under the bubble. */
  papers?: { title: string; year: string }[];
}

const ChevronDown = ({ size = 13, color = "#9a968f", sw = 1.8 }: { size?: number; color?: string; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// ── block model ──────────────────────────────────────────────────────────
type ToolState = "running" | "done" | "error";
type WorkStep =
  | { type: "reasoning"; text: string }
  | { type: "tool"; name: string; state: ToolState; args?: unknown; result?: unknown };
type Block = { type: "text"; text: string } | { type: "work"; steps: WorkStep[]; tsStart?: number; tsEnd?: number };

function toolStateOf(state: unknown): ToolState {
  if (state === "output-available") return "done";
  if (state === "output-error") return "error";
  return "running";
}

function partsToBlocks(parts: readonly unknown[]): Block[] {
  const blocks: Block[] = [];
  const last = () => blocks[blocks.length - 1];
  const work = () => {
    const b = last();
    if (b && b.type === "work") return b;
    const nb: Block = { type: "work", steps: [] };
    blocks.push(nb);
    return nb;
  };

  for (const raw of parts) {
    const p = raw as { type?: string; text?: string; toolName?: string; state?: unknown; input?: unknown; output?: unknown; _ts?: number; _tsEnd?: number };
    const type = p.type ?? "";
    // Real wall-clock stamps (added by the worker) → real "Worked for Ns".
    const mark = (w: Extract<Block, { type: "work" }>) => {
      if (typeof p._ts === "number") w.tsStart = w.tsStart === undefined ? p._ts : Math.min(w.tsStart, p._ts);
      const end = typeof p._tsEnd === "number" ? p._tsEnd : typeof p._ts === "number" ? p._ts : undefined;
      if (end !== undefined) w.tsEnd = w.tsEnd === undefined ? end : Math.max(w.tsEnd, end);
    };
    if (type === "text") {
      if (!p.text) continue;
      const b = last();
      if (b && b.type === "text") b.text += p.text;
      else blocks.push({ type: "text", text: p.text });
    } else if (type === "reasoning") {
      if (!p.text) continue;
      const w = work();
      mark(w);
      const s = w.steps[w.steps.length - 1];
      if (s && s.type === "reasoning") s.text += p.text;
      else w.steps.push({ type: "reasoning", text: p.text });
    } else if (type.startsWith("tool-") || type === "dynamic-tool") {
      const name = type === "dynamic-tool" ? p.toolName ?? "tool" : type.slice(5);
      const w = work();
      mark(w);
      w.steps.push({ type: "tool", name, state: toolStateOf(p.state), args: p.input, result: p.output });
    }
  }
  return blocks;
}

function messageText(m: ChatMsg): string {
  return m.parts
    .filter((p): p is StreamPart & { text: string } => p.type === "text" && !!(p as { text?: string }).text)
    .map((p) => p.text)
    .join("");
}

// Friendly, arg-aware labels for Reagent's research tools.
export function toolLabel(name: string, args?: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (v == null ? "" : String(v));
  switch (name) {
    case "search_papers":
      return a.query ? `Searching papers: “${s(a.query)}”` : "Searching the literature";
    case "get_paper":
      return "Reading a paper";
    case "list_library":
      return "Checking the paper library";
    case "import_papers":
      return "Adding papers to the library";
    case "add_finding":
      return "Recording a finding";
    case "list_docs":
      return "Listing research documents";
    case "read_doc":
      return a.name ? `Reading ${s(a.name)}` : "Reading a document";
    case "write_doc":
      return a.name ? `Writing ${s(a.name)}` : "Writing a document";
    case "append_doc":
      return a.name ? `Updating ${s(a.name)}` : "Updating a document";
    case "skill":
      return a.name ? `Loading skill: ${s(a.name)}` : a.category ? `Browsing ${s(a.category)} skills` : "Loading a skill";
    case "task":
      return a.subagent_type ? `Delegating to ${s(a.subagent_type)}` : "Spawning a subagent";
    case "science_search":
      return a.db ? `Searching ${s(a.db)}${a.query ? `: “${s(a.query)}”` : ""}` : "Searching a database";
    case "science_list_dbs":
      return "Listing scientific databases";
    case "webfetch":
      return a.url ? `Fetching ${s(a.url).slice(0, 50)}` : "Fetching a URL";
    case "read_file":
      return a.path ? `Reading ${s(a.path)}` : "Reading a file";
    case "write_file":
      return a.path ? `Writing ${s(a.path)}` : "Writing a file";
    case "edit_file":
      return a.path ? `Editing ${s(a.path)}` : "Editing a file";
    case "list_files":
      return "Listing workspace files";
    case "glob_files":
      return a.pattern ? `Finding ${s(a.pattern)}` : "Finding files";
    case "grep_files":
      return a.pattern ? `Searching files for /${s(a.pattern)}/` : "Searching files";
    case "bash":
      return a.command ? `Running: ${s(a.command).slice(0, 60)}` : "Running a command";
    case "run_python":
      return "Running Python";
    case "pubchem_lookup":
    case "uniprot_lookup":
    case "pdb_lookup":
    case "ensembl_lookup":
    case "chembl_search":
      return `Querying ${name.split("_")[0]}`;
    default: {
      const parts = name.split("_");
      return parts.length > 1 ? parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") : name;
    }
  }
}

function pretty(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** Guards react-markdown from crashing on a partial markdown chunk MID-STREAM. */
class MarkdownBoundary extends React.Component<{ text: string; children: React.ReactNode }, { failed: boolean }> {
  constructor(props: { text: string; children: React.ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { text: string }) {
    if (prev.text !== this.props.text && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) return <div style={{ whiteSpace: "pre-wrap" }}>{this.props.text}</div>;
    return this.props.children;
  }
}

function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={"agent-md" + (className ? " " + className : "")}>
      <MarkdownBoundary text={text}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </MarkdownBoundary>
    </div>
  );
}

function WorkToolStep({ step }: { step: Extract<WorkStep, { type: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const hasDetail = step.args !== undefined || step.result !== undefined;
  return (
    <div className={"work-step is-tool " + step.state}>
      <span className="work-dot" />
      <button className={"work-tool" + (hasDetail ? "" : " plain")} onClick={() => hasDetail && setOpen((o) => !o)}>
        <span className="work-tool-name">{toolLabel(step.name, step.args)}</span>
        {hasDetail && (
          <span className={"work-tool-chev" + (open ? " open" : "")}>
            <ChevronDown size={11} />
          </span>
        )}
      </button>
      {open && hasDetail && (
        <div className="work-tool-detail">
          {step.args !== undefined && (
            <div className="work-detail-block">
              <div className="work-detail-label">Input</div>
              <pre>{pretty(step.args)}</pre>
            </div>
          )}
          {step.result !== undefined && (
            <div className="work-detail-block">
              <div className="work-detail-label">Result</div>
              <pre>{pretty(step.result)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function lastLine(text: string): string {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const l = lines[lines.length - 1] || "";
  return l.replace(/[*_`#>]/g, "").replace(/[….]+\s*$/, "").slice(0, 90);
}

function fmtDur(totalSecs: number): string {
  const s = Math.max(1, Math.round(totalSecs));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function WorkGroup({ steps, streaming, liveLabel, tsStart, tsEnd }: { steps: WorkStep[]; streaming: boolean; liveLabel?: string; tsStart?: number; tsEnd?: number }) {
  const [open, setOpen] = useState(false);
  const startRef = useRef(Date.now());
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    if (!streaming && secs === null) setSecs(Math.max(1, Math.round((Date.now() - startRef.current) / 1000)));
  }, [streaming, secs]);

  const expanded = open;
  const lastTool = [...steps].reverse().find((s): s is Extract<WorkStep, { type: "tool" }> => s.type === "tool");
  // Prefer REAL wall-clock duration from the parts' worker timestamps; fall back
  // to mount-measured time only while live; legacy turns (no stamps) say "Worked".
  const realSecs = tsStart !== undefined && tsEnd !== undefined && tsEnd >= tsStart ? (tsEnd - tsStart) / 1000 : null;
  const doneLabel = realSecs !== null ? `Worked for ${fmtDur(realSecs)}` : secs !== null && secs > 1 ? `Worked for ${secs}s` : "Worked";
  const label = streaming ? liveLabel || (lastTool && toolLabel(lastTool.name, lastTool.args)) || "Working" : doneLabel;
  return (
    <div className={"work-group" + (expanded ? " open" : "")}>
      <button className="work-head" onClick={() => setOpen((o) => !o)}>
        <span className={"work-label" + (streaming ? " shimmer" : "")}>{label}</span>
        <span className={"work-chev" + (expanded ? " open" : "")}>
          <ChevronDown size={13} />
        </span>
      </button>
      {expanded && (
        <div className="work-steps">
          {steps.map((s, i) =>
            s.type === "reasoning" ? (
              <div key={i} className="work-step is-reason">
                <span className="work-dot" />
                <Markdown className="work-reason" text={s.text} />
              </div>
            ) : (
              <WorkToolStep key={i} step={s} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function AgentMessage({ message, streaming }: { message: ChatMsg; streaming: boolean }) {
  if (message.role === "user") {
    return (
      <div className="home-row user">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "80%" }}>
          <div className="home-bubble" style={{ maxWidth: "100%" }}>
            {messageText(message)}
          </div>
          {message.papers && message.papers.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "flex-end", marginTop: 6 }}>
              {message.papers.map((p, i) => (
                <span key={i} className="paper-badge" title={p.title}>
                  <span className="paper-badge-icon">◈</span>
                  {p.title.length > 34 ? p.title.slice(0, 34) + "…" : p.title}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  const blocks = partsToBlocks(message.parts as readonly unknown[]);
  const lastIdx = blocks.length - 1;
  const hasContent = blocks.length > 0;
  const fallback = !blocks.some((b) => b.type === "text") ? messageText(message) : "";
  return (
    <div className="home-row assistant">
      <div className="home-assistant-main">
        {blocks.map((b, i) => {
          if (b.type === "text") {
            const nxt = blocks[i + 1];
            const isLiveStatus = streaming && i + 1 === lastIdx && nxt?.type === "work" && b.text.trim().length <= 140;
            if (isLiveStatus) return null;
            return b.text.trim() ? <Markdown key={i} text={b.text} /> : null;
          }
          const live = streaming && i === lastIdx;
          const prev = blocks[i - 1];
          const prevHidden = prev?.type === "text" && prev.text.trim().length <= 140;
          const liveLabel = live && prevHidden ? lastLine((prev as { text: string }).text) : undefined;
          return <WorkGroup key={i} steps={b.steps} streaming={live} liveLabel={liveLabel} />;
        })}
        {fallback.trim() && <Markdown text={fallback} />}
        {streaming && !hasContent && (
          <span className="typing">
            <i />
            <i />
            <i />
          </span>
        )}
        {streaming && hasContent && blocks[lastIdx]?.type === "text" && <span className="stream-caret" />}
      </div>
    </div>
  );
}
