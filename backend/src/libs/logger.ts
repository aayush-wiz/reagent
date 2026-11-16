/**
 * backend/src/libs/logger.ts — tiny structured logger + Hono request log.
 */
import type { MiddlewareHandler } from "hono";

function line(level: string, msg: string, extra?: unknown) {
  const t = new Date().toISOString();
  if (extra !== undefined) console.log(`${t} ${level} ${msg}`, extra);
  else console.log(`${t} ${level} ${msg}`);
}

export const log = {
  info: (msg: string, extra?: unknown) => line("INFO", msg, extra),
  warn: (msg: string, extra?: unknown) => line("WARN", msg, extra),
  error: (msg: string, extra?: unknown) => line("ERROR", msg, extra),
};

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const t0 = Date.now();
  await next();
  log.info(`${c.req.method} ${c.req.path} → ${c.res.status} (${Date.now() - t0}ms)`);
};
