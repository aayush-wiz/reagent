/**
 * src/lib/auth.ts — client-side auth: token storage, a global fetch wrapper that
 * attaches the bearer token to every /api request, and the auth endpoints.
 *
 * The wrapper means the existing api.ts (~40 bare `fetch("/api/...")` calls) all
 * become authenticated without touching them. Install it once, before render.
 */
const TOKEN_KEY = "reagent_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore (private mode) */
  }
}

let installed = false;
/** Monkey-patch window.fetch to add `Authorization: Bearer <token>` to /api calls. */
export function installAuthFetch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url && (url.startsWith("/api") || url.includes("/api/"))) {
      const token = getToken();
      if (token) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.set("Authorization", `Bearer ${token}`);
        init = { ...init, headers };
      }
    }
    return original(input as RequestInfo, init);
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

async function unwrap(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

/** Email-first: does an account with this email already exist? */
export async function apiCheckEmail(email: string): Promise<boolean> {
  const data = await unwrap(
    await fetch("/api/auth/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })
  );
  return !!data.exists;
}

export async function apiLogin(email: string, password: string): Promise<AuthUser> {
  const data = await unwrap(
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  );
  setToken(data.token);
  return data.user as AuthUser;
}

export async function apiSignup(email: string, password: string, name: string): Promise<AuthUser> {
  const data = await unwrap(
    await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    })
  );
  setToken(data.token);
  return data.user as AuthUser;
}

export async function apiMe(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  const res = await fetch("/api/auth/me");
  if (!res.ok) {
    setToken(null);
    return null;
  }
  const data = await res.json();
  return data.user as AuthUser;
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  setToken(null);
}

/**
 * "Continue with Google" — opens /api/auth/google/start (Composio-managed OAuth,
 * see backend/src/routes/auth.ts) in a popup. The popup's callback page posts
 * back { type: "reagent-google-login", token, user } to this window and closes
 * itself; we store the token and resolve with the user, same shape as apiLogin.
 */
export function googleLoginPopup(): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    const w = 480;
    const h = 640;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open("/api/auth/google/start", "reagent-google-login", `width=${w},height=${h},left=${left},top=${top}`);
    if (!popup) {
      reject(new Error("Pop-up was blocked — allow pop-ups for this site and try again."));
      return;
    }

    let settled = false;
    const cleanup = () => {
      settled = true;
      window.removeEventListener("message", onMessage);
      clearInterval(poll);
    };

    const onMessage = (event: MessageEvent) => {
      // The popup's callback page is served from the API origin, which can differ
      // from this page's own origin (e.g. :8181 vs :5173 in dev) — so comparing
      // event.origin to window.location.origin would always fail. Checking the
      // message's source against the exact popup window we opened is origin-agnostic
      // and just as safe: only that window (which we hold a reference to) can match.
      if (event.source !== popup) return;
      const data = event.data as { type?: string; token?: string; user?: AuthUser; message?: string } | null;
      if (!data || settled) return;
      if (data.type === "reagent-google-login" && data.token && data.user) {
        cleanup();
        setToken(data.token);
        resolve(data.user);
      } else if (data.type === "reagent-google-login-error") {
        cleanup();
        reject(new Error(data.message || "Google sign-in failed."));
      }
    };
    window.addEventListener("message", onMessage);

    // The popup closing (either by the user, or right after it posts a message
    // and calls window.close()) is the only reliable "done" signal cross-origin.
    const poll = window.setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error("Google sign-in was cancelled."));
      }
    }, 500);
  });
}

/** Pick up the `?gtoken=` fallback (popup blocked → full-page redirect back). */
export function consumeGoogleLoginRedirect(): string | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("gtoken");
  if (!token) return null;
  url.searchParams.delete("gtoken");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  setToken(token);
  return token;
}
