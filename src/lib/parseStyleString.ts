import type { CSSProperties } from "react";

/**
 * Converts a CSS text string (e.g. `"padding:11px 14px; background:#fff;"`) into a
 * React.CSSProperties object so it can be used with the `style` prop.
 *
 * The original "dc" templates built style strings dynamically with template literals
 * (e.g. `` `padding:11px 14px; background:${on?"#eef2fc":"#fff"};` ``). Rather than hand
 * converting every one of those into a JS object, we keep the original string-building
 * logic almost verbatim and run the result through this utility at render time.
 */
export function parseStyleString(css: string | undefined | null): CSSProperties {
  if (!css) return {};
  const result: Record<string, string> = {};

  for (const rawDecl of css.split(";")) {
    const decl = rawDecl.trim();
    if (!decl) continue;

    const colonIndex = decl.indexOf(":");
    if (colonIndex === -1) continue;

    const prop = decl.slice(0, colonIndex).trim();
    const value = decl.slice(colonIndex + 1).trim();
    if (!prop || !value) continue;

    const camelProp = prop.startsWith("--")
      ? prop
      : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

    result[camelProp] = value;
  }

  return result as CSSProperties;
}
