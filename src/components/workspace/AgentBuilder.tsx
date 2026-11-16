import type { ChangeEvent } from "react";
import { parseStyleString } from "../../lib/parseStyleString";
import type { AutonomyVal, ModelVal, ToggleItemVal } from "./types";

interface Props {
  agentName: string;
  onAgentName: (e: ChangeEvent<HTMLInputElement>) => void;
  agentInstr: string;
  onAgentInstr: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  sources: ToggleItemVal[];
  skills: ToggleItemVal[];
  tools: ToggleItemVal[];
  models: ModelVal[];
  autonomy: AutonomyVal[];
  backToAgents: () => void;
  saveAgent: () => void;
}

function ToggleGrid({ items }: { items: ToggleItemVal[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
      {items.map((item) => (
        <div key={item.label} onClick={item.toggle} style={parseStyleString(item.style)}>
          <div style={parseStyleString(item.iconStyle)}>{item.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.8, fontWeight: 500, color: "#1c1b19" }}>{item.label}</div>
            <div style={{ fontSize: 11, color: "#8a8680" }}>{item.meta}</div>
          </div>
          <div style={parseStyleString(item.checkStyle)}>{item.check}</div>
        </div>
      ))}
    </div>
  );
}

export default function AgentBuilder({
  agentName,
  onAgentName,
  agentInstr,
  onAgentInstr,
  sources,
  skills,
  tools,
  models,
  autonomy,
  backToAgents,
  saveAgent,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#faf9f6" }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "#fff", borderBottom: "1px solid #e2e0da" }}>
        <button onClick={backToAgents} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e0da", background: "#f4f3ef", color: "#57534d", fontSize: 15, cursor: "pointer" }}>
          ←
        </button>
        <span style={{ fontFamily: "'Google Sans Flex',sans-serif", fontWeight: 600, fontSize: 15 }}>New agent</span>
        <div style={{ flex: 1 }} />
        <button onClick={backToAgents} style={{ padding: "8px 15px", border: "1px solid #e2e0da", background: "#f7f6f2", borderRadius: 9, fontSize: 13, color: "#3a3733", cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={saveAgent} style={{ padding: "8px 16px", border: "none", background: "#1c1b19", color: "#fff", borderRadius: 9, fontSize: 13, cursor: "pointer" }}>
          Create agent
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "26px 20px 48px" }}>
        <div style={{ maxWidth: 660, margin: "0 auto", display: "flex", flexDirection: "column", gap: 26 }}>
          {/* identity */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, flex: "0 0 auto", borderRadius: 11, background: "#eef2fc", color: "#2b5fd1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                ✦
              </div>
              <input
                value={agentName}
                onChange={onAgentName}
                placeholder="Agent name, e.g. Meta-Analyst"
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontFamily: "'Google Sans Flex',sans-serif", fontWeight: 600, fontSize: 20, color: "#1c1b19" }}
              />
            </div>
          </div>

          {/* what it should do */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>What should this agent do?</div>
            <div style={{ fontSize: 12, color: "#8a8680", marginBottom: 10 }}>Describe its goal and how it should behave. This becomes its system prompt.</div>
            <textarea
              value={agentInstr}
              onChange={onAgentInstr}
              placeholder="e.g. Continuously monitor the library for new effect-size studies, extract standardized effects, pool them with a random-effects model, and flag any signs of publication bias. Always cite the source paper for each number."
              style={{ width: "100%", minHeight: 118, resize: "vertical", padding: "13px 15px", border: "1px solid #e2e0da", borderRadius: 12, fontFamily: "inherit", fontSize: 13, lineHeight: 1.55, outline: "none", color: "#1c1b19", background: "#fff" }}
            />
          </div>

          {/* data sources */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Which data &amp; papers can it use?</div>
            <div style={{ fontSize: 12, color: "#8a8680", marginBottom: 12 }}>The agent can only read the sources you enable here.</div>
            <ToggleGrid items={sources} />
          </div>

          {/* skills */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Skills</div>
            <div style={{ fontSize: 12, color: "#8a8680", marginBottom: 12 }}>Reusable procedures the agent can invoke.</div>
            <ToggleGrid items={skills} />
          </div>

          {/* tools */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Tools</div>
            <div style={{ fontSize: 12, color: "#8a8680", marginBottom: 12 }}>External capabilities the agent can call.</div>
            <ToggleGrid items={tools} />
          </div>

          {/* model */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Reasoning model</div>
            <div style={{ display: "flex", gap: 9 }}>
              {models.map((md) => (
                <button key={md.name} onClick={md.select} style={parseStyleString(md.style)}>
                  <div style={parseStyleString(md.nameStyle)}>{md.name}</div>
                  <div style={{ fontSize: 11, color: "#8a8680", marginTop: 2 }}>{md.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* autonomy */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Autonomy</div>
            <div style={{ fontSize: 12, color: "#8a8680", marginBottom: 12 }}>How much can it act without you?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {autonomy.map((au) => (
                <button key={au.label} onClick={au.select} style={parseStyleString(au.style)}>
                  {au.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
