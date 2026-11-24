#!/usr/bin/env python3
"""Swap the broken WordPress page-view widget for the static counter.

Idempotent: running it twice leaves the files unchanged. Also called by
prepare_site.py so fresh Simply Static exports get the counter automatically.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "counter"))
from counts import COUNTS  # noqa: E402

PVC_P_RE = re.compile(
    r'(<p\b(?P<attrs>[^>]*\bid=["\']pvc_stats_(?P<key>\d+)["\'][^>]*)>)'
    r'(?P<body>.*?)</p>',
    re.IGNORECASE | re.DOTALL,
)
LOADER_RE = re.compile(r"<img\b[^>]*ajax-loader[^>]*>", re.IGNORECASE)
TEMPLATE_RE = re.compile(
    r"\s*<!--\s*PVC Template\s*-->\s*"
    r'<script\s+type=["\']text/template["\']\s+id=["\']pvc-stats-view-template["\']\s*>.*?</script>',
    re.IGNORECASE | re.DOTALL,
)
AJAX_EXTRA_RE = re.compile(
    r'\s*<script\s+id=["\']a3-pvc-backbone-js-extra["\']\s*>.*?</script>',
    re.IGNORECASE | re.DOTALL,
)
AJAX_SCRIPT_RE = re.compile(
    r'\s*<script\s+id=["\']a3-pvc-backbone-js["\'][^>]*>\s*</script>',
    re.IGNORECASE | re.DOTALL,
)
def head_tags(base: str) -> str:
    prefix = base.rstrip("/")
    return (
        '<link rel="stylesheet" id="nadfink-counter-css" href="{p}/assets/counter.css" media="all">\n'
        '<script id="nadfink-counter-config-js" src="{p}/assets/counter-config.js"></script>\n'
        '<script id="nadfink-counter-js" src="{p}/assets/counter.js" defer></script>\n'
    ).format(p=prefix)


def install_html(text: str, base: str = "") -> str:
    def replace_widget(match: re.Match) -> str:
        attrs = match.group("attrs")
        if "data-counter-key" in attrs:
            return match.group(0)

        key = match.group("key")
        seed = COUNTS.get(key, 0)
        body = match.group("body")
        if LOADER_RE.search(body):
            body = LOADER_RE.sub(
                '<span class="pvc-count" data-seed="{0}">{0}</span>'.format(seed),
                body,
                count=1,
            )
        else:
            # Already replaced the loader but missing the key attribute.
            body = re.sub(
                r'(<span\s+class=["\']pvc-count["\'][^>]*>)',
                r'\1',
                body,
                count=1,
            )

        attrs = re.sub(
            r'(\bid=["\']pvc_stats_\d+["\'])',
            r'\1 data-counter-key="' + key + '"',
            attrs,
            count=1,
        )
        attrs = re.sub(r"\s*pvc_load_by_ajax_update\b", "", attrs)
        return "<p" + attrs + ">" + body + "</p>"

    text = PVC_P_RE.sub(replace_widget, text)
    if "data-counter-key" not in text:
        return text

    text = TEMPLATE_RE.sub("", text)
    text = AJAX_EXTRA_RE.sub("", text)
    text = AJAX_SCRIPT_RE.sub("", text)

    if "nadfink-counter-js" not in text and "</head>" in text:
        text = re.sub(
            r"</head>",
            head_tags(base) + "</head>",
            text,
            count=1,
            flags=re.IGNORECASE,
        )

    return text


def install(root: Path, base: str = "") -> int:
    changed = 0
    for path in sorted(root.rglob("*.html")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        updated = install_html(text, base)
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    return changed


def main() -> None:
    if len(sys.argv) not in (2, 3):
        raise SystemExit(f"usage: {sys.argv[0]} SITE_ROOT [BASE]")
    root = Path(sys.argv[1]).resolve()
    base = sys.argv[2] if len(sys.argv) == 3 else ""
    if not root.is_dir():
        raise SystemExit(f"not a directory: {root}")
    print(f"counter installed in {install(root, base)} file(s) under {root}")


if __name__ == "__main__":
    main()

# coded by Big Pickle
