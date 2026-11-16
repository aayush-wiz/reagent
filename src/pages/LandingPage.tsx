/**
 * src/pages/LandingPage.tsx — the marketing site at "/".
 *
 *   Converted from a static "Axiom Landing" design mockup (warm cream/serif
 *   look) into real React/TSX — no iframe, no external template runtime.
 *   Every claim here is grounded in the app's actual architecture (same
 *   inputs/tools/outputs as the Architecture diagram, the same real reports
 *   used elsewhere). "/login" (WelcomeGate) is the sign-in/sign-up gate;
 *   this page's CTAs route into the authenticated app, and RequireAuth
 *   bounces logged-out visitors to "/login" from there.
 */
import { useEffect, useRef, Fragment, type ElementType, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "motion/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useAuth } from "../lib/AuthProvider";

gsap.registerPlugin(ScrollTrigger);

const DOCS_URL = "http://localhost:4337";

const Mark = ({ size = 20, color = "#1B1A16" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
    <path d="M6.453 15h11.094" />
    <path d="M8.5 2h7" />
  </svg>
);

/**
 * Word-by-word reveal on scroll-into-view: each word fades/slides/un-blurs in,
 * staggered, with the stagger auto-compressed so long text still finishes
 * within `maxDuration`.
 */
function TextReveal({
  text,
  as: Tag = "span",
  className,
  stagger = 0.055,
  maxDuration = 1.6,
  baseDelay = 0,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  stagger?: number;
  maxDuration?: number;
  baseDelay?: number;
}) {
  const words = text.split(" ");
  const effectiveStagger = words.length * stagger > maxDuration ? maxDuration / words.length : stagger;
  return (
    <Tag className={className}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <motion.span
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: baseDelay + i * effectiveStagger, ease: "easeOut" }}
            style={{ display: "inline-block", willChange: "transform, filter, opacity" }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </Tag>
  );
}

const IconMcp = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14.5 6.5a3.5 3.5 0 0 1-4.6 4.6L4 17l3 3 5.9-5.9a3.5 3.5 0 0 1 4.6-4.6l-2 2-1.8-.4-.4-1.8z" />
  </svg>
);
const IconSandbox = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2 3 7v10l9 5 9-5V7z" />
    <path d="M3 7l9 5 9-5" />
    <line x1="12" y1="12" x2="12" y2="22" />
  </svg>
);
const IconPython = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="8 8 4 12 8 16" />
    <polyline points="16 8 20 12 16 16" />
    <line x1="13" y1="6" x2="11" y2="18" />
  </svg>
);
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="4 13 9 18 20 6" />
  </svg>
);

const IconPapers = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);
const IconData = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <ellipse cx="12" cy="6" rx="7" ry="3" />
    <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
    <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </svg>
);
const IconProblem = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="21" y2="21" />
    <path d="M9.2 9a2 2 0 0 1 3.6 1c0 1.3-1.8 1.5-1.8 2.6" />
    <line x1="11" y1="14.6" x2="11" y2="14.7" />
  </svg>
);
const IconHypotheses = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
  </svg>
);
const IconAnalysis = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </svg>
);
const IconResults = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="6" y1="20" x2="6" y2="12" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="18" y1="20" x2="18" y2="9" />
  </svg>
);
const IconResearch = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 3h6" />
    <path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
    <line x1="8" y1="15" x2="16" y2="15" />
  </svg>
);
const IconReport = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <polyline points="9 15 11 17 15 12" />
  </svg>
);

const ARCH_INPUTS = [
  { label: "Papers", top: 96, icon: <IconPapers /> },
  { label: "Data", top: 286, icon: <IconData /> },
  { label: "Problem", top: 476, icon: <IconProblem /> },
];
const ARCH_OUTPUTS = [
  { label: "Hypotheses", top: 37, icon: <IconHypotheses /> },
  { label: "Analysis", top: 162, icon: <IconAnalysis /> },
  { label: "Results", top: 287, icon: <IconResults /> },
  { label: "Research", top: 412, icon: <IconResearch /> },
  { label: "Report", top: 537, icon: <IconReport /> },
];

/** The "one agent, end to end" architecture diagram — same one used across the app (WelcomeGate, docs). */
function ArchitectureDiagram() {
  const fitRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => {
      const o = fitRef.current;
      const s = stageRef.current;
      if (!o || !s) return;
      const scale = Math.min(1, o.clientWidth / 1400);
      s.style.transform = `scale(${scale})`;
      o.style.height = `${640 * scale}px`;
    };
    fit();
    const timers = [120, 400, 900].map((t) => setTimeout(fit, t));
    const ro = new ResizeObserver(fit);
    if (fitRef.current) ro.observe(fitRef.current);
    window.addEventListener("resize", fit);
    return () => {
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <div className="lp-arch-card gsap-reveal">
      <div ref={fitRef} className="lp-arch-fit">
        <div ref={stageRef} className="lp-arch-stage">
          <svg viewBox="0 0 1400 640" width="1400" height="640" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <g fill="none" stroke="#1B1A16" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
              <path d="M258 129 H408 Q440 129 440 159 V300 Q440 320 470 320" />
              <path d="M258 319 H470" />
              <path d="M258 509 H408 Q440 509 440 479 V340 Q440 320 470 320" />
              <path d="M940 320 H960 Q980 320 980 300 V90 Q980 70 1000 70 H1200" />
              <path d="M940 320 H960 Q980 320 980 300 V215 Q980 195 1000 195 H1200" />
              <path d="M940 320 H1200" />
              <path d="M940 320 H960 Q980 320 980 340 V425 Q980 445 1000 445 H1200" />
              <path d="M940 320 H960 Q980 320 980 340 V550 Q980 570 1000 570 H1200" />
            </g>
            <g fill="#1B1A16">
              <circle className="lp-arch-node" cx="470" cy="320" r="4.5" style={{ animation: "reagentPulse 3s ease-in-out infinite" }} />
              <circle className="lp-arch-node" cx="940" cy="320" r="4.5" style={{ animation: "reagentPulse 3s ease-in-out 0.5s infinite" }} />
            </g>
          </svg>

          {ARCH_INPUTS.map((it) => (
            <div key={it.label} className="lp-arch-io lp-arch-io-l" style={{ top: it.top }}>
              <span>{it.label}</span>
              <div className="lp-arch-icon">{it.icon}</div>
            </div>
          ))}

          <div className="lp-arch-agent">
            <div className="lp-arch-pill">
              <span>reagent</span>
              <i />
            </div>
            <div className="lp-arch-toolcall">TOOL CALL</div>
            <svg viewBox="0 0 342 40" width="100%" height="34" style={{ marginTop: 8, overflow: "visible" }}>
              <g fill="none" stroke="#1B1A16" strokeWidth="1.6" strokeLinecap="round" opacity="0.5">
                <path d="M171 0 V12" />
                <path d="M57 38 V26 Q57 12 77 12 H265 Q285 12 285 26 V38" />
                <path d="M171 12 V38" />
              </g>
            </svg>
            <div className="lp-arch-tools">
              <div className="lp-arch-tool">
                <IconMcp /><span>MCP Tools</span>
              </div>
              <div className="lp-arch-tool lp-arch-tool-hi">
                <IconSandbox /><span>Conda Sandbox</span>
              </div>
              <div className="lp-arch-tool">
                <IconPython /><span>Python &amp; DS</span>
              </div>
            </div>
          </div>

          {ARCH_OUTPUTS.map((it) => (
            <div key={it.label} className="lp-arch-io lp-arch-io-r" style={{ top: it.top }}>
              <div className="lp-arch-icon">{it.icon}</div>
              <span>{it.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const REPORTS = [
  {
    file: "crispr-gene-drive-governance",
    kicker: "Policy Brief · Biosecurity",
    title: "Balancing Ecological Innovation & Biosafety in CRISPR Gene-Drive Governance",
    label: "REPORT I",
    pages: "6 pages",
  },
  {
    file: "llm-employment-paradox",
    kicker: "Analysis · Economics of AI",
    title: "The LLM Employment Paradox: Structural Transformation, Not Mass Layoffs",
    label: "REPORT II",
    pages: "7 pages",
  },
  {
    file: "strait-of-hormuz-blockade",
    kicker: "Analysis · Geopolitics",
    title: "Strait of Hormuz Blockade: Resolution Pathways — A Multi-Dimensional Analysis",
    label: "REPORT III",
    pages: "20 pages",
  },
];

const CONNECT_CARDS = [
  { kicker: "Protocol", title: "Any MCP server", body: "Register a server once — its tools and resources become something every agent run can call." },
  { kicker: "Literature", title: "Papers & prior findings", body: "Full-text search across 42 scientific databases, with every claim traced back to its source." },
  { kicker: "Data", title: "Your datasets", body: "Point it at the data relevant to your question; it reads and reasons over it directly." },
  { kicker: "Execution", title: "A sandboxed Python environment", body: "Real code runs in isolation — statistics, simulations, data pipelines, figures." },
  { kicker: "Tools", title: "Your own scripts & tools", body: "Anything you've already built becomes an instrument the agent can drive over MCP — no rewrites." },
  { kicker: "Memory", title: "Prior runs", body: "Its own past research becomes context it can draw on for the next question." },
];

const RIGOR_PILLARS = [
  { title: "Traceable, not a black box", body: "Every conclusion links back to its sources, the plan that produced it, and the exact code that ran." },
  { title: "Checks its own work", body: "A blind reviewer flags made-up numbers and citation mismatches before you ever see the answer." },
  { title: "You stay in control", body: "Review the plan before it runs, steer it mid-course, and approve what ships." },
  { title: "Runs in the background", body: "Start it and walk away — watch it live, cancel anytime, come back to the finished report." },
];

const CSS = `
.lp-root { background: #ffffff; color: #1B1A16; font-family: 'Google Sans Flex', sans-serif; overflow-x: hidden; min-height: 100vh; }
.lp-root a { color: inherit; text-decoration: none; }
.lp-root ::selection { background: #c2562e; color: #fff; }
.lp-topbar { height: 8px; background: #c2562e; }

.lp-nav { position: sticky; top: 0; z-index: 40; display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 14px 48px; background: rgba(255,255,255,0.92); backdrop-filter: blur(10px); }
.lp-brand { display: flex; align-items: center; gap: 9px; }
.lp-brand span { font-family: 'Google Sans Flex', sans-serif; font-size: 22px; letter-spacing: -0.01em; }
.lp-nav-links { display: flex; align-items: center; gap: 30px; font-family: 'Google Sans Flex', sans-serif; font-size: 16px; color: #4A473C; }
.lp-nav-links a:hover { color: #1B1A16; }
.lp-nav-actions { display: flex; align-items: center; gap: 20px; }
.lp-root a.lp-login-link { font-family: 'Google Sans Flex', sans-serif; font-size: 16px; color: #4A473C; }
.lp-login-link:hover { color: #1B1A16; }
.lp-root a.lp-cta { display: inline-flex; align-items: center; gap: 8px; background: #1B1A16; color: #ffffff; padding: 10px 20px; border-radius: 999px; font-family: 'Google Sans Flex', sans-serif; font-size: 16px; }
.lp-cta:hover { background: #332F26; }

.lp-hero { position: relative; padding: 16px 48px 96px; min-height: 720px; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden; box-sizing: border-box; }
.lp-hero-bg { position: absolute; inset: 0; pointer-events: none; background-image: url('/landing/images/hero-bg-hd.png'); background-size: cover; background-position: center 30%; }
@media (max-width: 760px) { .lp-hero { min-height: 560px; } }
@media (max-width: 760px) { .lp-hero-bg { background-position: 30% 30%; } }
.lp-hero-inner { position: relative; max-width: 700px; margin: 0 auto; margin-top: -60px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.lp-badge { display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(27,26,22,0.2); border-radius: 999px; padding: 6px 14px; font-size: 11.5px; letter-spacing: 0.05em; text-transform: uppercase; color: #5C594C; }
.lp-dot { width: 7px; height: 7px; border-radius: 50%; background: #c2562e; display: inline-block; }
.lp-hero-inner h1 { margin: 0; font-family: 'Google Sans Flex', sans-serif; font-weight: 400; font-size: 46px; line-height: 1.14; letter-spacing: -0.02em; }
.lp-hero-inner > p { margin: 0; max-width: 440px; font-size: 15px; line-height: 1.5; color: #4A473C; }
.lp-hero-ctas { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center; }
.lp-root a.lp-btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #1B1A16; color: #ffffff; padding: 11px 22px; border-radius: 999px; font-family: 'Google Sans Flex', sans-serif; font-size: 15px; }
.lp-btn-primary:hover { background: #332F26; }
.lp-btn-secondary { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #1B1A16; padding: 10px 20px; border-radius: 999px; font-family: 'Google Sans Flex', sans-serif; font-size: 15px; }
.lp-btn-secondary:hover { background: rgba(27,26,22,0.05); }
.lp-btn-outline { display: inline-flex; align-items: center; gap: 10px; border: 1px solid #1B1A16; padding: 12px 24px; border-radius: 999px; font-family: 'Google Sans Flex', sans-serif; font-size: 17px; }
.lp-btn-outline:hover { background: rgba(27,26,22,0.05); }
.lp-hero-meta { margin: -12px 0 0; font-size: 11px; letter-spacing: 0.02em; color: rgba(27,26,22,0.45); }

.lp-lab { padding: 40px 48px 30px; text-align: center; }
.lp-lab-kicker { display: inline-flex; align-items: center; gap: 8px; font-family: 'Google Sans Flex', sans-serif; font-size: 18px; color: #5C594C; margin-bottom: 18px; }
.lp-lab h2 { margin: 0 auto 16px; font-family: 'Google Sans Flex', sans-serif; font-weight: 400; font-size: 46px; line-height: 1.12; letter-spacing: -0.02em; max-width: 760px; }
.lp-lab > .lp-lab-head > p { margin: 0 auto; max-width: 560px; font-size: 18px; line-height: 1.55; color: #4A473C; }
.lp-lab-head .lp-btn-outline { margin-top: 26px; }
.lp-lab-frame { max-width: 1180px; margin: 56px auto 0; padding: 14px; border: 1px solid rgba(27,26,22,0.18); border-radius: 26px; background: #F3F3F1; }
.lp-lab-screen { height: 740px; border-radius: 16px; overflow: hidden; background: #fff; }
.lp-lab-screen iframe { width: 1280px; height: 822px; border: 0; transform: scale(0.9); transform-origin: top left; }
@media (max-width: 900px) { .lp-lab-screen { height: 360px; } .lp-lab-screen iframe { transform: scale(0.469); } }

@keyframes reagentPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.13); } }
.lp-arch-node { transform-box: fill-box; transform-origin: center; }
.lp-arch-section { padding: 100px 48px 40px; max-width: 1180px; margin: 0 auto; }
.lp-arch-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 24px; }
.lp-arch-kicker { font-size: 13px; font-weight: 500; color: #1B1A16; opacity: 0.7; margin-bottom: 12px; }
.lp-arch-head h2 { margin: 0; font-size: 30px; letter-spacing: -0.02em; line-height: 1.1; }
.lp-arch-tag { font-size: 13px; color: #1B1A16; opacity: 0.55; padding-bottom: 8px; }
.lp-arch-card { border: 1.5px solid rgba(27,26,22,0.3); border-radius: 22px; padding: 20px; background: #fff; }
.lp-arch-fit { width: 100%; overflow: hidden; }
.lp-arch-stage { position: relative; width: 1400px; height: 520px; transform-origin: top left; }
.lp-arch-io { position: absolute; display: flex; align-items: center; gap: 16px; width: 178px; }
.lp-arch-io-l { left: 80px; justify-content: flex-end; text-align: right; }
.lp-arch-io-r { left: 1200px; justify-content: flex-start; }
.lp-arch-io span { font-size: 17px; font-weight: 500; color: #1B1A16; }
.lp-arch-icon { width: 60px; height: 60px; border: 1.5px solid rgba(27,26,22,0.4); border-radius: 15px; display: flex; align-items: center; justify-content: center; flex: none; background: #fff; color: #1B1A16; }
.lp-arch-agent { position: absolute; left: 470px; top: 110px; width: 470px; height: 350px; border: 2px solid #1B1A16; border-radius: 22px; background: #fff; padding: 24px 22px 14px; display: flex; flex-direction: column; box-sizing: border-box; }
.lp-arch-pill { border: 1.5px solid rgba(27,26,22,0.22); border-radius: 14px; padding: 18px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 2px 8px rgba(27,26,22,0.06); }
.lp-arch-pill span { font-weight: 600; font-size: 22px; letter-spacing: -0.02em; color: #1B1A16; }
.lp-arch-pill i { width: 8px; height: 8px; border-radius: 50%; background: #1B1A16; display: inline-block; font-style: normal; }
.lp-arch-toolcall { text-align: center; font-size: 12.5px; font-weight: 600; letter-spacing: 0.04em; color: #1B1A16; opacity: 0.65; margin-top: 16px; }
.lp-arch-tools { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 4px; flex: 1; }
.lp-arch-tool { border: 1.5px solid rgba(27,26,22,0.2); border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #1B1A16; padding: 12px 6px; text-align: center; }
.lp-arch-tool span { font-size: 14px; font-weight: 500; line-height: 1.25; }
.lp-arch-tool-hi { border-color: #1B1A16; background: rgba(27,26,22,0.04); }
@media (max-width: 700px) { .lp-arch-section { padding: 60px 24px 20px; } .lp-arch-card { padding: 12px; } }

.lp-showcase { padding: 100px 48px 0; max-width: 1180px; margin: 0 auto; }
.lp-showcase-head { max-width: 640px; margin-bottom: 32px; }
.lp-showcase-head h2 { margin: 0 0 12px; font-size: 30px; letter-spacing: -0.02em; line-height: 1.1; }
.lp-showcase-head p { margin: 0; font-size: 16px; line-height: 1.55; color: #4A473C; }
.lp-showcase-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.lp-showcase-card { grid-column: span 1; background: #F7F6F4; border: 1px solid rgba(27,26,22,0.1); border-radius: 20px; padding: 36px; display: flex; flex-direction: column; gap: 24px; }
.lp-showcase-big { grid-column: span 2; flex-direction: row; align-items: center; gap: 40px; }
.lp-showcase-big .lp-showcase-text { flex: 0 0 300px; }
.lp-showcase-big .lp-showcase-img { flex: 1; min-width: 0; }
.lp-showcase-text h3 { margin: 0 0 10px; font-size: 21px; letter-spacing: -0.01em; line-height: 1.25; }
.lp-showcase-text p { margin: 0; font-size: 14.5px; line-height: 1.55; color: #5C594C; }
.lp-showcase-img { border-radius: 12px; overflow: hidden; border: 1px solid rgba(27,26,22,0.12); background: #fff; box-shadow: 0 12px 30px rgba(27,26,22,0.08); max-height: 340px; }
.lp-showcase-img img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top center; }
@media (max-width: 860px) {
  .lp-showcase-grid { grid-template-columns: 1fr; }
  .lp-showcase-big, .lp-showcase-card { grid-column: span 1; flex-direction: column; }
  .lp-showcase-big .lp-showcase-text { flex: none; }
}

.lp-connect { padding: 130px 48px 0; max-width: 1180px; margin: 0 auto; }
.lp-connect-head { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.lp-connect-head h2 { margin: 0; font-family: 'Google Sans Flex', sans-serif; font-weight: 400; font-size: 48px; letter-spacing: -0.02em; }
.lp-connect-head p { margin: 0; max-width: 620px; font-size: 18px; line-height: 1.55; color: #4A473C; }
.lp-connect-grid { margin-top: 52px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
@media (max-width: 860px) { .lp-connect-grid { grid-template-columns: 1fr; } }
.lp-connect-card { border: 1px solid rgba(27,26,22,0.14); border-radius: 16px; padding: 28px; background: #F7F6F4; display: flex; flex-direction: column; gap: 11px; transition: background .15s ease, border-color .15s ease; }
.lp-connect-card:hover { background: #EFEEEC; border-color: rgba(27,26,22,0.3); }
.lp-connect-kicker { font-size: 11.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #8C8874; }
.lp-connect-card h4 { margin: 0; font-family: 'Google Sans Flex', sans-serif; font-weight: 400; font-size: 24px; letter-spacing: -0.01em; }
.lp-connect-card p { margin: 0; font-size: 15.5px; line-height: 1.6; color: #5C594C; }

.lp-rigor { padding: 130px 48px 0; max-width: 980px; margin: 0 auto; text-align: center; }
.lp-rigor h2 { margin: 0 0 52px; font-family: 'Google Sans Flex', sans-serif; font-weight: 400; font-size: 48px; letter-spacing: -0.02em; }
.lp-rigor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px 60px; text-align: left; }
@media (max-width: 700px) { .lp-rigor-grid { grid-template-columns: 1fr; } }
.lp-rigor-item { display: grid; grid-template-columns: 22px 1fr; gap: 14px; align-items: start; }
.lp-rigor-check { width: 20px; height: 20px; border-radius: 50%; background: #1B1A16; color: #ffffff; display: grid; place-items: center; margin-top: 3px; }
.lp-rigor-item h4 { margin: 0 0 6px; font-family: 'Google Sans Flex', sans-serif; font-weight: 400; font-size: 21px; }
.lp-rigor-item p { margin: 0; font-size: 15.5px; line-height: 1.6; color: #5C594C; }

.lp-reports { padding: 130px 48px 0; max-width: 1180px; margin: 0 auto; }
.lp-reports-head { text-align: center; margin: 0 auto 44px; max-width: 660px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.lp-reports-head h2 { margin: 0; font-family: 'Google Sans Flex', sans-serif; font-weight: 400; font-size: 48px; letter-spacing: -0.02em; }
.lp-reports-head p { margin: 0; font-size: 18px; line-height: 1.55; color: #4A473C; }
.lp-report-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
@media (max-width: 860px) { .lp-report-grid { grid-template-columns: 1fr; max-width: 400px; margin: 0 auto; } }
.lp-report-card { display: flex; flex-direction: column; background: #F3F3F1; border-radius: 16px; padding: 26px 26px 20px; }
.lp-report-kicker { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #8C8874; margin-bottom: 12px; }
.lp-report-title { font-family: 'Google Sans Flex', sans-serif; font-size: 19px; line-height: 1.28; letter-spacing: -0.01em; min-height: 74px; }
.lp-report-rule { height: 1px; background: rgba(27,26,22,0.14); margin: 16px 0 12px; }
.lp-report-label { font-size: 10.5px; letter-spacing: 0.1em; color: #8C8874; margin-bottom: 14px; }
.lp-report-cover { position: relative; overflow: hidden; border-radius: 10px; border: 1px solid rgba(27,26,22,0.1); background: #F0EFEC; aspect-ratio: 4 / 3; }
.lp-report-cover img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
.lp-report-card:hover .lp-report-cover::after { opacity: 1; }
.lp-report-cover::after { content: "Open the full report ↗"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(27,26,22,0.8); color: #fff; opacity: 0; transition: opacity .18s ease; font-family: 'Google Sans Flex', sans-serif; font-size: 15px; }
.lp-report-foot { display: flex; justify-content: space-between; margin-top: 14px; font-size: 11px; letter-spacing: 0.03em; color: #8C8874; }

.lp-final-cta { padding: 100px 48px 130px; text-align: center; border-top: 1px solid #1B1A16; border-bottom: 1px solid #1B1A16; margin-top: 130px; display: flex; flex-direction: column; align-items: center; gap: 22px; }
.lp-final-cta h2 { margin: 0; font-family: 'Google Sans Flex', sans-serif; font-weight: 400; font-size: 42px; letter-spacing: -0.02em; max-width: 680px; }
.lp-final-cta p { margin: 0; font-size: 18px; color: #4A473C; }

.lp-footer { background: #191813; color: #fff; padding: 64px 48px 40px; }
.lp-footer-inner { max-width: 1180px; margin: 0 auto; }
.lp-footer-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 40px; flex-wrap: wrap; }
.lp-footer-brand { display: flex; align-items: center; gap: 10px; }
.lp-footer-brand span { font-family: 'Google Sans Flex', sans-serif; font-size: 22px; }
.lp-footer-links { display: flex; flex-direction: column; gap: 12px; font-family: 'Google Sans Flex', sans-serif; font-size: 15px; }
.lp-footer-links span.label { opacity: 0.55; font-size: 11px; font-family: 'Google Sans Flex', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
.lp-footer-links a { color: rgba(255,255,255,0.72); }
.lp-footer-links a:hover { color: #fff; }
.lp-footer-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 44px; border-top: 1px solid rgba(255,255,255,0.13); padding-top: 24px; font-size: 12.5px; color: rgba(255,255,255,0.5); }
.lp-footer-bottom a { color: rgba(255,255,255,0.5); }
.lp-footer-bottom a:hover { color: #fff; }

@media (max-width: 760px) {
  .lp-nav-links { display: none; }
  .lp-hero-inner h1 { font-size: 38px; }
  .lp-lab h2 { font-size: 32px; }
  .lp-connect-head h2, .lp-rigor h2, .lp-reports-head h2 { font-size: 34px; }
}
`;

export default function LandingPage() {
  const { user, loading } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".gsap-reveal");
      gsap.set(cards, { opacity: 0, y: 28 });
      ScrollTrigger.batch(cards, {
        start: "top 88%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.1, overwrite: true }),
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  if (!loading && user) return <Navigate to="/researches" replace />;

  return (
    <div className="lp-root" ref={rootRef}>
      <style>{CSS}</style>
      <div className="lp-topbar" />

      <header className="lp-nav">
        <a href="#top" className="lp-brand">
          <Mark />
          <span>reagent</span>
        </a>
        <nav className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#capabilities">Connectors</a>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Docs</a>
          <Link to="/articles">Articles</Link>
        </nav>
        <div className="lp-nav-actions">
          <Link to="/login" className="lp-login-link">Log in</Link>
          <Link to="/researches" className="lp-cta">
            <span>Start a run</span><span>→</span>
          </Link>
        </div>
      </header>

      <section id="top" className="lp-hero">
        <div className="lp-hero-bg" aria-hidden />
        <div className="lp-hero-inner">
          <h1>
            <TextReveal text="Agents are science’s" />
            <br />
            <TextReveal text="new workforce" baseDelay={0.25} />
          </h1>
          <TextReveal
            as="p"
            text="They read the literature, weigh the evidence, and run the experiment — then hand you a cited answer you can defend."
            baseDelay={0.4}
          />
          <div className="lp-hero-ctas">
            <Link to="/researches" className="lp-btn-primary">
              <span>Start a run</span><span>→</span>
            </Link>
            <a href="#how" className="lp-btn-secondary">
              <span>See how it works</span><span>→</span>
            </a>
          </div>
        </div>
      </section>

      <section id="how" className="lp-lab">
        <div className="lp-lab-head">
          <div className="lp-lab-kicker">
            <Mark size={22} />
            <span>reagent</span>
          </div>
          <h2><TextReveal text="One workspace, from question to cited answer" /></h2>
          <TextReveal as="p" text="Plan the research with the agent, watch it run, and review every source it used — all in one place." />
        </div>
        <div className="lp-lab-frame gsap-reveal">
          <div className="lp-lab-screen">
            <iframe src="/index.html?preview=dashboard" title="Reagent workspace preview" scrolling="no" />
          </div>
        </div>
      </section>

      <section id="architecture" className="lp-arch-section">
        <div className="lp-arch-head">
          <div>
            <div className="lp-arch-kicker">Architecture</div>
            <h2><TextReveal text="One agent, end to end" /></h2>
          </div>
          <span className="lp-arch-tag">inputs · reasoning · outputs</span>
        </div>
        <ArchitectureDiagram />
      </section>

      <section id="workspace" className="lp-showcase">
        <div className="lp-showcase-head">
          <h2><TextReveal text="See it inside the workspace" /></h2>
          <TextReveal as="p" text="Real screenshots from an actual run — the same CRISPR gene-drive governance report featured below." />
        </div>
        <div className="lp-showcase-grid">
          <div className="lp-showcase-card lp-showcase-big gsap-reveal">
            <div className="lp-showcase-text">
              <h3>Every finding, checked and cited</h3>
              <p>A blind reviewer checks each finding against its sources, flags anything it can&rsquo;t verify, and only keeps what actually holds up.</p>
            </div>
            <div className="lp-showcase-img">
              <img src="/landing/images/extract-finding.png" alt="Extracted findings panel, each with a verified or flagged status" />
            </div>
          </div>
          <div className="lp-showcase-card gsap-reveal">
            <div className="lp-showcase-img">
              <img src="/landing/images/graph.png" alt="A generated comparison-matrix chart" />
            </div>
            <div className="lp-showcase-text">
              <h3>Real charts, not just prose</h3>
              <p>Comparisons, figures, and data tables generated directly from the analysis.</p>
            </div>
          </div>
          <div className="lp-showcase-card gsap-reveal">
            <div className="lp-showcase-img">
              <img src="/landing/images/research-plan.png" alt="A visible research plan document" />
            </div>
            <div className="lp-showcase-text">
              <h3>A visible research plan</h3>
              <p>See exactly how it scoped the question and what it planned to compare — before you read a single finding.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="connect" className="lp-connect">
        <div className="lp-connect-head">
          <h2><TextReveal text="Connect anything" /></h2>
          <TextReveal as="p" text="One protocol layer for your whole stack. Point reagent at a source and its agents can read it, reason over it, and cite it." />
        </div>
        <div className="lp-connect-grid">
          {CONNECT_CARDS.map((c) => (
            <div key={c.title} className="lp-connect-card gsap-reveal">
              <span className="lp-connect-kicker">{c.kicker}</span>
              <h4>{c.title}</h4>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="capabilities" className="lp-rigor">
        <h2><TextReveal text="Built for rigor" /></h2>
        <div className="lp-rigor-grid">
          {RIGOR_PILLARS.map((p) => (
            <div key={p.title} className="lp-rigor-item gsap-reveal">
              <span className="lp-rigor-check"><IconCheck /></span>
              <div>
                <h4>{p.title}</h4>
                <p>{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="reports" className="lp-reports">
        <div className="lp-reports-head">
          <h2><TextReveal text="Read what the agent wrote" /></h2>
          <TextReveal as="p" text="Three real reports — a biosecurity policy brief, the economics of AI, and a geopolitical analysis — each researched, reasoned, and written end to end from a single question." />
        </div>
        <div className="lp-report-grid">
          {REPORTS.map((r) => (
            <a key={r.file} className="lp-report-card gsap-reveal" href={`/landing/reports/${r.file}.pdf`} target="_blank" rel="noopener noreferrer">
              <span className="lp-report-kicker">{r.kicker}</span>
              <div className="lp-report-title">{r.title}</div>
              <div className="lp-report-rule" />
              <span className="lp-report-label">{r.label}</span>
              <div className="lp-report-cover">
                <img src={`/landing/reports/covers/${r.file}.png`} alt={`${r.title} cover`} />
              </div>
              <div className="lp-report-foot">
                <span>Reagent Research</span>
                <span>{r.pages} · PDF</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="lp-final-cta">
        <h2><TextReveal text="Run your first experiment tonight." /></h2>
        <TextReveal as="p" text="Ask a real question. Come back to a cited answer." />
        <div className="lp-hero-ctas">
          <Link to="/researches" className="lp-btn-primary"><span>Start a run</span><span>→</span></Link>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="lp-btn-secondary"><span>Read the docs</span></a>
        </div>
      </section>

      <footer id="start" className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <Mark color="#ffffff" />
              <span>reagent</span>
            </div>
            <div className="lp-footer-links">
              <span className="label">Product</span>
              <a href="#how">How it works</a>
              <a href="#capabilities">Capabilities</a>
              <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Docs</a>
              <Link to="/articles">Articles</Link>
              <Link to="/researches">Start a run</Link>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 Reagent.</span>
            <a href="#top">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
