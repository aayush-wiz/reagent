import type { ChangeEvent } from "react";
import { parseStyleString } from "../../lib/parseStyleString";
import type { EnvVal } from "./types";

interface Props {
  resName: string;
  onResName: (e: ChangeEvent<HTMLInputElement>) => void;
  resGoal: string;
  onResGoal: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  envs: EnvVal[];
  backToResearches: () => void;
  createResearch: () => void;
}

export default function NewResearchForm({ resName, onResName, resGoal, onResGoal, envs, backToResearches, createResearch }: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#faf9f6" }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "#fff", borderBottom: "1px solid #e2e0da" }}>
        <button onClick={backToResearches} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e0da", background: "#f4f3ef", color: "#57534d", fontSize: 15, cursor: "pointer" }}>
          ←
        </button>
        <span style={{ fontFamily: "'Google Sans Flex',sans-serif", fontWeight: 600, fontSize: 15 }}>New research</span>
        <div style={{ flex: 1 }} />
        <button onClick={backToResearches} style={{ padding: "8px 15px", border: "1px solid #e2e0da", background: "#f7f6f2", borderRadius: 9, fontSize: 13, color: "#3a3733", cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={createResearch} style={{ padding: "8px 16px", border: "none", background: "#1c1b19", color: "#fff", borderRadius: 9, fontSize: 13, cursor: "pointer" }}>
          Create research
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "26px 20px 48px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 26 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 9 }}>Research name</div>
            <input
              value={resName}
              onChange={onResName}
              placeholder="e.g. Retrieval-Augmented Meta-Analysis"
              style={{ width: "100%", padding: "12px 15px", border: "1px solid #e2e0da", borderRadius: 11, fontFamily: "'Google Sans Flex',sans-serif", fontSize: 15, fontWeight: 500, outline: "none", color: "#1c1b19", background: "#fff" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Goal of the research</div>
            <div style={{ fontSize: 12, color: "#8a8680", marginBottom: 10 }}>What question are you trying to answer? This guides the agent's work.</div>
            <textarea
              value={resGoal}
              onChange={onResGoal}
              placeholder="e.g. Determine whether reported effect sizes for retrieval-augmented methods hold up across domains, and quantify any publication bias."
              style={{ width: "100%", minHeight: 110, resize: "vertical", padding: "13px 15px", border: "1px solid #e2e0da", borderRadius: 12, fontFamily: "inherit", fontSize: 13, lineHeight: 1.55, outline: "none", color: "#1c1b19", background: "#fff" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Compute environment</div>
            <div style={{ fontSize: 12, color: "#8a8680", marginBottom: 12 }}>The runtime notebooks and agents will execute in.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {envs.map((ev) => (
                <div key={ev.id} onClick={ev.select} style={parseStyleString(ev.style)}>
                  <div style={parseStyleString(ev.iconStyle)}>{ev.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.8, fontWeight: 500, color: "#1c1b19" }}>{ev.label}</div>
                    <div style={{ fontSize: 11, color: "#8a8680" }}>{ev.meta}</div>
                  </div>
                  <div style={parseStyleString(ev.radioStyle)}>
                    <div style={parseStyleString(ev.dotStyle)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
