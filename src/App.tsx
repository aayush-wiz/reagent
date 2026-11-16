import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// AuthPage is kept around but no longer routed to. "/" is the marketing
// LandingPage; "/login" is WelcomeGate (the app itself, gated by an in-place
// onboarding/login modal) — RequireAuth below sends logged-out visitors there.
// import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import WelcomeGate from "./pages/WelcomeGate";
import ArticlePage from "./pages/ArticlePage";
import ArticlesGalleryPage from "./pages/ArticlesGalleryPage";
import WorkspaceShell from "./pages/WorkspaceShell";
import { RunProvider } from "./lib/RunProvider";
import { AuthProvider, RequireAuth } from "./lib/AuthProvider";

export default function App() {
  // Every workspace route renders the same shell, gated behind auth.
  const shell = (
    <RequireAuth>
      <WorkspaceShell />
    </RequireAuth>
  );

  return (
    // RunProvider is above the router so live runs (their sockets + streams)
    // survive navigation — leave a running chat, come back, still streaming.
    <RunProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<WelcomeGate />} />
            {/* <Route path="/signup" element={<AuthPage />} /> */}
            <Route path="/app" element={<Navigate to="/researches" replace />} />
            {/* public shareable article + the public gallery of all published articles */}
            <Route path="/article/:id" element={<ArticlePage />} />
            <Route path="/articles" element={<ArticlesGalleryPage />} />

            {/* authenticated app */}
            <Route path="/chat" element={shell} />
            <Route path="/chat/:id" element={shell} />

            <Route path="/researches" element={shell} />
            <Route path="/researches/new" element={shell} />
            <Route path="/researches/:id" element={shell} />

            {/* the user's own articles (management/preview) — public gallery lives at /articles */}
            <Route path="/my-articles" element={shell} />

            <Route path="/agents" element={shell} />
            <Route path="/agents/new" element={shell} />
            <Route path="/agents/:id" element={shell} />

            <Route path="/skills" element={shell} />
            <Route path="/skills/:id" element={shell} />

            <Route path="/data" element={shell} />
            <Route path="/data/:id" element={shell} />

            <Route path="/notebooks" element={shell} />
            <Route path="/notebooks/:id" element={shell} />

            <Route path="/findings" element={shell} />
            <Route path="/findings/:id" element={shell} />

            <Route path="/papers" element={shell} />
            <Route path="/papers/:id" element={shell} />

            <Route path="/collections" element={shell} />
            <Route path="/collections/:id" element={shell} />

            <Route path="/tools" element={shell} />
            <Route path="/tools/:id" element={shell} />

            <Route path="/tasks" element={shell} />
            <Route path="/tasks/:id" element={shell} />

            <Route path="/reports" element={shell} />
            <Route path="/reports/:id" element={shell} />

            <Route path="/docs" element={shell} />

            <Route path="*" element={<Navigate to="/researches" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </RunProvider>
  );
}
