interface Props {
  nbName: string;
  backToNotebooks: () => void;
}

export default function NotebookJupyterView({ nbName, backToNotebooks }: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#f5f5f5" }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e2e0da" }}>
        <button onClick={backToNotebooks} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e0da", background: "#f4f3ef", color: "#57534d", fontSize: 15, cursor: "pointer" }}>
          ←
        </button>
        <span style={{ fontSize: 14 }}>📓</span>
        <span style={{ fontFamily: "'Google Sans Flex',sans-serif", fontWeight: 600, fontSize: 14 }}>{nbName}</span>
        <span style={{ fontSize: 11, color: "#8a8680" }}>Last checkpoint 3m ago</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#57534d" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3a9d5d" }} />
          Python 3.11 · idle
        </div>
        <button style={{ padding: "5px 13px", background: "#f4f3ef", border: "1px solid #e2e0da", borderRadius: 7, fontSize: 12, color: "#3a3733", cursor: "pointer" }}>▶▶ Run all</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: 22 }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14, fontFamily: "'Google Sans Flex',sans-serif" }}>
          {/* markdown cell */}
          <div style={{ padding: "2px 60px" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Effect-size extraction</h1>
            <p style={{ fontSize: 14, color: "#3a3733", lineHeight: 1.6 }}>
              Pull reported standardized effect sizes and their variances from the 42 selected papers, normalizing to Hedges' <em>g</em>.
            </p>
          </div>

          {/* code cell 1 */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 0 58px", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#8a8680", paddingTop: 11 }}>In [1]:</div>
            <div style={{ flex: 1, minWidth: 0, background: "#fff", border: "1px solid #e2e0da", borderLeft: "3px solid #2b5fd1", borderRadius: 6, padding: "11px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, lineHeight: 1.7 }}>
              <pre style={{ margin: 0, color: "#1c1b19" }}>
                <span style={{ color: "#9b2393" }}>import</span> pandas <span style={{ color: "#9b2393" }}>as</span> pd
                {"\n"}
                <span style={{ color: "#9b2393" }}>from</span> extract <span style={{ color: "#9b2393" }}>import</span> parse_effects
                {"\n\n"}
                papers = pd.<span style={{ color: "#326ecc" }}>read_parquet</span>(<span style={{ color: "#c41a16" }}>"corpus/selected.parquet"</span>)
                {"\n"}
                df = <span style={{ color: "#326ecc" }}>parse_effects</span>(papers)
                {"\n"}
                df.<span style={{ color: "#326ecc" }}>head</span>()
              </pre>
            </div>
          </div>

          {/* output: dataframe */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 0 58px", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#b3402e", paddingTop: 9 }}>Out[1]:</div>
            <div style={{ flex: 1, minWidth: 0, overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, background: "#fff", border: "1px solid #e2e0da", borderRadius: 6 }}>
                <thead>
                  <tr style={{ background: "#faf9f6", color: "#57534d" }}>
                    <th style={{ padding: "6px 12px", textAlign: "left", borderBottom: "1px solid #eceae4" }}>study</th>
                    <th style={{ padding: "6px 12px", textAlign: "right", borderBottom: "1px solid #eceae4" }}>g</th>
                    <th style={{ padding: "6px 12px", textAlign: "right", borderBottom: "1px solid #eceae4" }}>var</th>
                    <th style={{ padding: "6px 12px", textAlign: "left", borderBottom: "1px solid #eceae4" }}>domain</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "5px 12px" }}>Kaplan 2024</td>
                    <td style={{ padding: "5px 12px", textAlign: "right" }}>0.56</td>
                    <td style={{ padding: "5px 12px", textAlign: "right" }}>0.012</td>
                    <td style={{ padding: "5px 12px" }}>ML</td>
                  </tr>
                  <tr style={{ background: "#fbfaf8" }}>
                    <td style={{ padding: "5px 12px" }}>Okoro 2023</td>
                    <td style={{ padding: "5px 12px", textAlign: "right" }}>0.42</td>
                    <td style={{ padding: "5px 12px", textAlign: "right" }}>0.018</td>
                    <td style={{ padding: "5px 12px" }}>Bio</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "5px 12px" }}>Petrov 2024</td>
                    <td style={{ padding: "5px 12px", textAlign: "right" }}>0.35</td>
                    <td style={{ padding: "5px 12px", textAlign: "right" }}>0.021</td>
                    <td style={{ padding: "5px 12px" }}>Physics</td>
                  </tr>
                  <tr style={{ background: "#fbfaf8" }}>
                    <td style={{ padding: "5px 12px" }}>Silva 2025</td>
                    <td style={{ padding: "5px 12px", textAlign: "right" }}>0.29</td>
                    <td style={{ padding: "5px 12px", textAlign: "right" }}>0.026</td>
                    <td style={{ padding: "5px 12px" }}>Climate</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* markdown cell */}
          <div style={{ padding: "6px 60px 0" }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 5 }}>Distribution of effects</h2>
            <p style={{ fontSize: 14, color: "#3a3733", lineHeight: 1.6 }}>Quick sanity check before pooling.</p>
          </div>

          {/* code cell 2 */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 0 58px", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#8a8680", paddingTop: 11 }}>In [2]:</div>
            <div style={{ flex: 1, minWidth: 0, background: "#fff", border: "1px solid #e2e0da", borderLeft: "3px solid #2b5fd1", borderRadius: 6, padding: "11px 14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, lineHeight: 1.7 }}>
              <pre style={{ margin: 0, color: "#1c1b19" }}>
                df.<span style={{ color: "#326ecc" }}>effect</span>.<span style={{ color: "#326ecc" }}>hist</span>(bins=<span style={{ color: "#1c00cf" }}>20</span>, color=<span style={{ color: "#c41a16" }}>"#2b5fd1"</span>)
              </pre>
            </div>
          </div>

          {/* output: figure */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 0 58px", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#b3402e", paddingTop: 9 }}>Out[2]:</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 170, background: "#fff", border: "1px solid #e2e0da", borderRadius: 6, display: "flex", alignItems: "flex-end", gap: 5, padding: "16px 18px" }}>
                {[22, 40, 68, 92, 74, 48, 30, 16].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      background: ["#c5d2f0", "#a9bdea", "#7f9fe0", "#2b5fd1", "#7f9fe0", "#a9bdea", "#c5d2f0", "#dbe3f6"][i],
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
