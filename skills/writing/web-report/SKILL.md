---
name: web-report
description: "Design and build a professional, self-contained WEBSITE that presents a research result — a polished single HTML page (hero, findings, inline figures/plots, tables, references) ready to publish with the publish_site tool. Use this skill whenever the user asks to make/publish a web page or website of the research. Covers real typography (font pairings), color/background palettes, layout structure, responsive + self-contained output, and how to avoid generic AI-looking design. Not a template — it gives you the design system to author bespoke code from the research's own content."
license: MIT
metadata: {"version": "1.0", "skill-author": "Reagent", "adapted-from": "anthropics/skills frontend-design + Claude artifact-design"}
---

# Web Report — publish a research as a professional website

You are the design lead building a **single, self-contained web page** that presents this research. The visitor
scans it like a good long-form article or a product page — not a raw report dump. Your job is to author bespoke
HTML/CSS from the research's own content (findings, figures, tables), make deliberate design choices, then
publish it. **There is no template — the quality and look are yours.**

Output target: one file at `outputs/site.html`, then `publish_site(path: "outputs/site.html", title: "…")`.

---

## Process (do this, don't skip to code)

1. **Gather the material.** `list_docs`/`read_doc` the report + findings; `list_files` / check `figures/` for the
   plots and diagrams you'll show inline. Know what you're presenting before you design it.
2. **Make a 4-line design plan** (write it in your reasoning, then follow it):
   - **Palette**: 4–6 named hex values (a chosen neutral ground, ink text, 1 accent, borders).
   - **Type**: a display face + a body face (2 roles) — a real pairing, see below.
   - **Layout**: one sentence on the structure (hero → summary → findings → figures → tables → references).
   - **Signature**: the one distinctive element (a bold hero, a findings grid, a ranked table) — spend your
     boldness there, keep everything else quiet.
3. **Write the page** with `write_file("outputs/site.html", …)` — full `<!doctype html>`, an inline `<style>`
   block, and `<img src="figures/plot.png">` for each diagram. Re-read it, refine, iterate.
4. **Publish**: `publish_site(path: "outputs/site.html", title: "…")` → returns the live URL. Re-run to update
   the same URL.

---

## Typography — pick a real pairing (never Inter / Roboto / Arial)

The page is served online, so load webfonts with a Google Fonts `<link>` in `<head>`, and always give a system
fallback. Pair a **display** face (headings) with a **body** face (running text). Good pairings for a serious
research site — pick one that fits the subject, don't default:

| Character | Display (headings) | Body (text) |
|---|---|---|
| Editorial / authoritative | **Fraunces** (opsz serif) | **Source Serif 4** or **Newsreader** |
| Modern scientific | **Schibsted Grotesk** | **Newsreader** (serif body) |
| Clean technical | **Space Grotesk** *(sparingly)* or **IBM Plex Sans** | **IBM Plex Serif** |
| Humanist / policy | **Libre Franklin** (700/800) | **Public Sans** |

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Newsreader:wght@400;500&display=swap" rel="stylesheet">
```
Rules: running text ~62–72 characters wide; set a type scale and stay on it; `text-wrap: balance` on headings;
uppercase eyebrow labels get letter-spacing; body line-height ~1.6–1.7.

---

## Color & background — choose a neutral, don't inherit one

Pick a ground on purpose. A pure `#ffffff` or `#808080` reads as unconsidered; bias the neutral slightly toward
the accent so it looks chosen. Concrete palettes (use as starting points, adapt to the subject):

- **Warm paper**: bg `#FBFAF7`, ink `#1A1917`, muted `#6B6459`, accent `#3F7355` (sage) or `#B3402E` (clay), border `#E7E3DB`.
- **Cool slate**: bg `#F7F8FA`, ink `#141821`, muted `#5B6473`, accent `#2F6DB0`, border `#E2E6EC`.
- **Deep editorial** (single-theme, committed): bg `#14140F`, text `#EDE9DF`, muted `#9A9384`, accent `#C7A24C`.

Give figures a `#fff` backing + hairline border so plots don't float on a tinted ground. One accent only — if it
fights the ground, drop its saturation rather than adding a second.

---

## Structure for a research page

Compose from the research; not every section is mandatory, but this is the spine:
1. **Hero** — the research question as the headline (`text-wrap: balance`), a one-line subtitle/finding, date.
2. **Executive summary / the tension** — 2–4 sentences: what was asked, what was found.
3. **Key findings** — cards or a list; each finding with its evidence; color a chip by confirmed vs. caveat.
4. **Figures inline** — every plot/diagram from `figures/` shown at readable size with a caption.
5. **Comparison / results** — tables (rankings, options, numbers) with `tabular-nums`; wrap wide tables in an
   `overflow-x:auto` container so the page body never scrolls sideways.
6. **References** — the citation list, linked.

---

## Self-contained + responsive (required)

- **Inline all CSS** in one `<style>` block. No external CSS/JS except the Google Fonts link.
- **Figures**: reference them with relative paths (`figures/…`); `publish_site` embeds them into the page as
  data URIs, so the published page is fully self-contained. Give `img { max-width:100%; height:auto }`.
- **Responsive**: relative units, flex/grid with `gap`, collapse multi-column layouts on mobile. The body must
  never scroll horizontally — wide tables/code get their own `overflow-x:auto` wrapper.
- **Both themes** (nice-to-have): support `@media (prefers-color-scheme: dark)` by defining the palette as CSS
  custom properties and redefining only the tokens in the dark block.

---

## Avoid the generic AI look

Where the brief leaves a choice free, don't spend it on these tells:
- Everything centered; uniform `border-radius` on every card; a purple→blue gradient hero on white.
- The warm-cream `#F4F1EA` + serif + terracotta cluster; near-black + one acid-green pop; Inter/Space-Grotesk as the "safe" face.
- Emoji as section markers; numbered `01 / 02 / 03` markers when the content isn't actually a sequence.
Structure (eyebrows, dividers, numbering) must encode something true about the content, not decorate it.

**Bottom line:** design it as if a real studio made it for this specific research — then `write_file` the page
and `publish_site` it.
