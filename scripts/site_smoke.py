#!/usr/bin/env python3
"""Dependency-free structural smoke tests for generated locale pages."""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
LOCALES = ["en", "zh-CN", "es", "de", "fr", "ja", "ko", "ar"]


class Inspector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.html_attrs = {}
        self.in_json_ld = False
        self.json_ld_blocks = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "html":
            self.html_attrs = values
        if tag in {"a", "link"} and values.get("href"):
            self.links.append(values["href"])
        if tag in {"img", "script"} and values.get("src"):
            self.links.append(values["src"])
        if tag == "script" and values.get("type") == "application/ld+json":
            self.in_json_ld = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json_ld = False

    def handle_data(self, data):
        if self.in_json_ld and data.strip():
            self.json_ld_blocks.append(data)


def resolve(page: Path, href: str) -> Path | None:
    parsed = urlsplit(href)
    if parsed.scheme or href.startswith(('#', 'mailto:', 'tel:')):
        return None
    target = (page.parent / parsed.path).resolve()
    if parsed.path.endswith('/'):
        target /= "index.html"
    return target


def main() -> None:
    errors = []
    page_count = 0
    for locale in LOCALES:
        pages = sorted((ROOT / locale).glob("*.html"))
        if len(pages) != 13:
            errors.append(f"{locale}: expected 13 pages, found {len(pages)}")
        for page in pages:
            page_count += 1
            content = page.read_text()
            inspector = Inspector()
            inspector.feed(content)
            expected_dir = "rtl" if locale == "ar" else "ltr"
            if inspector.html_attrs.get("lang") != locale or inspector.html_attrs.get("dir") != expected_dir:
                errors.append(f"{page}: incorrect lang/dir")
            for block in inspector.json_ld_blocks:
                try:
                    json.loads(block)
                except json.JSONDecodeError as exc:
                    errors.append(f"{page}: invalid JSON-LD: {exc}")
            for href in inspector.links:
                target = resolve(page, href)
                if target and not target.exists():
                    errors.append(f"{page}: missing local target {href}")
            if "translate.google.com" in content or "googtrans" in content:
                errors.append(f"{page}: Google Translate residue")
            if "https://.." in content:
                errors.append(f"{page}: malformed URL")
            runtime_match = re.search(r'<script>window\.QINYI_I18N=(.*?);</script>', content, re.S)
            if not runtime_match:
                errors.append(f"{page}: missing runtime locale payload")
            else:
                try:
                    runtime = json.loads(runtime_match.group(1))
                    if runtime.get("locale") != locale:
                        errors.append(f"{page}: runtime locale mismatch")
                except json.JSONDecodeError as exc:
                    errors.append(f"{page}: invalid runtime locale payload: {exc}")
            if "support-config.js" not in content:
                errors.append(f"{page}: missing public API configuration")
            if "site-content-runtime.js" not in content:
                errors.append(f"{page}: missing CMS runtime")
            if not re.search(r'<link rel="canonical" href="https://nininininini979-tech\.github\.io/qinyi-printing-website/' + re.escape(locale) + r'/', content):
                errors.append(f"{page}: incorrect canonical")

    support_page = ROOT / "ai-support.html"
    support_content = support_page.read_text()
    for required in ("assets/support.css", "assets/support-config.js", "assets/support-i18n.js", "assets/support.js"):
        if required not in support_content:
            errors.append(f"ai-support.html: missing {required}")

    zh_index = (ROOT / "zh-CN/index.html").read_text()
    if "团队成员超过 80 人" not in zh_index or re.search(r"80\s*岁", zh_index):
        errors.append("zh-CN/index.html: team size is not a natural staff-count phrase")
    ar_index = (ROOT / "ar/index.html").read_text()
    if '<html lang="ar" dir="rtl">' not in ar_index:
        errors.append("ar/index.html: RTL is not enabled")

    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Site smoke test passed: {page_count} localized pages, links and JSON-LD valid.")


if __name__ == "__main__":
    main()
