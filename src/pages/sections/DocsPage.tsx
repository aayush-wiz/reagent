import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, Box, Group, Text } from "@mantine/core";
import { BookOpen, ChevronRight, CircleDot } from "lucide-react";
import Sidebar from "../../components/workspace/Sidebar";
import type { HomeChrome } from "./shared";

interface Props {
  sub?: string;
  chrome: HomeChrome;
}

/* ── palette (app light theme + Reagent sage-green accent) ─────────────────── */
const INK = "#1c1b19";
const INK_SOFT = "#3a3733";
const MUTED = "#6f6a61";
const FAINT = "#a29e97";
const LINE = "#ebe9e4";
const LINE_SOFT = "#f0efea";
const ACCENT = "#3F7355";
const TINT = "rgba(63,115,85,0.08)";
const TINT_LINE = "rgba(63,115,85,0.24)";
const SURFACE = "#faf9f6";
const MONO = "'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace";

/* ── the page's sections, in order (drives the right-hand table of contents) ─ */
const TOC: { id: string; label: string; group: string }[] = [
  { id: "intro", label: "Overview", group: "00 · Overview" },
  { id: "loop", label: "The research loop", group: "00 · Overview" },
  { id: "board", label: "The hypothesis board", group: "00 · Overview" },
  { id: "elo", label: "Live Elo tournament", group: "01 · Ranking" },
  { id: "bradley", label: "Bradley–Terry", group: "01 · Ranking" },
  { id: "bandits", label: "Multi-armed bandits", group: "02 · Selection" },
  { id: "bayesopt", label: "Bayesian optimization", group: "02 · Selection" },
  { id: "mapelites", label: "MAP-Elites", group: "03 · Breeding" },
  { id: "halving", label: "Successive halving", group: "03 · Breeding" },
  { id: "search", label: "Search strategy", group: "04 · Exploring" },
  { id: "literature", label: "Literature search", group: "05 · Evidence" },
];

/* ── small presentational helpers ──────────────────────────────────────────── */
function Kicker({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: FAINT, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <section id={id} data-doc-section style={{ scrollMarginTop: 24, paddingTop: 44 }}>
      <Kicker>{kicker}</Kicker>
      <h2 style={{ fontSize: 25, letterSpacing: "-0.018em", lineHeight: 1.18, fontWeight: 650, margin: "0 0 14px", color: INK, textWrap: "balance" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p style={{ margin: "0 0 15px", color: INK_SOFT, fontSize: 15.5, lineHeight: 1.68 }}>{children}</p>;
}

function Tok({ children }: { children: ReactNode }) {
  return (
    <code style={{ fontFamily: MONO, fontSize: "0.85em", background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 5, padding: "1px 5px", color: ACCENT, whiteSpace: "nowrap" }}>
      {children}
    </code>
  );
}

function FormulaCard({ label, expr, gloss }: { label: string; expr: ReactNode; gloss: ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 13, margin: "20px 0", overflow: "hidden", boxShadow: "0 14px 30px -26px rgba(28,27,25,0.28)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 15px", borderBottom: `1px solid ${LINE_SOFT}`, background: SURFACE }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, flex: "none" }} />
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>{label}</span>
      </div>
      <div style={{ padding: "18px 16px", overflowX: "auto" }}>
        <div style={{ fontFamily: MONO, fontSize: 16, lineHeight: 1.85, color: INK, whiteSpace: "nowrap" }}>{expr}</div>
      </div>
      <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6, padding: "12px 16px 14px", borderTop: `1px solid ${LINE_SOFT}`, background: SURFACE }}>{gloss}</div>
    </div>
  );
}

function MetaGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1, background: LINE, border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden", margin: "20px 0" }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ background: "#fff", padding: "13px 15px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.11em", textTransform: "uppercase", color: FAINT, marginBottom: 5 }}>{k}</div>
          <div style={{ fontSize: 13.5, color: INK_SOFT, lineHeight: 1.5 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function SourceNote({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 11.5, color: FAINT, display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
      <ChevronRight size={13} />
      <span>{children}</span>
    </div>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 11, padding: "14px 16px", margin: "22px 0", background: TINT, border: `1px solid ${TINT_LINE}`, borderRadius: 12 }}>
      <CircleDot size={16} color={ACCENT} style={{ flex: "none", marginTop: 2 }} />
      <p style={{ margin: 0, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

const B = ({ children }: { children: ReactNode }) => <b style={{ color: INK, fontWeight: 600 }}>{children}</b>;
const Op = ({ children }: { children: ReactNode }) => <span style={{ color: ACCENT }}>{children}</span>;
const Dim = ({ children }: { children: ReactNode }) => <span style={{ color: MUTED, fontSize: "0.72em", verticalAlign: "sub" }}>{children}</span>;

/* table wrapper */
function DocTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto", margin: "20px 0", border: `1px solid ${LINE}`, borderRadius: 12 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5, minWidth: 520 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: FAINT, fontWeight: 500, padding: "11px 14px", background: SURFACE, borderBottom: `1px solid ${LINE}` }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: "11px 14px", borderBottom: i === rows.length - 1 ? "none" : `1px solid ${LINE_SOFT}`, color: INK_SOFT, verticalAlign: "top" }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── the page ──────────────────────────────────────────────────────────────── */
export default function DocsPage({ chrome }: Props) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState<string>("intro");

  // Scroll-spy: highlight the TOC entry for the section currently in view.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const seen: Record<string, number> = {};
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen[(e.target as HTMLElement).id] = e.isIntersecting ? e.intersectionRatio : 0;
        let best = active;
        let bestR = -1;
        for (const k of Object.keys(seen)) if (seen[k] > bestR) { bestR = seen[k]; best = k; }
        if (bestR > 0) setActive(best);
      },
      { root, rootMargin: "-12% 0px -72% 0px", threshold: [0, 0.25, 0.6, 1] },
    );
    root.querySelectorAll("[data-doc-section]").forEach((s) => obs.observe(s));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#ffffff" }}>
      <Sidebar
        nav={chrome.nav}
        openTask={chrome.openTask}
        menuOpen={chrome.menuOpen}
        toggleMenu={chrome.toggleMenu}
        menuItems={chrome.menuItems}
      />

      <section ref={scrollRef} style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "#fff", display: "flex", flexDirection: "column" }}>
        {/* header */}
        <Group px="lg" py="sm" justify="space-between" style={{ borderBottom: `1px solid ${LINE_SOFT}`, position: "sticky", top: 0, zIndex: 5, background: "#fff" }}>
          <Group gap={8}>
            <BookOpen size={16} color="#847f76" />
            <Box>
              <Text fw={600} size="md">Docs · Research Algorithms</Text>
              <Text size="xs" c="dimmed">The math behind Reagent's Strong-Inference research loop</Text>
            </Box>
          </Group>
          <Badge variant="light" color="gray" size="sm" tt="none">8 algorithms · 42 databases</Badge>
        </Group>

        {/* content + table of contents */}
        <div style={{ display: "flex", gap: 40, alignItems: "flex-start", padding: "0 clamp(24px, 5vw, 64px) 120px", maxWidth: 1180, margin: "0 auto", width: "100%" }}>
          <article style={{ flex: 1, minWidth: 0, maxWidth: 760 }}>
            {/* hero */}
            <header style={{ paddingTop: 40 }}>
              <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.16em", textTransform: "uppercase", color: ACCENT, marginBottom: 15 }}>
                Reagent · Research Engine
              </div>
              <h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", lineHeight: 1.1, letterSpacing: "-0.022em", fontWeight: 680, margin: "0 0 16px", color: INK, textWrap: "balance" }}>
                The math behind the research loop
              </h1>
              <p style={{ fontSize: 17, lineHeight: 1.6, color: INK_SOFT, margin: 0, maxWidth: "60ch" }}>
                Reagent runs an <B>iterative Strong-Inference tournament</B>: it holds several rival hypotheses, makes
                them compete, kills some with evidence, and loops back. This is the reference for the numeric methods
                that drive it — how hypotheses are <B>ranked</B>, how the next experiment is <B>chosen</B>, how the
                population is <B>bred</B>, and how the space is <B>searched</B> — each with its formula and where it
                lives in the engine.
              </p>
              <Group gap={8} mt={22}>
                {["3 jobs · rank · select · breed", "8 algorithms", "42 databases", "Strong Inference · Platt 1964"].map((c) => (
                  <span key={c} style={{ fontFamily: MONO, fontSize: 11.5, color: MUTED, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 999, padding: "5px 12px" }}>
                    {c}
                  </span>
                ))}
              </Group>
            </header>

            {/* ── OVERVIEW ── */}
            <Section id="intro" kicker="00 · Overview" title="One engine, three kinds of decision">
              <P>
                A linear pipeline — guess one hypothesis, run one analysis, write it up — can only ever <i>confirm</i>{" "}
                what you already guessed. Reagent's primary agent instead runs a loop built from J. R. Platt's{" "}
                <B>Strong Inference</B> (multiple working hypotheses + crucial experiments), a{" "}
                <B>generate–debate–evolve</B> tournament, and <B>pre-registration</B> rigor. Everything below serves
                one of three recurring decisions inside that loop:
              </P>
              <MetaGrid
                items={[
                  ["Rank", <>Turn pairwise outcomes into an ordering. <B>Elo</B> live, <B>Bradley–Terry</B> for the final fit.</>],
                  ["Select", <>Choose the next experiment. <B>Bandits</B> when cheap, <B>Bayesian optimization</B> when expensive.</>],
                  ["Breed", <>Keep a diverse, strong population. <B>MAP-Elites</B> for variety, <B>successive halving</B> under budget.</>],
                ]}
              />
              <P>
                The agent doesn't run these on a fixed schedule — it reasons over the live state of the hypothesis
                board and calls them as evidence demands. The formulas make each decision <i>correct and repeatable</i>;
                the evidence still comes from real experiments and cited papers.
              </P>
            </Section>

            {/* ── LOOP ── */}
            <Section id="loop" kicker="00 · Overview" title="The research loop">
              <P>
                This is a loop, not a line. The agent re-enters any step as evidence arrives; it stops only when one
                hypothesis has survived its crucial test and meets its pre-registered success criteria.
              </P>
              <div style={{ margin: "20px 0" }}>
                {[
                  ["01", "Scope", "Restate the question in one line; define what a decisive answer looks like."],
                  ["02", "Literature", "Ground in real papers first — decompose into 3–5 facets, spawn a review subagent per facet."],
                  ["03", "Generate ≥3 rivals", "Add competing hypotheses that genuinely disagree, each with its crucial refutation test."],
                  ["04", "Diversify & reflect", "Merge near-duplicates; a critique subagent kills the logically broken ones before compute."],
                  ["05", "Rank — the tournament", "Pairwise scientific debates decide which the evidence favours; the board re-orders by Elo. ↻ §01"],
                  ["06", "Design the crucial experiment", "Take the leader and its nearest rival; design the one test whose outcome splits them. ↻ §02"],
                  ["07", "Pre-register", "Lock success/failure criteria before running — what prevents p-hacking and HARKing."],
                  ["08", "Run → verify", "Execute in the sandbox; pass the pre- and post-compute critique gates; report raw outputs."],
                  ["09", "Update beliefs", "Apply the pre-registered rule; record the match so Elo reflects real evidence, not just debate."],
                  ["10", "Evolve & re-enter", "Breed the survivors into sharper hypotheses and loop back with a smaller, stronger board. ↻ §03"],
                ].map(([n, t, d], i) => (
                  <div key={n} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 14, padding: "13px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE_SOFT}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: ACCENT, paddingTop: 2, fontVariantNumeric: "tabular-nums" }}>{n}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: INK, fontSize: 14.5 }}>{t}</div>
                      <div style={{ color: MUTED, fontSize: 13.5, marginTop: 2, lineHeight: 1.5 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Callout>
                <B>A refutation is data, not a failure.</B> Killing a hypothesis is the loop working — the survivor is
                what the evidence, not preference, has chosen.
              </Callout>
            </Section>

            {/* ── BOARD ── */}
            <Section id="board" kicker="00 · Overview" title="The hypothesis board — the state everything runs on">
              <P>
                Every algorithm operates over one durable structure: the <B>hypothesis board</B>. It lives in SQLite,
                not in the model's context, so it survives across the agent's steps, across context windows, and across
                chat sessions. Each hypothesis carries its statement, null hypothesis, confirm/refute tests, a status,
                an Elo rating, and a match count.
              </P>
              <DocTable
                head={["Tool", "What it does"]}
                rows={[
                  [<Tok>add_hypothesis</Tok>, "Put a rival on the board — statement, H₀, what confirms it, and the crucial test that would refute it."],
                  [<Tok>list_hypotheses</Tok>, "Read the board, ranked by Elo (highest first)."],
                  [<Tok>update_hypothesis</Tok>, <>Set status <B>alive · supported · refuted · evolved · merged</B>, attach evidence, or pre-register criteria.</>],
                  [<Tok>record_match</Tok>, "Record one pairwise outcome and update both Elo ratings."],
                  [<Tok>get_ratings</Tok>, "The leaderboard — has a clear leader emerged, or are the top rivals still close?"],
                ]}
              />
              <SourceNote>Implemented in <code style={{ color: MUTED }}>backend/src/agent/skills/hypotheses.ts</code></SourceNote>
            </Section>

            {/* ── ELO ── */}
            <Section id="elo" kicker="01 · Ranking hypotheses" title="Live Elo tournament">
              <P>
                During the tournament, every pairwise verdict updates a running rating so the board stays correctly
                ordered in real time. The <Tok>rank</Tok> subagent decides <i>who</i> wins a pairing and <i>why</i>;{" "}
                <Tok>record_match</Tok> is deterministic bookkeeping — the definition of Elo, not a research heuristic.
              </P>
              <MetaGrid
                items={[
                  ["What", "A rating per hypothesis, updated after each pairwise match."],
                  ["When", <>Every cycle, as the <B>rank</B> subagent or an experiment settles a pairing.</>],
                  ["In → out", <><B>(winner, loser)</B> → both ratings adjusted.</>],
                ]}
              />
              <FormulaCard
                label="Expected score"
                expr={<>E<Dim>a</Dim> <Op>=</Op> 1 <Op>/</Op> ( 1 <Op>+</Op> 10<Op>^</Op>( ( R<Dim>b</Dim> <Op>−</Op> R<Dim>a</Dim> ) <Op>/</Op> 400 ) )</>}
                gloss={<>The probability <B>a</B> beats <B>b</B> given their ratings. A 400-point gap ≈ a 10-to-1 favourite.</>}
              />
              <FormulaCard
                label="Rating update"
                expr={<>R<Op>′</Op> <Op>=</Op> R <Op>+</Op> K <Op>·</Op> ( S <Op>−</Op> E )</>}
                gloss={
                  <>
                    <B>S</B> is the actual result — <B>1</B> win, <B>0</B> loss, <B>0.5</B> draw. <B>K = 32</B> is the
                    step size (the long-standing default, right for a handful of hypotheses over a few rounds). New
                    hypotheses start at <B>1000</B>. Beating a higher-rated rival moves you more than beating a weaker one.
                  </>
                }
              />
              <Callout>
                <B>Convergence signal.</B> A clear Elo leader on <Tok>get_ratings</Tok> with its rivals refuted means
                the loop has converged. Top rivals still close means the gap is telling you <B>where the decisive
                experiment is</B>.
              </Callout>
              <SourceNote>
                <code style={{ color: MUTED }}>expectedScore()</code> + record_match · hypotheses.ts · K via <code style={{ color: MUTED }}>REAGENT_ELO_K</code>
              </SourceNote>
            </Section>

            {/* ── BRADLEY-TERRY ── */}
            <Section id="bradley" kicker="01 · Ranking hypotheses" title="Bradley–Terry — the accurate final ranking">
              <P>
                Live Elo is order-dependent and noisy. Once the match log is complete, Bradley–Terry fits one latent{" "}
                <B>strength</B> per hypothesis from <i>all</i> pairwise results at once — the same model behind LMArena
                and Arena-Hard — to produce the definitive ranking.
              </P>
              <MetaGrid
                items={[
                  ["What", "One strength per item, fit by maximum likelihood."],
                  ["When", "After the tournament, for the definitive ordering."],
                  ["In → out", <>The full <B>(winner, loser)</B> log → a sorted strength per hypothesis.</>],
                ]}
              />
              <FormulaCard
                label="Pairwise probability · fit by MLE"
                expr={<><span style={{ fontWeight: 600 }}>P</span>( i beats j ) <Op>=</Op> s<Dim>i</Dim> <Op>/</Op> ( s<Dim>i</Dim> <Op>+</Op> s<Dim>j</Dim> )</>}
                gloss={<>Each hypothesis has a strength <B>sᵢ</B> ≥ 0; the chance it beats a rival is its share of their combined strength. Solved with the closed-form MM / Zermelo iteration — <B>numpy only</B>, no heavy deps.</>}
              />
              <SourceNote>Runs in the sandbox: <code style={{ color: MUTED }}>scripts/bradley_terry.py matches.json</code></SourceNote>
            </Section>

            {/* ── BANDITS ── */}
            <Section id="bandits" kicker="02 · Choosing the experiment" title="Multi-armed bandits — cheap next-experiment selection">
              <P>
                When you have a handful of candidate experiments, each returning a noisy reward, a bandit picks which
                to run next — balancing <B>exploiting</B> the current best against <B>exploring</B> the uncertain ones.
                Reagent ships three rules.
              </P>
              <FormulaCard
                label="UCB1 — upper confidence bound"
                expr={<>pick <span style={{ fontWeight: 600 }}>argmax</span><Dim>i</Dim> &nbsp; x̄<Dim>i</Dim> <Op>+</Op> <Op>√</Op>( 2 <Op>·</Op> ln N <Op>/</Op> n<Dim>i</Dim> )</>}
                gloss={<>Mean reward <B>x̄ᵢ</B> plus an exploration bonus that grows for arms pulled few times (<B>nᵢ</B>) as total pulls <B>N</B> rise. Deterministic, no tuning.</>}
              />
              <FormulaCard
                label="Thompson sampling — Bernoulli"
                expr={<>θ<Dim>i</Dim> <Op>~</Op> <span style={{ fontWeight: 600 }}>Beta</span>( 1<Op>+</Op>wins<Dim>i</Dim> , 1<Op>+</Op>losses<Dim>i</Dim> ) <Op>→</Op> pick <span style={{ fontWeight: 600 }}>argmax</span> θ</>}
                gloss="Draw a plausible success rate for each arm from its posterior and pick the sampled best — exploration falls out naturally as counts grow."
              />
              <FormulaCard
                label="ε-greedy"
                expr={<>best arm w.p. ( 1 <Op>−</Op> ε ) , &nbsp; random arm w.p. ε</>}
                gloss="The simplest rule: mostly exploit, occasionally explore at random. A sane baseline when the others are overkill."
              />
              <SourceNote>Runs in the sandbox: <code style={{ color: MUTED }}>scripts/bandits.py --strategy ucb arms.json</code></SourceNote>
            </Section>

            {/* ── BAYESOPT ── */}
            <Section id="bayesopt" kicker="02 · Choosing the experiment" title="Bayesian optimization — expensive, continuous experiments">
              <P>
                When each experiment is expensive (a long sandbox run, a costly simulation) and the knob you're tuning
                is <B>continuous</B> — a threshold, a rate, a hyperparameter — a bandit's discrete arms don't fit.
                Bayesian optimization models the objective with a Gaussian-process surrogate and proposes the next
                input that maximises an acquisition function. This is formal optimal experimental design.
              </P>
              <FormulaCard
                label="Acquisition — Expected Improvement"
                expr={<><span style={{ fontWeight: 600 }}>EI</span>( x ) <Op>=</Op> <span style={{ fontWeight: 600 }}>𝔼</span>[ <span style={{ fontWeight: 600 }}>max</span>( 0 , f(x) <Op>−</Op> f<Dim>best</Dim> ) ]</>}
                gloss={<>Under the GP posterior, score each candidate <B>x</B> by how much it's expected to beat the best result so far — then evaluate the <B>x</B> that scores highest.</>}
              />
              <MetaGrid
                items={[
                  ["In → out", <>Observed <B>(x, y)</B> points + input bounds → the next <B>x</B> to evaluate.</>],
                  ["Library", <>scikit-learn — <B>GaussianProcessRegressor</B>.</>],
                ]}
              />
              <SourceNote>Runs in the sandbox: <code style={{ color: MUTED }}>scripts/bayesopt.py observations.json</code></SourceNote>
            </Section>

            {/* ── MAP-ELITES ── */}
            <Section id="mapelites" kicker="03 · Breeding hypotheses" title="MAP-Elites — a diverse archive, not one winner">
              <P>
                When the agent evolves survivors into new hypotheses, collapsing to a single best idea kills diversity
                and risks premature convergence. MAP-Elites is quality-diversity search: it keeps the best solution{" "}
                <B>per behaviour cell</B>, so you retain a spread of strong hypotheses along chosen axes (e.g. mechanism
                type × boldness). It's the core of AlphaEvolve.
              </P>
              <FormulaCard
                label="The loop"
                expr={
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, whiteSpace: "normal" }}>
                    <span><Op>1.</Op> pick a random elite &nbsp;<Op>→</Op>&nbsp; <Op>2.</Op> mutate it</span>
                    <span><Op>3.</Op> evaluate <Op>→</Op> ( fitness , descriptors )</span>
                    <span><Op>4.</Op> place in its cell <span style={{ fontWeight: 600 }}>if</span> it beats the current occupant</span>
                  </div>
                }
                gloss={<>The grid over the descriptor axes <i>is</i> the output — the best solution found in each cell. In Reagent, <B>the LLM is the mutation operator</B>: the agent generates the mutated hypothesis; the script manages the archive.</>}
              />
              <SourceNote>Runs in the sandbox: <code style={{ color: MUTED }}>scripts/map_elites.py</code> · import <code style={{ color: MUTED }}>MapElites</code></SourceNote>
            </Section>

            {/* ── HALVING ── */}
            <Section id="halving" kicker="03 · Breeding hypotheses" title="Successive halving / Hyperband — screen many under a budget">
              <P>
                With many candidate hypotheses or configs and a fixed compute budget, running each to completion is
                wasteful. Successive halving gives every candidate a small budget, keeps the top fraction, multiplies
                the budget, and repeats — a tournament of experiments that spends compute on survivors.
              </P>
              <FormulaCard
                label="At rung r"
                expr={<>evaluate survivors at budget &nbsp; b <Op>·</Op> η<Op>^</Op>r &nbsp;<Op>→</Op>&nbsp; keep the top &nbsp; 1<Op>/</Op>η &nbsp;<Op>→</Op>&nbsp; repeat</>}
                gloss={<>Each rung <B>r</B> multiplies the per-candidate budget by <B>η</B> and culls to the best <B>1/η</B>. Losers die early and cheaply; the winner emerges having earned the most compute.</>}
              />
              <SourceNote>Runs in the sandbox: <code style={{ color: MUTED }}>scripts/successive_halving.py</code></SourceNote>
            </Section>

            {/* ── SEARCH ── */}
            <Section id="search" kicker="04 · Exploring the space" title="Search strategy — which node to expand next">
              <P>
                You rarely can test every hypothesis. Exploration is a <B>search over a tree</B>: a node is a
                hypothesis (or an experiment plan), expanding it generates its children (refinements, follow-up
                experiments), and each node has a score <Tok>h(node)</Tok> — the Elo from the tournament for
                hypotheses, expected information gain for experiments.
              </P>
              <FormulaCard
                label="The node score"
                expr={<>h( node ) <Op>=</Op> Elo ( get_ratings ) &nbsp;·&nbsp; evidential support &nbsp;·&nbsp; expected info gain</>}
                gloss="Best-first search always expands the highest-scoring frontier node — put compute where the evidence is best."
              />
              <DocTable
                head={["Strategy", "Behaviour", "Use when"]}
                rows={[
                  [<B>BFS</B>, "Level-by-level, all depth-1 before depth-2.", "Shallow space; you want coverage."],
                  [<B>DFS</B>, "Down one branch before backtracking.", "A strong lead worth chasing; backtracking is cheap."],
                  [<><B>Best-first</B> <span style={{ color: ACCENT }}>◂ default</span></>, "Always expand the highest-scoring node.", "You can score nodes — the tournament gives Elo."],
                  [<B>Beam (width k)</B>, <>Keep only the top-<Tok>k</Tok> each level; prune the rest.</>, <>Wide branching, bounded cost. <B>k = 3–5</B> rivals.</>],
                  [<B>MCTS</B>, "Balance explore/exploit via UCB over rollouts.", "Sequential, multi-stage experimental programs."],
                ]}
              />
              <Callout>
                <B>The practical default:</B> beam search, width <B>3–5</B> over the hypothesis board, scored by the{" "}
                <B>rank</B> tournament (Elo), expanding the leader and its nearest rival each cycle, and choosing the
                next experiment with a UCB / Bayesian-optimization rule when experiments are expensive. Escalate to
                MCTS only for genuinely multi-stage programs.
              </Callout>
              <h3 style={{ fontSize: 16, fontWeight: 620, margin: "28px 0 8px", color: INK }}>Bounding the tournament</h3>
              <P>
                A full round-robin of <Tok>rank</Tok> comparisons is <B>O(n²)</B>. For a large board: <B>beam</B> (rank
                only the top-k against each other), <B>Swiss pairing</B> (each round, pair hypotheses of similar Elo — a
                few rounds rank a big field cheaply), or <B>successive halving</B> (small test, keep the top half, repeat).
              </P>
            </Section>

            {/* ── LITERATURE ── */}
            <Section id="literature" kicker="05 · Finding evidence" title="Literature search — PRISMA over 42 databases">
              <P>
                Every hypothesis is grounded in real papers before compute is spent. The <Tok>literature-review</Tok>{" "}
                subagent runs a PRISMA-style systematic search through a single <Tok>science_search</Tok> tool backed by
                a connector registry of <B>42 scientific databases</B> across seven domains — the agent picks the source
                per facet.
              </P>
              <Group gap={7} my={16}>
                {[["genomics", 14], ["literature", 7], ["proteomics", 7], ["chemistry", 6], ["structure", 4], ["biology", 3], ["clinical", 1]].map(([d, n]) => (
                  <span key={d as string} style={{ fontFamily: MONO, fontSize: 11.5, color: INK_SOFT, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 10px", display: "inline-flex", gap: 7 }}>
                    {d}<span style={{ color: ACCENT, fontWeight: 600 }}>{n}</span>
                  </span>
                ))}
              </Group>
              <P>The subagent decomposes a review into facets and runs several in parallel, each following the PRISMA flow:</P>
              <div style={{ margin: "18px 0" }}>
                {[
                  ["1", "Identification", "Cast a wide net — 3–5 varied queries per facet across databases (openalex broadest, pubmed/europepmc biomedical, arxiv/semantic-scholar preprints). Deduplicate by DOI/title."],
                  ["2", "Screening", "Define inclusion/exclusion criteria first, then mark each candidate INCLUDE/EXCLUDE with a one-line rationale citing a criterion."],
                  ["3", "Eligibility", "For included papers, extract key claims (with numbers), methods, author-stated limitations, and an evidence-quality tier."],
                  ["4", "Synthesis", "Group findings by theme — consensus (3+ papers), emerging (1–2 recent), contested — and explicitly flag contradictions."],
                  ["5", "Verify", "Confirm every citation's author, year, venue, and title. Unverifiable → [CITATION NEEDED], never invented."],
                ].map(([n, t, d], i) => (
                  <div key={n} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 14, padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE_SOFT}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: ACCENT, paddingTop: 2 }}>{n}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: INK, fontSize: 14.5 }}>{t}</div>
                      <div style={{ color: MUTED, fontSize: 13.5, marginTop: 2, lineHeight: 1.5 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 620, margin: "24px 0 8px", color: INK }}>Evidence quality tiers</h3>
              <Group gap={7}>
                {["Strong", "Moderate", "Preliminary", "Weak"].map((t) => (
                  <span key={t} style={{ fontFamily: MONO, fontSize: 11.5, color: INK_SOFT, background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 8, padding: "6px 10px" }}>{t}</span>
                ))}
              </Group>
              <Callout>
                <B>Zero tolerance for fabricated citations.</B> Every paper must be found through an actual{" "}
                <Tok>science_search</Tok> / <Tok>get_paper</Tok> call, with DOI, authors, year, and venue verified — the
                same rule the reviewer subagent audits against at finalize.
              </Callout>
              <SourceNote>
                <code style={{ color: MUTED }}>backend/src/agent/skills/science.ts</code> · registry in <code style={{ color: MUTED }}>science/connectors/</code>
              </SourceNote>
            </Section>

            <div style={{ marginTop: 60, paddingTop: 24, borderTop: `1px solid ${LINE_SOFT}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 12.5, color: FAINT }}>
              <span>Reagent — iterative Strong-Inference research engine.</span>
              <span>Rank · Select · Breed · Search · Synthesize</span>
            </div>
          </article>

          {/* right-hand table of contents */}
          <aside style={{ width: 210, flex: "0 0 210px", position: "sticky", top: 78, alignSelf: "flex-start", paddingTop: 46 }} className="docs-toc">
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: FAINT, marginBottom: 12 }}>On this page</div>
            <nav>
              {TOC.map((t, i) => {
                const firstOfGroup = i === 0 || TOC[i - 1].group !== t.group;
                return (
                  <div key={t.id}>
                    {firstOfGroup && (
                      <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: FAINT, margin: i === 0 ? "0 0 6px" : "14px 0 6px", paddingLeft: 12 }}>
                        {t.group}
                      </div>
                    )}
                    <button
                      onClick={() => go(t.id)}
                      style={{
                        display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                        fontSize: 12.5, lineHeight: 1.4, padding: "4px 0 4px 12px",
                        border: "none", background: "none", fontFamily: "inherit",
                        borderLeft: `2px solid ${active === t.id ? ACCENT : LINE}`,
                        color: active === t.id ? ACCENT : MUTED,
                        fontWeight: active === t.id ? 600 : 400,
                      }}
                    >
                      {t.label}
                    </button>
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      </section>
    </div>
  );
}
