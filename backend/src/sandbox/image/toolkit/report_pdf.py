#!/usr/bin/env python3
"""Render a Markdown research report into a professional PDF.

The sandbox ships pandoc + a LaTeX engine (pdflatex), so a report authored in
Markdown is typeset the same way AI-Scientist-v2 compiles its LaTeX — real
LaTeX output (proper typography, math, tables, figures), just authored from
Markdown instead of raw .tex.

Usage (run inside the sandbox):
    python -m report_pdf INPUT.md OUTPUT.pdf --title "Enterprise AI Agents — Market Map"
    python -m report_pdf outputs/report.md outputs/report.pdf \
        --title "..." --author "Reagent" --subtitle "..." --date "July 2026"

Notes:
  • Reference figures with relative paths (figures/foo.png); they embed.
  • On a build failure the LaTeX error is printed — fix the Markdown and re-run.
  • --no-toc drops the table of contents (default is on, depth 2).
"""
import argparse
import os
import shutil
import subprocess
import sys

HEADER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "report_header.tex")


def main() -> None:
    ap = argparse.ArgumentParser(description="Markdown research report → professional PDF.")
    ap.add_argument("input", help="Markdown source (e.g. outputs/report.md)")
    ap.add_argument("output", help="PDF to write (e.g. outputs/report.pdf)")
    ap.add_argument("--title", default="Research Report")
    ap.add_argument("--author", default="Reagent")
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--date", default="")
    ap.add_argument("--no-toc", action="store_true", help="Drop the table of contents.")
    a = ap.parse_args()

    if not shutil.which("pandoc"):
        sys.exit("pandoc is not installed in this sandbox image.")
    if not os.path.exists(a.input):
        sys.exit(f"input not found: {a.input}")
    out_dir = os.path.dirname(os.path.abspath(a.output)) or "."
    os.makedirs(out_dir, exist_ok=True)

    cmd = [
        "pandoc", a.input, "-o", a.output,
        "--pdf-engine=pdflatex",
        "-f", "markdown+tex_math_dollars+pipe_tables+raw_tex+fenced_code_attributes",
        "-V", "documentclass=article",
        "-V", "geometry:margin=1in",
        "-V", "fontsize=11pt",
        "-V", "colorlinks=true", "-V", "linkcolor=RoyalBlue", "-V", "urlcolor=RoyalBlue",
        "--highlight-style=tango",
        "--include-in-header", HEADER,
        "--metadata", f"title={a.title}",
        "--metadata", f"author={a.author}",
        "--resource-path", ".:figures:outputs:data",
    ]
    if a.subtitle:
        cmd += ["--metadata", f"subtitle={a.subtitle}"]
    if a.date:
        cmd += ["--metadata", f"date={a.date}"]
    if not a.no_toc:
        cmd += ["--toc", "--toc-depth=2"]

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(a.output):
        sys.stderr.write((r.stderr or r.stdout or "")[-4000:])
        sys.exit(f"\nPDF build failed (exit {r.returncode}). Read the LaTeX error above and fix the Markdown.")
    print(f"OK: wrote {a.output} ({os.path.getsize(a.output):,} bytes)")


if __name__ == "__main__":
    main()
