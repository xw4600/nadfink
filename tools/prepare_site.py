#!/usr/bin/env python3
"""Prepare a Simply Static export for GitHub Pages.

The export is produced by Simply Static in "relative URL" mode, which emits
root-relative paths such as /wp-content/... . Those work at a custom domain
root but not under a project path like /nadfink/. This script prefixes those
paths for staging while leaving JavaScript and SVG files untouched (they use
"/" for string separators, regex literals, and path data).

Usage:
    prepare_site.py --source export --output serve/nadfink --base /nadfink
    prepare_site.py --source export --output site --base "" --cname nadfink.com
"""

import argparse
import os
import re
import shutil
from pathlib import Path

from install_counter import install

TEXT_EXTS = {".html", ".htm", ".css"}
SKIP_DIRS = {".git"}
REPO_ASSETS = Path(__file__).resolve().parent.parent / "assets"

ATTR_RE = re.compile(
    r"(\b(?:href|src|action|poster|content|data-src|data-lazy-src)\s*=\s*[\"'])"
    r"(/)(?!/)",
    re.IGNORECASE,
)
CSS_URL_RE = re.compile(r"(url\(\s*)([\"']?)(/)(?!/)", re.IGNORECASE)
INLINE_STYLE_URL_RE = re.compile(r"(url\(\s*)([\"']?)(/)(?!/)", re.IGNORECASE)
SRCSET_RE = re.compile(r"(srcset\s*=\s*)([\"'])(.*?)(\2)", re.IGNORECASE | re.DOTALL)
ABS_URL_RE = re.compile(r"https?://(?:www\.)?nadfink\.com(?=/|[\"' <])")


def prefix_srcset(value: str, base: str) -> str:
    parts = []
    for part in value.split(","):
        part = part.strip()
        if part.startswith("/") and not part.startswith("//"):
            part = base + part
        parts.append(part)
    return ", ".join(parts)


def rewrite_text(text: str, base: str, ext: str) -> str:
    if not base:
        # At the domain root, Simply Static's root-relative URLs are already
        # correct; only normalize any absolute self-links the export kept.
        return ABS_URL_RE.sub("", text)

    text = ATTR_RE.sub(lambda m: m.group(1) + base + "/", text)

    if ext in {".html", ".htm"}:
        def fix_srcset(m: re.Match) -> str:
            return m.group(1) + m.group(2) + prefix_srcset(m.group(3), base) + m.group(4)

        text = SRCSET_RE.sub(fix_srcset, text)
        # Inline <style> blocks use CSS url(...) syntax.
        text = INLINE_STYLE_URL_RE.sub(lambda m: m.group(1) + m.group(2) + base + "/", text)
    elif ext == ".css":
        text = CSS_URL_RE.sub(lambda m: m.group(1) + m.group(2) + base + "/", text)

    # Normalize any absolute self-links the export kept, after the relative
    # rewrites above so they cannot be prefixed twice.
    return ABS_URL_RE.sub(base, text)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Unzipped Simply Static export")
    parser.add_argument("--output", required=True, type=Path, help="Directory to write the Pages site")
    parser.add_argument("--base", default="/nadfink", help="URL prefix, e.g. /nadfink (empty for domain root)")
    parser.add_argument("--cname", default="", help="Optional CNAME content, e.g. nadfink.com")
    args = parser.parse_args()

    base = args.base.rstrip("/")
    source = args.source.resolve()
    output = args.output.resolve()

    if not source.is_dir():
        raise SystemExit(f"source directory not found: {source}")
    if output == source or source in output.parents:
        raise SystemExit("output must not be inside the source export")

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    for root, dirs, files in os.walk(source):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = Path(root).relative_to(source)
        dest_root = output / rel_root
        dest_root.mkdir(parents=True, exist_ok=True)
        for name in files:
            src = Path(root) / name
            dst = dest_root / name
            ext = src.suffix.lower()
            if ext in TEXT_EXTS:
                text = src.read_text(encoding="utf-8", errors="ignore")
                dst.write_text(rewrite_text(text, base, ext), encoding="utf-8")
            else:
                shutil.copy2(src, dst)

    # Counter assets live in this repository, not in the WordPress export.
    if REPO_ASSETS.is_dir():
        for src in sorted(REPO_ASSETS.rglob("*")):
            if src.is_file():
                dst = output / "assets" / src.relative_to(REPO_ASSETS)
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)

    (output / ".nojekyll").write_text("", encoding="utf-8")

    # The homepage links to /nadfink.com/linux/; WordPress 301s that to
    # /linux/. Preserve that behaviour without relying on server rules.
    legacy = output / "nadfink.com" / "linux" / "index.html"
    legacy.parent.mkdir(parents=True, exist_ok=True)
    legacy.write_text(
        "<!doctype html>\n<meta charset=\"utf-8\">\n"
        "<meta http-equiv=\"refresh\" content=\"0; url=" + base + "/linux/\">\n"
        "<link rel=\"canonical\" href=\"" + base + "/linux/\">\n"
        "<title>Redirecting…</title>\n<p><a href=\"" + base + "/linux/\">Continue to /linux/</a></p>\n",
        encoding="utf-8",
    )

    not_found = output / "404-2" / "index.html"
    if not_found.is_file():
        shutil.copy2(not_found, output / "404.html")
    else:
        raise SystemExit("missing 404-2/index.html in export; cannot build root 404.html")

    if args.cname:
        (output / "CNAME").write_text(args.cname.strip() + "\n", encoding="utf-8")

    install(output, base)

    print(f"built {output} with base={base!r}" + (f" and CNAME={args.cname}" if args.cname else ""))


if __name__ == "__main__":
    main()

# coded by Big Pickle
