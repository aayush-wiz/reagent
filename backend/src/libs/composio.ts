/**
 * backend/src/libs/composio.ts — "Continue with Google" via Composio's managed OAuth,
 * ported from the same pattern in ../../../applyloop/server/libs/composio.ts.
 *
 * Why Composio, not Google's own OAuth: Google's own path needs app verification
 * for meaningful scopes. Composio is a managed-auth broker with a pre-verified
 * app — we hand it a session id, it hands back a consent redirect URL; after the
 * user consents, Composio holds the token and we read the connected account's
 * Gmail profile back for its `emailAddress`. Unlike applyloop (which connects an
 * already-known, already-logged-in user's Gmail), this is used BEFORE a session
 * exists: the `sessionId` is a throwaway nonce minted by routes/auth.ts, used only
 * to correlate the redirect round-trip. See routes/auth.ts for how the resulting
 * email becomes a real Reagent account + token.
 */
import { Composio } from "@composio/core";

const API_KEY = process.env.COMPOSIO_API_KEY?.trim() || "ak_Foib1iWvyvfRJOVL87sR";

let client: Composio | null = null;
function composio(): Composio {
  if (client) return client;
  client = new Composio({ apiKey: API_KEY });
  return client;
}

// Composio refuses manual tools.execute without a pinned toolkit version
// ("latest" is rejected for non-agent flows) — discover once and cache.
let gmailVersion: string | null = null;
async function toolkitVersion(): Promise<string> {
  if (gmailVersion) return gmailVersion;
  const r = await fetch("https://backend.composio.dev/api/v3/toolkits/gmail", { headers: { "X-API-KEY": API_KEY } });
  if (!r.ok) throw new Error(`Could not look up gmail toolkit version: ${r.status}`);
  const j: any = await r.json();
  if (!j?.meta?.version) throw new Error("gmail toolkit returned no version");
  gmailVersion = j.meta.version;
  return gmailVersion!;
}

// Auth config: env override → in-process cache → lazy-create with Composio's
// managed OAuth app.
let cachedAuthConfigId: string | null = null;
async function authConfigId(): Promise<string> {
  const fromEnv = process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
  if (fromEnv) return fromEnv;
  if (cachedAuthConfigId) return cachedAuthConfigId;
  try {
    const created: any = await composio().authConfigs.create("GMAIL", {
      name: "reagent-google-login",
      type: "use_composio_managed_auth",
      authScheme: "OAUTH2",
    } as any);
    const id = created?.id || created?.auth_config_id || created?.authConfigId;
    if (!id) throw new Error("auth config created but no id returned");
    cachedAuthConfigId = id;
    return id;
  } catch (e) {
    try {
      const list: any = await (composio() as any).authConfigs.list({ toolkit: "GMAIL" } as any);
      const items = list?.items || list?.data || [];
      const match = items.find((x: any) => String(x.toolkit?.slug || x.toolkit || "").toUpperCase() === "GMAIL");
      if (match?.id) {
        cachedAuthConfigId = match.id;
        return match.id;
      }
    } catch {
      /* fall through */
    }
    throw new Error(`Could not create/find a Composio Google auth config: ${e instanceof Error ? e.message : e}`);
  }
}

/** Start the OAuth consent for a throwaway session id — returns the redirect URL for the popup. */
export async function initiateGoogleLogin(sessionId: string, callbackUrl: string): Promise<string> {
  const req: any = await composio().connectedAccounts.initiate(sessionId, await authConfigId(), { callbackUrl });
  const url = req.redirectUrl || req.redirect_url || req.redirectURL;
  if (!url) throw new Error("Composio did not return a redirect URL");
  return url;
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
function deepFindEmail(v: any, depth = 0): string | null {
  if (v == null || depth > 6) return null;
  if (typeof v === "string") return EMAIL_RE.test(v.trim()) ? v.trim() : null;
  if (Array.isArray(v)) {
    for (const i of v) {
      const e = deepFindEmail(i, depth + 1);
      if (e) return e;
    }
    return null;
  }
  if (typeof v === "object") {
    for (const k of ["emailAddress", "email", "email_address"]) {
      if (typeof v[k] === "string" && EMAIL_RE.test(v[k])) return v[k].trim();
    }
    for (const k of Object.keys(v)) {
      const e = deepFindEmail(v[k], depth + 1);
      if (e) return e;
    }
  }
  return null;
}

/**
 * After the consent redirect lands, resolve the connected account's Google email.
 * The connection can take a moment to go ACTIVE right after redirect — retry briefly.
 */
export async function getConnectedGoogleEmail(sessionId: string): Promise<string | null> {
  const version = await toolkitVersion();
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const result: any = await composio().tools.execute("GMAIL_GET_PROFILE", { userId: sessionId, version, arguments: {} } as any);
      const email = deepFindEmail(result);
      if (email) return email;
    } catch {
      /* not ACTIVE yet — retry */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/** Best-effort cleanup — we only needed identity, not ongoing Gmail access. */
export async function disconnectSession(sessionId: string): Promise<void> {
  try {
    const raw: any = await composio().connectedAccounts.list({ userIds: [sessionId] } as any);
    const items: any[] = raw?.items || raw?.data || raw || [];
    for (const a of items) await composio().connectedAccounts.delete(String(a.id));
  } catch {
    /* best effort */
  }
}
