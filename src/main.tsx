import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
// pdf.js text/annotation layer styles — position the selectable text layer
// transparently OVER the PDF canvas (else it dumps below as visible text).
// Same fix answerThis uses (it imports react-pdf's TextLayer.css/AnnotationLayer.css).
import "pdfjs-dist/web/pdf_viewer.css";
import { MantineProvider, createTheme } from "@mantine/core";
import App from "./App";
import DashboardPreview from "./pages/DashboardPreview";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installAuthFetch } from "./lib/auth";
import "./index.css";

// Attach the bearer token to every /api request (must run before any api call).
installAuthFetch();

const theme = createTheme({
  fontFamily: "'Geist Pixel', ui-monospace, monospace",
  fontFamilyMonospace: "'IBM Plex Mono', ui-monospace, monospace",
  headings: { fontFamily: "'Geist Pixel', ui-monospace, monospace", fontWeight: "400" },
  primaryColor: "terracotta",
  primaryShade: 6,
  defaultRadius: "md",
  cursorType: "pointer",
  // Warm terracotta accent + a neutral warm-gray, to match the professional reference.
  colors: {
    terracotta: ["#fbf2ed", "#f3ddd1", "#e8bda8", "#dd9b7d", "#d47f5a", "#cd6d44", "#c2562e", "#a8481f", "#8e3d1c", "#762f14"],
    warm: ["#faf9f6", "#f4f3ef", "#e9e7e0", "#ddd9cf", "#c4bfb2", "#a29e97", "#847f76", "#57534d", "#3a3733", "#1c1b19"],
  },
  // Compact type scale matching the inline-styled left/middle columns.
  fontSizes: {
    xs: "10.5px",
    sm: "12.5px",
    md: "13.5px",
    lg: "15px",
    xl: "17px",
  },
});

// The landing hero embeds the real dashboard (filled with dummy data) in a
// browser-window frame via <iframe src="/index.html?preview=dashboard">. That
// loads this same entry, so we render the standalone DashboardPreview instead
// of the full app — no router route, just a mount-point branch.
const isDashboardPreview = new URLSearchParams(window.location.search).get("preview") === "dashboard";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <ErrorBoundary>{isDashboardPreview ? <DashboardPreview /> : <App />}</ErrorBoundary>
    </MantineProvider>
  </React.StrictMode>
);
