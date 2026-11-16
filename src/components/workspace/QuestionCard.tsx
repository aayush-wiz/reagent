/**
 * QuestionCard — renders a pending `ask_user` tool call from the live run and
 * collects the user's answers. When the agent calls `ask_user`, the run parks in
 * the worker; this card steps through the questions (options + custom answer) and
 * POSTs the answers back (api.answerAsk) to unblock the agent.
 */
import { useState } from "react";
import type { StreamPart } from "../../lib/partsReducer";

export type AskQuestion = { question: string; options?: string[] };
export type AskInput = { intro?: string; questions: AskQuestion[] };

/** Find a pending ask_user tool call (input ready, no answer yet) in the live parts. */
export function pendingAsk(parts: StreamPart[]): { toolCallId: string; input: AskInput } | null {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i] as StreamPart & { toolName?: string; state?: string; toolCallId?: string; input?: AskInput };
    if (p.type === "tool-ask_user" && p.state === "input-available" && p.toolCallId && p.input?.questions?.length) {
      return { toolCallId: p.toolCallId, input: p.input };
    }
    // A completed ask (has output) means it was already answered — stop looking.
    if (p.type === "tool-ask_user" && p.state === "output-available") return null;
  }
  return null;
}

const SAGE = "#3F7355";

export function QuestionCard({
  input,
  onSubmit,
  submitting,
}: {
  input: AskInput;
  onSubmit: (answers: { question: string; answer: string }[]) => void;
  submitting?: boolean;
}) {
  const questions = input.questions || [];
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const q = questions[idx];
  const last = idx === questions.length - 1;
  if (!q) return null;

  const setAnswer = (a: string) => setAnswers((arr) => arr.map((x, i) => (i === idx ? a : x)));
  const answered = (answers[idx] || "").trim().length > 0;
  const submitAll = () => onSubmit(questions.map((qq, i) => ({ question: qq.question, answer: (answers[i] || "").trim() })));
  const next = () => (last ? submitAll() : setIdx((i) => Math.min(questions.length - 1, i + 1)));

  return (
    <div style={{ maxWidth: 720, margin: "6px auto 10px", border: "1px solid #e2e0da", background: "#fff", boxShadow: "0 1px 3px rgba(28,27,25,0.05)" }}>
      <div style={{ padding: "13px 16px 8px" }}>
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SAGE, marginBottom: 8 }}>
          Question {idx + 1} of {questions.length}
        </div>
        {input.intro && idx === 0 && <div style={{ fontSize: 12.5, color: "#8a8680", marginBottom: 8 }}>{input.intro}</div>}
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1c1b19" }}>{q.question}</div>
      </div>

      <div style={{ padding: "0 10px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
        {(q.options || []).map((opt, i) => {
          const on = answers[idx] === opt;
          return (
            <button
              key={i}
              onClick={() => setAnswer(opt)}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", textAlign: "left", border: "none", background: on ? "#eef2ee" : "transparent", cursor: "pointer", fontFamily: "inherit" }}
            >
              <span style={{ display: "grid", placeItems: "center", flex: "0 0 auto", width: 24, height: 24, borderRadius: "50%", border: `1px solid ${on ? SAGE : "#d9d6cf"}`, background: on ? SAGE : "#f7f6f2", color: on ? "#fff" : "#8a8680", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, fontWeight: 700 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 13.5, color: "#1c1b19", fontWeight: on ? 600 : 400 }}>{opt}</span>
            </button>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 11px" }}>
          <span style={{ display: "grid", placeItems: "center", flex: "0 0 auto", width: 24, height: 24, borderRadius: "50%", border: "1px solid #d9d6cf", background: "#f7f6f2", color: "#8a8680", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, fontWeight: 700 }}>
            {(q.options?.length || 0) + 1}
          </span>
          <input
            value={q.options?.includes(answers[idx]) ? "" : answers[idx]}
            onChange={(e) => setAnswer(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && answered) {
                e.preventDefault();
                next();
              }
            }}
            placeholder={q.options?.length ? "Or type your own…" : "Type your answer…"}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13.5, color: "#1c1b19" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, borderTop: "1px solid #f1efe9", padding: "9px 16px" }}>
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          style={{ border: "none", background: "none", padding: 0, fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: idx === 0 ? "#c4c1b9" : "#8a8680", cursor: idx === 0 ? "default" : "pointer" }}
        >
          ‹ Back
        </button>
        <span style={{ fontSize: 11.5, color: "#b0aca4" }}>{idx + 1} / {questions.length}</span>
        <button
          onClick={next}
          disabled={!answered || submitting}
          style={{ border: "none", background: "none", padding: 0, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: answered && !submitting ? SAGE : "#c4c1b9", cursor: answered && !submitting ? "pointer" : "default" }}
        >
          {submitting ? "Sending…" : last ? "Submit answers" : "Next ›"}
        </button>
        <span style={{ flex: 1 }} />
        {!last && (
          <button
            onClick={submitAll}
            disabled={submitting}
            style={{ border: "1px solid #e2e0da", background: "#f7f6f2", padding: "5px 11px", fontFamily: "inherit", fontSize: 11.5, fontWeight: 500, color: "#57534d", cursor: "pointer" }}
          >
            Skip rest & submit
          </button>
        )}
      </div>
    </div>
  );
}
