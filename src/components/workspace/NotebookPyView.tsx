interface Props {
  nbName: string;
  backToNotebooks: () => void;
}

export default function NotebookPyView({ nbName, backToNotebooks }: Props) {
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "#1e1e1e", color: "#d4d4d4" }}>
      {/* activity bar */}
      <div style={{ flex: "0 0 48px", background: "#333333", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 18, fontSize: 20, color: "#858585" }}>
        <span style={{ color: "#fff" }}>🗎</span>
        <span>⌕</span>
        <span>⑂</span>
        <span>▷</span>
        <div style={{ flex: 1 }} />
        <button onClick={backToNotebooks} title="Back" style={{ background: "none", border: "none", color: "#858585", fontSize: 18, cursor: "pointer", marginBottom: 14 }}>
          ←
        </button>
      </div>
      {/* explorer */}
      <div style={{ flex: "0 0 210px", background: "#252526", borderRight: "1px solid #1a1a1a", padding: "10px 0", fontSize: 12.5 }}>
        <div style={{ padding: "4px 16px 10px", fontSize: 11, letterSpacing: "0.08em", color: "#858585" }}>EXPLORER</div>
        <div style={{ padding: "3px 16px", color: "#cccccc", fontWeight: 600 }}>▾ RESEARCH</div>
        <div style={{ padding: "3px 16px 3px 30px", color: "#9c9c9c" }}>▾ corpus</div>
        <div style={{ padding: "3px 16px 3px 42px", color: "#9c9c9c" }}>effects.parquet</div>
        <div style={{ padding: "3px 16px 3px 30px", background: "#37373d", color: "#fff", borderLeft: "2px solid #2b5fd1" }}>{nbName}</div>
        <div style={{ padding: "3px 16px 3px 30px", color: "#9c9c9c" }}>extract.py</div>
        <div style={{ padding: "3px 16px 3px 30px", color: "#9c9c9c" }}>forest_plot.py</div>
      </div>
      {/* editor + terminal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ flex: "0 0 36px", display: "flex", alignItems: "stretch", background: "#252526" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", background: "#1e1e1e", borderTop: "1px solid #2b5fd1", color: "#fff", fontSize: 12.5 }}>
            🐍 {nbName}
            <span style={{ color: "#858585", marginLeft: 4 }}>✕</span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", minHeight: 0, padding: "12px 0", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, lineHeight: 1.75 }}>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}> 1  </span>
            <span style={{ color: "#6a9955" }}># Random-effects meta-analysis</span>
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}> 2  </span>
            <span style={{ color: "#c586c0" }}>import</span> pandas <span style={{ color: "#c586c0" }}>as</span> pd
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}> 3  </span>
            <span style={{ color: "#c586c0" }}>import</span> numpy <span style={{ color: "#c586c0" }}>as</span> np
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}> 4  </span>
            <span style={{ color: "#c586c0" }}>from</span> scipy <span style={{ color: "#c586c0" }}>import</span> stats
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}> 5</span>{" "}
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}> 6  </span>df = pd.<span style={{ color: "#dcdcaa" }}>read_parquet</span>(<span style={{ color: "#ce9178" }}>"corpus/effects.parquet"</span>)
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}> 7  </span>df = df[df.<span style={{ color: "#9cdcfe" }}>selected</span>]
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}> 8</span>{" "}
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}> 9  </span>
            <span style={{ color: "#6a9955" }}># DerSimonian–Laird weights</span>
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}>10  </span>w = <span style={{ color: "#b5cea8" }}>1</span> / (df.<span style={{ color: "#9cdcfe" }}>var</span> + <span style={{ color: "#dcdcaa" }}>tau2</span>(df))
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}>11  </span>pooled = np.<span style={{ color: "#dcdcaa" }}>average</span>(df.<span style={{ color: "#9cdcfe" }}>effect</span>, weights=w)
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}>12  </span>ci = <span style={{ color: "#dcdcaa" }}>confint</span>(pooled, w)
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}>13</span>{" "}
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}>14  </span>
            <span style={{ color: "#dcdcaa" }}>print</span>(<span style={{ color: "#ce9178" }}>f"g = </span><span style={{ color: "#569cd6" }}>{"{pooled:.3f}"}</span><span style={{ color: "#ce9178" }}>"</span>)
          </div>
          <div style={{ whiteSpace: "pre" }}>
            <span style={{ color: "#858585" }}>15  </span>
            <span style={{ color: "#dcdcaa" }}>plot_forest</span>(df, pooled, ci)
          </div>
        </div>
        <div style={{ flex: "0 0 auto", maxHeight: 170, background: "#181818", borderTop: "1px solid #2b2b2b", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 16, padding: "6px 14px", fontSize: 11, color: "#858585", borderBottom: "1px solid #2b2b2b" }}>
            <span style={{ color: "#fff" }}>TERMINAL</span>
            <span>PROBLEMS</span>
            <span>OUTPUT</span>
          </div>
          <div style={{ padding: "9px 14px", overflow: "auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, lineHeight: 1.7, color: "#cccccc" }}>
            <div>
              <span style={{ color: "#569cd6" }}>➜</span> <span style={{ color: "#4ec9b0" }}>research</span> python {nbName}
            </div>
            <div style={{ color: "#b5cea8" }}>g = 0.412</div>
            <div style={{ color: "#858585" }}>forest plot written → outputs/forest.svg</div>
            <div>
              <span style={{ color: "#569cd6" }}>➜</span> <span style={{ color: "#4ec9b0" }}>research</span> <span style={{ animation: "blink 1.1s infinite" }}>▋</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
