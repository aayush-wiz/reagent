/**
 * routes/auth.ts — accounts + sessions.
 *
 *   POST /api/auth/signup         { email, password, name? } → { user, token }
 *   POST /api/auth/login          { email, password }        → { user, token }
 *   GET  /api/auth/me                                        → { user }   (from bearer)
 *   POST /api/auth/logout                                    → { ok }     (revoke token)
 *   GET  /api/auth/google/start                               → 302 to Composio's Google consent
 *   GET  /api/auth/google/callback?sid=…                      → tiny HTML page that hands the
 *                                                                 popup's opener a { token, user }
 *
 * These paths are exempt from the auth middleware (see middleware/auth.ts).
 */
import type { Hono } from "hono";
import { nanoid } from "nanoid";
import { bearerToken } from "../middlewares/auth.ts";
import { createUser, authenticate, issueToken, userForToken, revokeToken, findUserByEmail, findOrCreateUserByEmail } from "../services/auth.ts";
import { initiateGoogleLogin, getConnectedGoogleEmail, disconnectSession } from "../libs/composio.ts";
import { env } from "../env.ts";
import { log } from "../libs/logger.ts";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function registerAuthRoutes(app: Hono): void {
  app.post("/api/auth/signup", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string; name?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    if (!EMAIL_RE.test(email)) return c.json({ error: "Enter a valid email address." }, 400);
    if (password.length < 6) return c.json({ error: "Password must be at least 6 characters." }, 400);
    if (findUserByEmail(email)) return c.json({ error: "An account with that email already exists." }, 409);
    const user = await createUser({ email, password, name });
    const token = issueToken(user.id);
    return c.json({ user, token }, 201);
  });

  // Email-first flow: does an account with this email already exist? Drives the
  // "Log in or sign up" combined page (email → Continue → password or create).
  app.post("/api/auth/check", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return c.json({ error: "Enter a valid email address." }, 400);
    return c.json({ exists: !!findUserByEmail(email) });
  });

  app.post("/api/auth/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const user = await authenticate(email, password);
    if (!user) return c.json({ error: "Invalid email or password." }, 401);
    const token = issueToken(user.id);
    return c.json({ user, token });
  });

  app.get("/api/auth/me", (c) => {
    const user = userForToken(bearerToken(c));
    if (!user) return c.json({ error: "unauthorized" }, 401);
    return c.json({ user });
  });

  app.post("/api/auth/logout", (c) => {
    revokeToken(bearerToken(c));
    return c.json({ ok: true });
  });

  // "Continue with Google" — the browser is opened as a popup pointed straight at
  // this route. `sid` is a throwaway nonce (not a real user id yet); it's what
  // correlates this redirect round-trip through Composio back to /callback below.
  app.get("/api/auth/google/start", async (c) => {
    const sid = nanoid(24);
    const callbackUrl = `${env.API_ORIGIN}/api/auth/google/callback?sid=${sid}`;
    try {
      const redirectUrl = await initiateGoogleLogin(sid, callbackUrl);
      return c.redirect(redirectUrl, 302);
    } catch (e) {
      log.error("google login: could not start", e);
      return c.html(popupErrorPage("Could not start Google sign-in. Please try again.", env.APP_ORIGIN));
    }
  });

  app.get("/api/auth/google/callback", async (c) => {
    const sid = String(c.req.query("sid") ?? "");
    if (!sid) return c.html(popupErrorPage("Missing session — please try again.", env.APP_ORIGIN));
    try {
      const email = await getConnectedGoogleEmail(sid);
      disconnectSession(sid); // fire-and-forget cleanup — we only needed identity
      if (!email) return c.html(popupErrorPage("Google didn't return an email address.", env.APP_ORIGIN));
      const user = await findOrCreateUserByEmail(email);
      const token = issueToken(user.id);
      return c.html(popupSuccessPage(env.APP_ORIGIN, token, user));
    } catch (e) {
      log.error("google login: callback failed", e);
      return c.html(popupErrorPage("Google sign-in failed. Please try again.", env.APP_ORIGIN));
    }
  });
}

// The popup hands its result back to the WelcomeGate window via postMessage,
// targeted at the real app origin (this route is served from the API origin,
// which can differ — see env.APP_ORIGIN), then closes itself. If it wasn't
// opened as a popup (no opener — e.g. popup blocked and the link was followed
// directly), fall back to a full redirect carrying the token in the URL.
function popupSuccessPage(appOrigin: string, token: string, user: { id: string; email: string; name: string }): string {
  const payload = JSON.stringify({ type: "reagent-google-login", token, user });
  const fallbackUrl = `${appOrigin.replace(/\/$/, "")}/?gtoken=${encodeURIComponent(token)}`;
  return (
    `<!doctype html><meta charset="utf-8"><title>Signed in</title>` +
    `<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">` +
    `<div style="text-align:center"><h2>✓ Signed in</h2><p>Returning to Reagent…</p></div>` +
    `<script>
      var payload = ${payload};
      if (window.opener) {
        window.opener.postMessage(payload, ${JSON.stringify(appOrigin)});
        window.close();
      } else {
        location.href = ${JSON.stringify(fallbackUrl)};
      }
    </script></body>`
  );
}

function popupErrorPage(message: string, appOrigin: string): string {
  return (
    `<!doctype html><meta charset="utf-8"><title>Sign-in failed</title>` +
    `<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">` +
    `<div style="text-align:center;max-width:360px"><h2>Sign-in failed</h2><p>${message}</p></div>` +
    `<script>
      if (window.opener) window.opener.postMessage({ type: "reagent-google-login-error", message: ${JSON.stringify(message)} }, ${JSON.stringify(appOrigin)});
      setTimeout(function(){ window.close(); }, 4000);
    </script></body>`
  );
}
