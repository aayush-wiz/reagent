/**
 * src/pages/WelcomeGate.tsx — the new "/" experience.
 *
 *   Replaces the old LandingPage → /login handoff. The real app (WorkspaceShell)
 *   renders immediately at "/", fully visible (no blur) behind an onboarding +
 *   login modal — just a light scrim for contrast. The modal has a "Next" button
 *   that pages through a short pitch for Reagent, each slide topped with a proper
 *   diagram lifted from the landing page (the "one agent, end to end" architecture
 *   box — inputs on the left, the agent's tool call fanning into MCP Tools / Conda
 *   Sandbox / Python & DS, outputs on the right), plus a standing "Log in" button
 *   that jumps straight to the sign-in step, all inside this one modal. Once auth
 *   succeeds, `user` becomes truthy, the modal disappears, and the already-mounted
 *   app underneath becomes the page.
 *
 *   WorkspaceShell is keyed on the user id so the moment login succeeds it remounts
 *   fresh (its effects re-fetch with the now-authenticated session instead of
 *   showing whatever empty/401'd state it rendered while logged out).
 *
 *   LandingPage.tsx and AuthPage.tsx are left in place, just no longer routed to
 *   (see the commented-out routes in App.tsx) — nothing was deleted.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthProvider";
import { apiCheckEmail, googleLoginPopup } from "../lib/auth";
import WorkspaceShell from "./WorkspaceShell";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---- small line-art icons, same glyphs as the landing page's architecture + capability sections ----
const IconPapers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);
const IconData = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <ellipse cx="12" cy="6" rx="7" ry="3" />
    <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
    <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </svg>
);
const IconProblem = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
    <path d="M9.2 9a2 2 0 0 1 3.6 1c0 1.3-1.8 1.5-1.8 2.6" />
    <line x1="11" y1="14.6" x2="11" y2="14.7" />
  </svg>
);
const IconHypotheses = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
  </svg>
);
const IconAnalysis = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </svg>
);
const IconReport = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <polyline points="9 15 11 17 15 12" />
  </svg>
);
const IconMcp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14.5 6.5a3.5 3.5 0 0 1-4.6 4.6L4 17l3 3 5.9-5.9a3.5 3.5 0 0 1 4.6-4.6l-2 2-1.8-.4-.4-1.8z" />
  </svg>
);
const IconSandbox = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="M3 7l9 5 9-5" />
    <line x1="12" y1="12" x2="12" y2="22" />
  </svg>
);
const IconPython = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="8 8 4 12 8 16" />
    <polyline points="16 8 20 12 16 16" />
    <line x1="13" y1="6" x2="11" y2="18" />
  </svg>
);
const IconChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4v-4a2 2 0 0 1-2-2z" />
  </svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="8" />
    <polyline points="8.5 12.5 11 15 15.5 9" />
  </svg>
);
const IconSkill = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" opacity="0.55" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" opacity="0.55" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" opacity="0.3" />
  </svg>
);
const IconAgent = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
  </svg>
);
const IconTasks = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="4" height="4" rx="1" />
    <rect x="3" y="10" width="4" height="4" rx="1" />
    <rect x="3" y="16" width="4" height="4" rx="1" />
    <line x1="10" y1="6" x2="20" y2="6" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <line x1="10" y1="18" x2="20" y2="18" />
  </svg>
);
const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
  </svg>
);

type FlowItem = { label: string; icon: ReactNode; hi?: boolean };

// ---- shared flow diagram: the landing page's "one agent, end to end" ----
// ---- architecture box, redrawn at modal scale for any inputs/center/outputs. ----
const FlowDiagram = ({ left, right, centerItems, toolcallLabel }: { left: FlowItem[]; right: FlowItem[]; centerItems: FlowItem[]; toolcallLabel: string }) => (
  <div className="wg-arch">
    <svg className="wg-arch-lines" viewBox="0 0 820 220" width="820" height="220" aria-hidden>
      <g fill="none" stroke="#1c1b19" strokeWidth="1.6" strokeLinecap="round" opacity="0.5">
        {/* left inputs converge on the agent card's left edge (x=236) */}
        <path d="M168 30 H196 Q216 30 216 50 V90 Q216 106 236 106" />
        <path d="M168 104 H236" />
        <path d="M168 178 H196 Q216 178 216 158 V122 Q216 106 236 106" />
        {/* agent card's right edge (x=584) fans out to the right outputs, stopping exactly at their icons (x=652) */}
        <path d="M584 106 H606 Q626 106 626 86 V50 Q626 30 652 30" />
        <path d="M584 106 H652" />
        <path d="M584 106 H606 Q626 106 626 126 V158 Q626 178 652 178" />
      </g>
    </svg>

    {left.map((it, i) => (
      <div key={it.label} className="wg-arch-io wg-arch-io-l" style={{ top: i * 74 + 8 }}>
        <span>{it.label}</span>
        <div className="wg-arch-icon">{it.icon}</div>
      </div>
    ))}

    <div className="wg-arch-agent">
      <div className="wg-arch-pill">
        <span>reagent</span>
        <i />
      </div>
      <div className="wg-arch-toolcall">{toolcallLabel}</div>
      <div className="wg-arch-tools">
        {centerItems.map((it) => (
          <div key={it.label} className={`wg-arch-tool${it.hi ? " wg-arch-tool-hi" : ""}`}>
            {it.icon}
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>

    {right.map((it, i) => (
      <div key={it.label} className="wg-arch-io wg-arch-io-r" style={{ top: i * 74 + 8 }}>
        <div className="wg-arch-icon">{it.icon}</div>
        <span>{it.label}</span>
      </div>
    ))}
  </div>
);

// ---- diagram 2: the research loop — same six steps as reagent-docs/public/research-loop-diagram.png ----
// ---- (scope → search → hypotheses → rank → run & verify → update), redrawn as a plain ----
// ---- horizontal step chain with plain flexbox — no manual coordinate math to get wrong. ----
const LOOP_NODES = [
  { label: "Scope the question" },
  { label: "Search & review papers" },
  { label: "Generate rival hypotheses" },
  { label: "Rank — tournament" },
  { label: "Run & verify" },
  { label: "Update & evolve" },
];
const LoopArrow = () => (
  <svg className="wg-loop-arrow" width="22" height="14" viewBox="0 0 22 14" aria-hidden>
    <line x1="0" y1="7" x2="14" y2="7" stroke="#1c1b19" strokeWidth="1.8" opacity="0.5" />
    <path d="M9 2 L16 7 L9 12" fill="none" stroke="#1c1b19" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
  </svg>
);
const ResearchLoopDiagram = () => (
  <div className="wg-loop">
    {LOOP_NODES.map((n, i) => (
      <div key={n.label} className="wg-loop-step">
        <div className="wg-loop-node">
          <span className="wg-loop-num">{i + 1}</span>
          {n.label}
        </div>
        {i < LOOP_NODES.length - 1 && <LoopArrow />}
      </div>
    ))}
  </div>
);

// ---- diagram 3: a pipeline, not a flowchart — skills stack into one agent, ----
// ---- and that single agent fans out to several independent runs. ----
const ComposeDiagram = ({ stack, runs }: { stack: { icon: ReactNode; opacity: number }[]; runs: string[] }) => (
  <div className="wg-compose">
    <div className="wg-compose-block">
      <div className="wg-compose-stack">
        {stack.map((c, i) => (
          <div key={i} className="wg-compose-chip" style={{ top: (stack.length - 1 - i) * 9, left: (stack.length - 1 - i) * 9, opacity: c.opacity }}>
            {c.icon}
          </div>
        ))}
      </div>
      <span className="wg-compose-caption">Skills &amp; tools</span>
    </div>

    <svg className="wg-compose-arrow" width="56" height="20" viewBox="0 0 56 20" aria-hidden>
      <line x1="0" y1="10" x2="44" y2="10" stroke="#1c1b19" strokeWidth="1.8" opacity="0.45" />
      <path d="M38 3 L48 10 L38 17" fill="none" stroke="#1c1b19" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
    </svg>

    <div className="wg-compose-block">
      <div className="wg-compose-agent">
        <div className="wg-arch-pill">
          <span>reagent</span>
          <i />
        </div>
        <div className="wg-compose-agent-body">
          <IconAgent />
          <span>Custom Agent</span>
        </div>
      </div>
    </div>

    <svg className="wg-compose-arrow" width="56" height="20" viewBox="0 0 56 20" aria-hidden>
      <line x1="0" y1="10" x2="44" y2="10" stroke="#1c1b19" strokeWidth="1.8" opacity="0.45" />
      <path d="M38 3 L48 10 L38 17" fill="none" stroke="#1c1b19" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
    </svg>

    <div className="wg-compose-block">
      <div className="wg-compose-runs">
        {runs.map((r) => (
          <div key={r} className="wg-compose-run">
            <IconUser />
            <span>{r}</span>
          </div>
        ))}
      </div>
      <span className="wg-compose-caption">Reused across runs</span>
    </div>
  </div>
);

// ---- three of the landing page's own real reports (public/landing/reports) — actual PDFs ----
// ---- Reagent wrote end to end, not mockups. Same card recipe as the landing's .reagent-book ----
// ---- (kicker, title, rule, cover thumbnail, footer), scaled down for the modal body — and ----
// ---- `download` so a click saves the file instead of just opening a viewer tab. ----
const REPORTS = [
  { file: "crispr-gene-drive-governance", kicker: "Policy Brief · Biosecurity", title: "CRISPR Gene-Drive Governance", label: "REPORT I", pages: "6 pages" },
  { file: "llm-employment-paradox", kicker: "Analysis · Economics of AI", title: "The LLM Employment Paradox", label: "REPORT II", pages: "7 pages" },
  { file: "strait-of-hormuz-blockade", kicker: "Analysis · Geopolitics", title: "Strait of Hormuz Blockade", label: "REPORT III", pages: "20 pages" },
];
const ReportCards = () => (
  <div className="wg-report-grid">
    {REPORTS.map((r) => (
      <a key={r.file} className="wg-report-card" href={`/landing/reports/${r.file}.pdf`} download>
        <div className="wg-report-card-inner">
          <div className="wg-report-kicker">{r.kicker}</div>
          <div className="wg-report-title">{r.title}</div>
          <div className="wg-report-rule" />
          <div className="wg-report-label">{r.label}</div>
          <div className="wg-report-cover">
            <img src={`/landing/reports/covers/${r.file}.png`} alt={r.title} />
          </div>
          <div className="wg-report-foot">
            <span>Reagent Research</span>
            <span>{r.pages} · PDF</span>
          </div>
        </div>
      </a>
    ))}
  </div>
);

const SLIDES: { eyebrow: string; caption: string; visual: (() => ReactNode) | null; tag: string; title: string; body: string; points: string[]; reports?: boolean }[] = [
  {
    eyebrow: "ARCHITECTURE",
    caption: "inputs · reasoning · outputs",
    visual: () => (
      <FlowDiagram
        toolcallLabel="TOOL CALL"
        left={[
          { label: "Papers", icon: <IconPapers /> },
          { label: "Data", icon: <IconData /> },
          { label: "Problem", icon: <IconProblem /> },
        ]}
        centerItems={[
          { label: "MCP Tools", icon: <IconMcp /> },
          { label: "Conda Sandbox", icon: <IconSandbox />, hi: true },
          { label: "Python & DS", icon: <IconPython /> },
        ]}
        right={[
          { label: "Hypotheses", icon: <IconHypotheses /> },
          { label: "Analysis", icon: <IconAnalysis /> },
          { label: "Report", icon: <IconReport /> },
        ]}
      />
    ),
    tag: "HOW IT WORKS",
    title: "One agent, end to end",
    body: "Papers, data, and your problem statement go in. Reagent reasons over them, calls out to MCP tools and a sandboxed Python environment to actually run the work, and comes back with a cited answer.",
    points: ["Every tool call happens in an isolated sandbox", "Analysis is real code, not a guess", "Hypotheses, results, and the report all trace back to it"],
  },
  {
    eyebrow: "REAL REPORTS",
    caption: "written end to end, from one question",
    visual: null,
    tag: "READ WHAT IT WROTE",
    title: "Real reports, not a demo",
    body: "Three actual reports Reagent researched, reasoned through, and wrote end to end — a biosecurity policy brief, the economics of AI, and a geopolitical analysis. Click one to download it.",
    points: [],
    reports: true,
  },
  {
    eyebrow: "THE RESEARCH LOOP",
    caption: "loop until evidence decides",
    visual: () => <ResearchLoopDiagram />,
    tag: "THE LOOP",
    title: "It doesn't stop at one answer",
    body: "Reagent scopes the question, generates rival hypotheses, ranks them in a tournament, then designs and runs the one experiment that would prove a hypothesis wrong — updating and looping back until the evidence actually decides.",
    points: ["Competing hypotheses are ranked, not assumed", "Every round runs a real experiment to discriminate them", "It loops until the evidence ends it, not a step count"],
  },
  {
    eyebrow: "SPECIALISTS",
    caption: "one lead, several specialists",
    visual: () => (
      <ComposeDiagram
        stack={[
          { icon: <IconSkill />, opacity: 1 },
          { icon: <IconMcp />, opacity: 0.7 },
          { icon: <IconPapers />, opacity: 0.4 },
        ]}
        runs={["Literature review", "Critique", "Write-up"]}
      />
    ),
    tag: "HOW IT RESEARCHES",
    title: "A lead agent, backed by a specialist team",
    body: "The lead agent pulls from a library of skill packs and hands work off to focused specialists — one reviews the literature, one critiques the analysis, one writes it up — then combines their work into a single answer.",
    points: ["A large catalog of skill packs, loaded only when needed", "Literature review, critique, and write-up run as separate passes", "The lead agent combines everything into the final report"],
  },
];

const CSS = `
.wg-root { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
.wg-bg { height: 100%; width: 100%; pointer-events: none; user-select: none; }
.wg-backdrop { position: fixed; inset: 0; background: rgba(17,16,15,0.16); display: flex; padding: 24px; z-index: 50; font-family: 'Geist Pixel', ui-monospace, monospace; overflow: hidden; }
.wg-card { width: 100%; max-width: 1100px; height: min(640px, calc(100vh - 48px)); background: #ffffff; border: 1.5px solid rgba(28,27,25,0.12); box-shadow: 0 24px 60px rgba(0,0,0,0.4); display: flex; flex-direction: row; align-items: stretch; margin: auto; overflow: hidden; }
.wg-card-video { flex: 0 0 30%; position: relative; background: #000; }
.wg-card-video video { width: 100%; height: 100%; object-fit: cover; display: block; }
.wg-card-content { flex: 1 1 70%; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.wg-visual-wrap { padding: 22px 26px 0; flex: none; }
.wg-visual { border: 1.5px solid rgba(28,27,25,0.3); border-radius: 22px; background: #fdfcfa; padding: 20px 22px; display: flex; flex-direction: column; height: 220px; overflow: hidden; }
.wg-visual-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.wg-visual-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; color: #1c1b19; opacity: 0.65; }
.wg-visual-caption { font-size: 11.5px; color: #1c1b19; opacity: 0.5; }
.wg-visual-stage { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.wg-arch { position: relative; width: 820px; height: 220px; flex: none; transform: scale(0.7); transform-origin: center; }
.wg-arch-lines { position: absolute; inset: 0; width: 100%; height: 100%; }
.wg-arch-io { position: absolute; display: flex; align-items: center; gap: 9px; width: 168px; }
.wg-arch-io-l { left: 0; justify-content: flex-end; text-align: right; }
.wg-arch-io-r { right: 0; justify-content: flex-start; }
.wg-arch-io span { font-size: 13px; font-weight: 500; color: #1c1b19; }
.wg-arch-icon { width: 38px; height: 38px; border: 1.5px solid rgba(28,27,25,0.35); border-radius: 11px; display: flex; align-items: center; justify-content: center; flex: none; background: #fff; color: #1c1b19; }
.wg-arch-agent { position: absolute; left: 236px; top: 0; width: 348px; height: 220px; border: 1.8px solid #1c1b19; border-radius: 18px; background: #ffffff; padding: 14px 16px 14px; display: flex; flex-direction: column; box-sizing: border-box; }
.wg-arch-pill { border: 1.5px solid rgba(28,27,25,0.22); border-radius: 12px; padding: 11px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(28,27,25,0.06); }
.wg-arch-pill span { font-weight: 700; font-size: 16px; letter-spacing: -0.02em; color: #1c1b19; }
.wg-arch-pill i { width: 7px; height: 7px; border-radius: 50%; background: #1c1b19; display: inline-block; font-style: normal; }
.wg-arch-toolcall { text-align: center; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; color: #1c1b19; opacity: 0.6; margin-top: 12px; }
.wg-arch-tools { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; flex: 1; }
.wg-arch-tool { border: 1.5px solid rgba(28,27,25,0.2); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #1c1b19; padding: 8px 5px; text-align: center; }
.wg-arch-tool span { font-size: 11px; font-weight: 500; line-height: 1.25; }
.wg-arch-tool-hi { border-color: #1c1b19; background: rgba(28,27,25,0.05); }
.wg-loop { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 0; width: 100%; }
.wg-loop-step { display: flex; align-items: center; }
.wg-loop-node { width: 102px; min-height: 74px; text-align: center; font-size: 11px; font-weight: 500; color: #1c1b19; line-height: 1.25; border: 1.5px solid rgba(28,27,25,0.35); border-radius: 12px; background: #fff; padding: 9px 7px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.wg-loop-num { display: block; font-size: 9.5px; font-weight: 700; color: #1c1b19; opacity: 0.4; margin-bottom: 3px; }
.wg-loop-arrow { flex: none; margin: 0 2px; }
.wg-compose { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; }
.wg-compose-block { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.wg-compose-caption { font-size: 11px; font-weight: 500; color: #1c1b19; opacity: 0.55; text-align: center; white-space: nowrap; }
.wg-compose-stack { position: relative; width: 74px; height: 74px; }
.wg-compose-chip { position: absolute; width: 52px; height: 52px; border: 1.5px solid rgba(28,27,25,0.3); border-radius: 13px; background: #fff; display: flex; align-items: center; justify-content: center; color: #1c1b19; box-shadow: 0 2px 6px rgba(28,27,25,0.05); }
.wg-compose-arrow { flex: none; opacity: 0.9; }
.wg-compose-agent { border: 1.8px solid #1c1b19; border-radius: 16px; background: #ffffff; padding: 12px 20px 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 158px; }
.wg-compose-agent-body { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #1c1b19; font-size: 12.5px; font-weight: 600; padding: 4px 0 2px; }
.wg-compose-runs { display: flex; flex-direction: column; gap: 8px; }
.wg-compose-run { display: flex; align-items: center; gap: 8px; border: 1.5px solid rgba(28,27,25,0.25); border-radius: 10px; padding: 7px 12px; font-size: 12px; font-weight: 500; color: #1c1b19; background: #fff; white-space: nowrap; }
.wg-report-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 2px 0 20px; }
.wg-report-card { display: block; text-decoration: none; color: #1c1b19; }
.wg-report-card-inner { background: #ffffff; border: 1.5px solid rgba(28,27,25,0.14); padding: 13px 13px 11px; display: flex; flex-direction: column; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.wg-report-card:hover .wg-report-card-inner { transform: translateY(-4px); box-shadow: 0 16px 30px rgba(28,27,25,0.16); border-color: rgba(28,27,25,0.3); }
.wg-report-kicker { font-size: 8.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #9a958c; margin-bottom: 8px; }
.wg-report-title { font-size: 12px; font-weight: 600; line-height: 1.28; letter-spacing: -0.01em; color: #1c1b19; min-height: 31px; }
.wg-report-rule { height: 1.5px; background: rgba(28,27,25,0.1); margin: 10px 0 8px; }
.wg-report-label { font-size: 9px; font-weight: 600; letter-spacing: 0.1em; color: #b0aaa0; margin-bottom: 8px; }
.wg-report-cover { position: relative; overflow: hidden; border: 1px solid rgba(28,27,25,0.08); background: #f4f2ee; aspect-ratio: 4 / 3; border-radius: 2px; }
.wg-report-cover img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
.wg-report-cover::after { content: "Download \\2193"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(28,27,25,0.82); color: #ffffff; opacity: 0; transition: opacity .18s ease; font-size: 12px; font-weight: 600; letter-spacing: -0.01em; }
.wg-report-card:hover .wg-report-cover::after { opacity: 1; }
.wg-report-foot { display: flex; justify-content: space-between; margin-top: 9px; font-size: 9.5px; letter-spacing: 0.03em; color: #b0aaa0; }
@media (max-width: 640px) { .wg-report-grid { grid-template-columns: 1fr; } }
.wg-panel { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.wg-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 26px 0; flex: none; }
.wg-head-center { justify-content: center; }
.wg-brand { display: inline-flex; align-items: center; gap: 9px; }
.wg-brand span { font-size: 17px; letter-spacing: -0.015em; color: #1c1b19; }
.wg-login-link { background: none; border: none; font-family: inherit; font-size: 13px; color: rgba(28,27,25,0.6); cursor: pointer; text-decoration: underline; padding: 4px; }
.wg-body { padding: 16px 26px 26px; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; }
.wg-body-auth { justify-content: center; }
.wg-tag { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; color: #ffffff; background: #1c1b19; padding: 3px 8px; margin-bottom: 12px; }
.wg-title { font-size: 22px; line-height: 1.2; letter-spacing: -0.02em; color: #1c1b19; margin: 0 0 8px; }
.wg-copy { font-size: 13.5px; line-height: 1.55; color: rgba(28,27,25,0.68); margin: 0 0 14px; max-width: 640px; }
.wg-points { list-style: none; margin: 0 0 18px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 22px; }
.wg-points li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #33302b; line-height: 1.4; }
.wg-points li::before { content: "—"; color: rgba(28,27,25,0.35); flex-shrink: 0; }
.wg-dots { display: flex; gap: 6px; align-items: center; }
.wg-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(28,27,25,0.18); border: none; padding: 0; cursor: pointer; }
.wg-dot.on { background: #1c1b19; }
.wg-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: none; margin-top: auto; padding-top: 14px; }
.wg-next { background: #1c1b19; color: #fff; border: 1.5px solid #1c1b19; font-family: inherit; font-size: 14px; padding: 12px 22px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.wg-next:hover { background: #000; }
.wg-prev { background: #fff; color: #1c1b19; border: 1.5px solid rgba(28,27,25,0.25); font-family: inherit; font-size: 14px; padding: 12px 18px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.wg-prev:hover:not(:disabled) { border-color: rgba(28,27,25,0.5); background: rgba(28,27,25,0.03); }
.wg-prev:disabled { opacity: 0; pointer-events: none; }
.wg-auth-wrap { width: 100%; max-width: 520px; margin: 0 auto; text-align: center; }
.wg-auth-cols { display: flex; justify-content: center; gap: 34px; }
.wg-auth-form { flex: 1; max-width: 474px; }
.wg-email-chip { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: rgba(28,27,25,0.55); margin-bottom: 14px; }
.wg-email-chip button { background: none; border: none; color: #1c1b19; font-size: 12.5px; cursor: pointer; font-family: inherit; text-decoration: underline; padding: 0; }
.wg-field { display: block; width: 100%; padding: 13px 16px; margin-bottom: 12px; border: 1.5px solid rgba(28,27,25,0.18); background: #ffffff; color: #1c1b19; font-size: 14px; font-family: inherit; outline: none; transition: border-color .12s; }
.wg-field::placeholder { color: rgba(28,27,25,0.4); }
.wg-field:focus { border-color: #1c1b19; }
.wg-btn { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; padding: 13px 18px; font-size: 14px; font-family: inherit; cursor: pointer; border: 1.5px solid transparent; transition: background .12s, border-color .12s; }
.wg-btn:disabled { opacity: .55; cursor: default; }
.wg-primary { background: #1c1b19; color: #ffffff; border: 1.5px solid #1c1b19; }
.wg-primary:hover:not(:disabled) { background: #000000; }
.wg-oauth { background: #ffffff; color: #1c1b19; border: 1.5px solid rgba(28,27,25,0.18); margin-top: 10px; }
.wg-oauth:hover { background: #f4f2ee; border-color: rgba(28,27,25,0.3); }
.wg-or { display: flex; align-items: center; gap: 12px; margin: 18px 2px 4px; color: rgba(28,27,25,0.45); font-size: 11px; letter-spacing: 0.14em; }
.wg-or::before, .wg-or::after { content: ""; flex: 1; height: 1px; background: rgba(28,27,25,0.14); }
.wg-msg { font-size: 12.5px; padding: 9px 12px; margin-bottom: 12px; line-height: 1.4; }
.wg-msg.err { color: #8a2b1c; background: rgba(179,64,46,0.07); border: 1px solid rgba(179,64,46,0.26); }
.wg-msg.info { color: #33302b; background: rgba(28,27,25,0.05); border: 1px solid rgba(28,27,25,0.16); }
.wg-back { background: none; border: none; font-family: inherit; font-size: 13px; color: rgba(28,27,25,0.55); cursor: pointer; text-decoration: underline; padding: 0; margin-bottom: 16px; }
@media (max-width: 900px) {
  .wg-card { max-width: 560px; height: min(680px, calc(100vh - 24px)); flex-direction: column; }
  .wg-card-video { flex: 0 0 120px; }
  .wg-arch { transform: scale(0.5); }
  .wg-visual { min-height: 170px; }
  .wg-auth-cols { flex-direction: column; gap: 0; }
}
`;

const Mark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c1b19" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
    <path d="M6.453 15h11.094" />
    <path d="M8.5 2h7" />
  </svg>
);
const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

type Mode = "promo" | "auth";

export default function WelcomeGate() {
  const { user, loading, login, signup, applySession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [slide, setSlide] = useState(0);
  const [mode, setMode] = useState<Mode>("promo");

  const [step, setStep] = useState<"email" | "password">("email");
  const [exists, setExists] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const enterAuth = () => {
    setError("");
    setInfo("");
    setMode("auth");
  };

  const onNext = () => {
    if (slide < SLIDES.length - 1) setSlide((s) => s + 1);
    else enterAuth();
  };

  const onPrev = () => {
    if (slide > 0) setSlide((s) => s - 1);
  };

  async function onContinue(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setInfo("");
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const found = await apiCheckEmail(em);
      setExists(found);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (exists) await login(email.trim().toLowerCase(), password);
      else await signup(email.trim().toLowerCase(), password, name.trim());
      if (from) navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function onGoogle() {
    if (googleBusy) return;
    setError("");
    setInfo("");
    setGoogleBusy(true);
    try {
      const googleUser = await googleLoginPopup();
      applySession(googleUser);
      if (from) navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setGoogleBusy(false);
    }
  }

  // Already signed in: just the app, no gate.
  if (!loading && user) return <WorkspaceShell key={user.id} />;

  const s = SLIDES[slide];
  const Visual = s.visual;

  return (
    <div className="wg-root">
      <div className="wg-bg" aria-hidden>
        <WorkspaceShell key="anon" />
      </div>

      {!loading && (
        <div className="wg-backdrop">
          <style>{CSS}</style>
          <div className="wg-card">
            <div className="wg-card-video">
              <video src="/welcome/intro.mp4" autoPlay muted loop playsInline />
            </div>
            <div className="wg-card-content">
            {Visual && (
              <div className="wg-visual-wrap">
                <div className="wg-visual">
                  <div className="wg-visual-head">
                    <span className="wg-visual-eyebrow">{s.eyebrow}</span>
                    <span className="wg-visual-caption">{s.caption}</span>
                  </div>
                  <div className="wg-visual-stage">
                    <Visual />
                  </div>
                </div>
              </div>
            )}

            <div className="wg-panel">
              <div className={`wg-head${mode === "auth" ? " wg-head-center" : ""}`}>
                <span className="wg-brand">
                  <Mark />
                  <span>reagent</span>
                </span>
                {mode === "promo" && (
                  <button className="wg-login-link" type="button" onClick={enterAuth}>
                    Log in
                  </button>
                )}
              </div>

              <div className={`wg-body${mode === "auth" ? " wg-body-auth" : ""}`}>
                {mode === "promo" ? (
                  <>
                    <span className="wg-tag">{s.tag}</span>
                    <h2 className="wg-title">{s.title}</h2>
                    <p className="wg-copy">{s.body}</p>
                    {s.reports ? (
                      <ReportCards />
                    ) : (
                      <ul className="wg-points">
                        {s.points.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    )}
                    <div className="wg-actions">
                      <button className="wg-prev" type="button" onClick={onPrev} disabled={slide === 0}>
                        <span aria-hidden>←</span> Back
                      </button>
                      <div className="wg-dots">
                        {SLIDES.map((_, i) => (
                          <button key={i} className={`wg-dot${i === slide ? " on" : ""}`} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} />
                        ))}
                      </div>
                      <button className="wg-next" type="button" onClick={onNext}>
                        {slide < SLIDES.length - 1 ? "Next" : "Get started"} <span aria-hidden>→</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="wg-auth-wrap">
                    <button className="wg-back" type="button" onClick={() => setMode("promo")}>
                      ← Back
                    </button>
                    <h2 className="wg-title" style={{ marginBottom: 18 }}>
                      Log in or sign up
                    </h2>

                    <div className="wg-auth-cols">
                      <div className="wg-auth-form">
                        {error && <div className="wg-msg err">{error}</div>}
                        {info && <div className="wg-msg info">{info}</div>}

                        {step === "email" ? (
                          <form onSubmit={onContinue}>
                            <input
                              className="wg-field"
                              type="email"
                              autoFocus
                              placeholder="Your email address"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              autoComplete="email"
                            />
                            <button className="wg-btn wg-primary" type="submit" disabled={busy}>
                              {busy ? "Checking…" : "Continue"}
                            </button>
                          </form>
                        ) : (
                          <form onSubmit={onSubmit}>
                            <div className="wg-email-chip">
                              <span>{email}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setStep("email");
                                  setPassword("");
                                  setError("");
                                }}
                              >
                                Change
                              </button>
                            </div>
                            {!exists && (
                              <input
                                className="wg-field"
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                              />
                            )}
                            <input
                              className="wg-field"
                              type="password"
                              autoFocus
                              placeholder={exists ? "Password" : "Create a password (6+ characters)"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              autoComplete={exists ? "current-password" : "new-password"}
                            />
                            <button className="wg-btn wg-primary" type="submit" disabled={busy}>
                              {busy ? "Please wait…" : exists ? "Log in" : "Create account"}
                            </button>
                          </form>
                        )}

                        <div className="wg-or">OR</div>
                        <button className="wg-btn wg-oauth" type="button" onClick={onGoogle} disabled={googleBusy}>
                          <GoogleIcon />
                          {googleBusy ? "Waiting for Google…" : "Continue with Google"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
