/**
 * src/pages/AuthPage.tsx — centered "Log in or sign up".
 *
 *   A single centered column on the landing's white/black + Geist Pixel theme
 *   (no split image). Email-first flow (email → Continue → password / create
 *   account) plus Google / GitHub buttons. Backed by the real email+password auth.
 */
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthProvider";
import { apiCheckEmail } from "../lib/auth";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const CSS = `
.auth-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; width: 100vw; background: #ffffff; color: #1c1b19; font-family: 'Geist Pixel', ui-monospace, monospace; padding: 40px 24px; }
.auth-inner { width: 100%; max-width: 400px; display: flex; flex-direction: column; align-items: center; }
.auth-brand { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 30px; text-decoration: none; }
.auth-mark { display: inline-flex; align-items: center; justify-content: center; color: #1c1b19; }
.auth-word { font-size: 20px; letter-spacing: -0.015em; color: #1c1b19; }
.auth-title { font-size: 30px; color: #1c1b19; margin: 0 0 28px; text-align: center; letter-spacing: -0.02em; line-height: 1.1; }
.auth-card { width: 100%; background: #ffffff; border: 1.5px solid rgba(28,27,25,0.14); border-radius: 0; padding: 26px; }
.auth-email-chip { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: rgba(28,27,25,0.55); margin-bottom: 14px; }
.auth-email-chip button { background: none; border: none; color: #1c1b19; font-size: 12.5px; cursor: pointer; font-family: inherit; text-decoration: underline; }
.auth-field { display: block; width: 100%; padding: 13px 16px; margin-bottom: 12px; border-radius: 0; border: 1.5px solid rgba(28,27,25,0.18); background: #ffffff; color: #1c1b19; font-size: 14px; font-family: inherit; outline: none; transition: border-color .12s; }
.auth-field::placeholder { color: rgba(28,27,25,0.4); }
.auth-field:focus { border-color: #1c1b19; }
.auth-btn { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; padding: 13px 18px; border-radius: 0; font-size: 14px; font-family: inherit; cursor: pointer; border: 1.5px solid transparent; transition: background .12s, border-color .12s; }
.auth-btn:disabled { opacity: .55; cursor: default; }
.auth-primary { background: #1c1b19; color: #ffffff; border: 1.5px solid #1c1b19; }
.auth-primary:hover:not(:disabled) { background: #000000; border-color: #000000; }
.auth-oauth { background: #ffffff; color: #1c1b19; border: 1.5px solid rgba(28,27,25,0.18); margin-top: 10px; }
.auth-oauth:hover { background: #f4f2ee; border-color: rgba(28,27,25,0.3); }
.auth-or { display: flex; align-items: center; gap: 12px; margin: 20px 2px 4px; color: rgba(28,27,25,0.45); font-size: 11px; letter-spacing: 0.14em; }
.auth-or::before, .auth-or::after { content: ""; flex: 1; height: 1px; background: rgba(28,27,25,0.14); }
.auth-msg { font-size: 12.5px; border-radius: 0; padding: 9px 12px; margin-bottom: 12px; line-height: 1.4; }
.auth-msg.err { color: #8a2b1c; background: rgba(179,64,46,0.07); border: 1px solid rgba(179,64,46,0.26); }
.auth-msg.info { color: #33302b; background: rgba(28,27,25,0.05); border: 1px solid rgba(28,27,25,0.16); }
.auth-hint { margin: 16px auto 0; max-width: 400px; text-align: center; font-size: 12.5px; line-height: 1.5; color: rgba(28,27,25,0.5); }
`;

const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);
const GitHubIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.57.1.78-.25.78-.55v-1.9c-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.28 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.2.66.79.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
  </svg>
);

export default function AuthPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/researches";

  const [step, setStep] = useState<"email" | "password">("email");
  const [exists, setExists] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function onContinue(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setInfo("");
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const found = await apiCheckEmail(em);
      setExists(found);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (exists) await login(email.trim().toLowerCase(), password);
      else await signup(email.trim().toLowerCase(), password, name.trim());
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const oauthSoon = () => setInfo("Google and GitHub sign-in aren’t configured yet — continue with email for now.");

  return (
    <div className="auth-wrap">
      <style>{CSS}</style>

      <div className="auth-inner">
        <a href="/" className="auth-brand" aria-label="Reagent">
          <span className="auth-mark">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#1c1b19" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
              <path d="M6.453 15h11.094" />
              <path d="M8.5 2h7" />
            </svg>
          </span>
          <span className="auth-word">reagent</span>
        </a>
        <h1 className="auth-title">Log in or sign up</h1>

        <div className="auth-card">
          {error && <div className="auth-msg err">{error}</div>}
          {info && <div className="auth-msg info">{info}</div>}

          {step === "email" ? (
            <form onSubmit={onContinue}>
              <input
                className="auth-field"
                type="email"
                autoFocus
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <button className="auth-btn auth-primary" type="submit" disabled={busy}>
                {busy ? "Checking…" : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="auth-email-chip">
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setPassword("");
                    setError("");
                  }}
                >
                  Change
                </button>
              </div>
              {!exists && (
                <input
                  className="auth-field"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              )}
              <input
                className="auth-field"
                type="password"
                autoFocus
                placeholder={exists ? "Password" : "Create a password (6+ characters)"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={exists ? "current-password" : "new-password"}
              />
              <button className="auth-btn auth-primary" type="submit" disabled={busy}>
                {busy ? "Please wait…" : exists ? "Log in" : "Create account"}
              </button>
            </form>
          )}

          <div className="auth-or">OR</div>

          <button className="auth-btn auth-oauth" type="button" onClick={oauthSoon}>
            <GoogleIcon />
            Continue with Google
          </button>
          <button className="auth-btn auth-oauth" type="button" onClick={oauthSoon}>
            <GitHubIcon />
            Continue with GitHub
          </button>
        </div>

        <p className="auth-hint">
          {step === "email"
            ? "New here? Enter your email and hit Continue — you’ll set a password to create your account."
            : exists
              ? "Enter your password to log in."
              : "Set a name and password to create your account."}
        </p>
      </div>
    </div>
  );
}
