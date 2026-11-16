/**
 * src/lib/AuthProvider.tsx — auth context + route guard.
 *
 *   <AuthProvider> loads the current user once (via the stored token) and exposes
 *   { user, loading, login, signup, logout }. <RequireAuth> gates the app: it
 *   redirects to "/" (WelcomeGate — the app blurred behind an onboarding/login
 *   modal) when logged out, and shows a light splash while loading.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { apiLogin, apiSignup, apiLogout, apiMe, consumeGoogleLoginRedirect, type AuthUser } from "./auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Sync context state directly from a Google-login popup result — no extra round-trip. */
  applySession: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // Popups-blocked fallback: /api/auth/google/callback redirected the whole
    // tab back with ?gtoken=… — consume it (sets the token) before apiMe() below.
    consumeGoogleLoginRedirect();
    apiMe()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const login = async (email: string, password: string) => setUser(await apiLogin(email, password));
  const signup = async (email: string, password: string, name: string) => setUser(await apiSignup(email, password, name));
  const logout = async () => {
    await apiLogout();
    setUser(null);
  };
  const applySession = (u: AuthUser) => setUser(u);

  return <AuthContext.Provider value={{ user, loading, login, signup, logout, applySession }}>{children}</AuthContext.Provider>;
}

const splashStyle: React.CSSProperties = {
  height: "100vh",
  width: "100vw",
  display: "grid",
  placeItems: "center",
  background: "#ffffff",
  color: "#847f76",
  fontFamily: "'Geist Pixel', system-ui, sans-serif",
  fontSize: 14,
};

/** Wrap the app routes: bounce to "/login" (the login-gated WelcomeGate) when there's no session. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={splashStyle}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
