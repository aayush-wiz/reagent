/**
 * backend/src/services/auth.ts — accounts + bearer tokens.
 *
 *   The root of per-user ownership. Passwords are hashed with scrypt (node:crypto,
 *   no native deps) as "salt:hash"; the plaintext is never stored. Login/signup
 *   issue an opaque token (auth_tokens) that the middleware resolves to a user.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";

// Async scrypt — same algorithm/params as scryptSync (so existing "salt:hash"
// values still verify), but off the event loop so thousands of concurrent
// logins/signups don't each block ~50-100ms of CPU on the main thread.
const scrypt = promisify(scryptCb) as (pw: string, salt: string, keylen: number) => Promise<Buffer>;
import { nanoid } from "nanoid";
import { db } from "../repositories/db-client.ts";
import { users, authTokens } from "../models/schema.ts";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const dk = (await scrypt(pw, salt, 64)).toString("hex");
  return `${salt}:${dk}`;
}

async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [salt, dk] = stored.split(":");
  if (!salt || !dk) return false;
  const expected = Buffer.from(dk, "hex");
  const actual = await scrypt(pw, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function toPublic(u: { id: string; email: string; name: string }): PublicUser {
  return { id: u.id, email: u.email, name: u.name };
}

export function findUserByEmail(email: string) {
  return db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
}

export function getUser(id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/** Create an account. Caller must have already validated + checked for duplicates. */
export async function createUser(input: { email: string; password: string; name?: string }): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const id = `u_${nanoid(12)}`;
  const name = (input.name ?? "").trim() || email.split("@")[0];
  const passwordHash = await hashPassword(input.password);
  db.insert(users).values({ id, email, name, passwordHash }).run();
  return toPublic(getUser(id)!);
}

/**
 * Find-or-create for the Google login flow (routes/auth.ts): the caller only has a
 * verified email, no password. A new account gets a random, never-shared password
 * hash — it satisfies the NOT NULL column but can't be logged into via the password
 * form, so "Continue with Google" stays the only way in for that account.
 */
export async function findOrCreateUserByEmail(email: string): Promise<PublicUser> {
  const existing = findUserByEmail(email);
  if (existing) return toPublic(existing);
  return createUser({ email, password: randomBytes(24).toString("hex") });
}

/** Verify credentials. Returns the public user, or null if they don't match. */
export async function authenticate(email: string, password: string): Promise<PublicUser | null> {
  const u = findUserByEmail(email);
  if (!u || !(await verifyPassword(password, u.passwordHash))) return null;
  return toPublic(u);
}

/** Issue a fresh bearer token for a user (persisted so it can be revoked). */
export function issueToken(userId: string): string {
  const token = randomBytes(32).toString("hex");
  db.insert(authTokens).values({ token, userId }).run();
  return token;
}

/** Tokens expire 30 days after issue. */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Resolve a bearer token back to its user, or null if unknown/revoked/expired. */
export function userForToken(token: string): PublicUser | null {
  if (!token) return null;
  const row = db.select().from(authTokens).where(eq(authTokens.token, token)).get();
  if (!row) return null;
  if (Date.now() - row.createdAt > TOKEN_TTL_MS) {
    revokeToken(token); // expired — clean it up
    return null;
  }
  const u = getUser(row.userId);
  return u ? toPublic(u) : null;
}

/** Revoke a token (logout). */
export function revokeToken(token: string): void {
  if (token) db.delete(authTokens).where(eq(authTokens.token, token)).run();
}
