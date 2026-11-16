/**
 * backend/src/middleware/auth.ts — gate /api/* behind a bearer token.
 *
 *   Registered once on /api/* (see server.ts). It resolves `Authorization:
 *   Bearer <token>` to a user and stashes it on the context (c.get("userId")).
 *   Public paths (auth + health) pass through unauthenticated; everything else
 *   401s without a valid token. Route handlers read c.get("userId") to scope data.
 */
import type { Context, Next } from "hono";
import { userForToken } from "../services/auth.ts";

// Prefixes that must work WITHOUT a token (login/signup/me/logout + health check).
const PUBLIC_PREFIXES = ["/api/auth", "/api/health", "/api/public"];

export function bearerToken(c: Context): string {
  const h = c.req.header("authorization") || c.req.header("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export async function authMiddleware(c: Context, next: Next) {
  const user = userForToken(bearerToken(c));
  if (user) {
    c.set("userId", user.id);
    c.set("user", user);
  }
  const path = c.req.path;
  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));
  if (!isPublic && !user) return c.json({ error: "unauthorized" }, 401);
  await next();
}
