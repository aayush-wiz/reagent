/**
 * src/components/ErrorBoundary.tsx — app-wide crash guard.
 *
 *   React error boundaries must be class components. This catches any render
 *   error below it and shows a graceful fallback (with a reload) instead of a
 *   blank white screen. Wrapped around the whole app in main.tsx.
 */
import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface it in the console for debugging; keep the UI graceful.
    console.error("App crashed:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "#ffffff",
          color: "#1c1b19",
          fontFamily: "'Geist Pixel', system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</div>
        <div style={{ fontSize: 13.5, color: "#847f76", maxWidth: 460, lineHeight: 1.5 }}>
          The page hit an unexpected error. Reloading usually fixes it — your data is safe.
        </div>
        <pre
          style={{
            maxWidth: 560,
            maxHeight: 160,
            overflow: "auto",
            fontSize: 11.5,
            color: "#b3402e",
            background: "#fbeeea",
            border: "1px solid #f0d6cd",
            borderRadius: 8,
            padding: "8px 12px",
            margin: 0,
            textAlign: "left",
            whiteSpace: "pre-wrap",
          }}
        >
          {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4,
            padding: "10px 22px",
            border: "none",
            borderRadius: 8,
            background: "#1c1b19",
            color: "#faf9f6",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
