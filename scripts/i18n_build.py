#!/usr/bin/env python3
"""Build static localized HTML without translating markup, URLs, or schema keys."""

from __future__ import annotations

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / "src" / "pages"
BASE_URL = "https://nininininini979-tech.github.io/qinyi-printing-website"
LOCALES = ["en", "zh-CN", "es", "de", "fr", "ja", "ko", "ar"]
ASSET_VERSION = "20260727-customizer"
TRANSLATABLE_ATTRIBUTES = {"alt", "aria-label", "placeholder", "title"}
JSON_LD_SKIP_KEYS = {"@context", "@type", "@id", "url", "item", "email", "telephone", "image", "addressCountry", "foundingDate"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def format_message(template: str, attrs: dict[str, str | None], locale: str) -> str:
    def number(value: str) -> str:
        numeric = float(value)
        if numeric.is_integer():
            numeric = int(numeric)
        if locale == "ar":
            table = str.maketrans("0123456789,.", "٠١٢٣٤٥٦٧٨٩٬٫")
            return f"{numeric:,}".translate(table)
        if locale in {"de", "es"}:
            return f"{numeric:,}".replace(",", ".")
        if locale == "fr":
            return f"{numeric:,}".replace(",", " ")
        return f"{numeric:,}"

    replacements = {
        "count": number(attrs.get("data-count") or "0"),
        "area": number(attrs.get("data-area") or "0"),
        "year": attrs.get("data-year-value") or "",
    }
    for key, value in replacements.items():
        template = template.replace(f"{{{key}}}", value)
    return template


class LocalizingParser(HTMLParser):
    def __init__(self, source_messages: dict, target_messages: dict, locale: str):
        super().__init__(convert_charrefs=True)
        self.lookup = {entry["value"]: key for key, entry in source_messages.items()}
        self.target = {key: entry["value"] for key, entry in target_messages.items()}
        self.source = {key: entry["value"] for key, entry in source_messages.items()}
        self.locale = locale
        self.output: list[str] = []
        self.stack: list[tuple[str, dict[str, str | None]]] = []
        self.json_ld = False

    def translated(self, value: str) -> str:
        key = self.lookup.get(normalize(value))
        return self.target.get(key, self.source.get(key, value)) if key else value

    def handle_decl(self, decl):
        self.output.append(f"<!{decl}>")

    def handle_comment(self, data):
        self.output.append(f"<!--{data}-->")

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag not in VOID_TAGS:
            self.stack.append((tag, attributes))
        if tag == "script" and attributes.get("type") == "application/ld+json":
            self.json_ld = True
        self.output.append(self._start_tag(tag, attrs, False))

    def handle_startendtag(self, tag, attrs):
        self.output.append(self._start_tag(tag, attrs, True))

    def _start_tag(self, tag, attrs, closed):
        attributes = dict(attrs)
        rendered = []
        for name, value in attrs:
            if value is None:
                rendered.append(name)
                continue
            translated = value
            if name in TRANSLATABLE_ATTRIBUTES:
                translated = self.translated(value)
            elif tag == "meta" and name == "content":
                marker = attributes.get("name") or attributes.get("property")
                if marker in {"description", "og:title", "og:description"}:
                    translated = self.translated(value)
            rendered.append(f'{name}="{html.escape(translated, quote=True)}"')
        suffix = " /" if closed else ""
        return f"<{tag}{(' ' + ' '.join(rendered)) if rendered else ''}{suffix}>"

    def handle_endtag(self, tag):
        self.output.append(f"</{tag}>")
        if tag == "script":
            self.json_ld = False
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_data(self, data):
        if self.json_ld:
            self.output.append(self._translate_json_ld(data))
            return
        if not self.stack or self.stack[-1][0] in {"script", "style"}:
            self.output.append(data)
            return
        _, attributes = self.stack[-1]
        message_key = attributes.get("data-i18n-message")
        if message_key:
            template = self.target.get(message_key, self.source.get(message_key, data))
            self.output.append(html.escape(format_message(template, attributes, self.locale)))
            return
        normalized = normalize(data)
        translated = self.translated(normalized)
        if translated == normalized:
            self.output.append(data)
            return
        leading = re.match(r"^\s*", data).group(0)
        trailing = re.search(r"\s*$", data).group(0)
        self.output.append(f"{leading}{html.escape(translated)}{trailing}")

    def _translate_json_ld(self, data):
        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            return data

        def walk(value, parent_key=""):
            if isinstance(value, dict):
                return {key: walk(child, key) if key not in JSON_LD_SKIP_KEYS else child for key, child in value.items()}
            if isinstance(value, list):
                return [walk(child, parent_key) for child in value]
            if isinstance(value, str):
                return self.translated(value)
            return value

        return json.dumps(walk(payload), ensure_ascii=False, indent=2)

    def handle_entityref(self, name):
        self.output.append(f"&{name};")

    def handle_charref(self, name):
        self.output.append(f"&#{name};")

    def handle_pi(self, data):
        self.output.append(f"<?{data}>")

    def unknown_decl(self, data):
        self.output.append(f"<![{data}]>")


def translate_html(source_html: str, source_catalog: dict, target_catalog: dict, locale: str) -> str:
    parser = LocalizingParser(source_catalog["messages"], target_catalog["messages"], locale)
    parser.feed(source_html)
    return "".join(parser.output)


def add_seo(page_html: str, locale: str, filename: str) -> str:
    suffix = "" if filename == "index.html" else filename
    canonical = f"{BASE_URL}/{locale}/{suffix}"
    page_html = re.sub(r"\s*<link rel=\"canonical\"[^>]*>", "", page_html, flags=re.I)
    page_html = re.sub(r"\s*<link rel=\"alternate\"[^>]*hreflang[^>]*>", "", page_html, flags=re.I)
    links = [f'<link rel="canonical" href="{canonical}">']
    links.extend(f'<link rel="alternate" hreflang="{code}" href="{BASE_URL}/{code}/{suffix}">' for code in LOCALES)
    links.append(f'<link rel="alternate" hreflang="x-default" href="{BASE_URL}/en/{suffix}">')
    page_html = re.sub(r"(<meta name=\"viewport\"[^>]*>)", rf"\1\n  {' '.join(links)}", page_html, count=1, flags=re.I)
    page_html = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{canonical}">', page_html, flags=re.I)
    page_html = page_html.replace("https://www.qinyipuzzle.com", BASE_URL)
    page_html = re.sub(r'"inLanguage"\s*:\s*"en"', f'"inLanguage": "{locale}"', page_html)
    page_html = re.sub(r'<html\s+lang="[^"]+"(?:\s+dir="[^"]+")?>', f'<html lang="{locale}" dir="{"rtl" if locale == "ar" else "ltr"}">', page_html, count=1, flags=re.I)
    return page_html


def inject_runtime(page_html: str, catalog: dict, locale: str, root_alias: bool) -> str:
    runtime_prefixes = ("common.", "customizer.")
    needed = {
        key: entry["value"]
        for key, entry in catalog["messages"].items()
        if key.startswith(runtime_prefixes)
    }
    payload = json.dumps({"locale": locale, "rootAlias": root_alias, "messages": needed}, ensure_ascii=False).replace("<", "\\u003c")
    pattern = r'(<script src="(?:\.\./)?assets/app\.js(?:\?[^\"]*)?" defer></script>)'
    return re.sub(
        pattern,
        lambda match: f'<script>window.QINYI_I18N={payload};</script>\n  {match.group(1)}',
        page_html,
        count=1,
    )


def localized_assets(page_html: str) -> str:
    return (page_html.replace('href="assets/', 'href="../assets/')
            .replace('src="assets/', 'src="../assets/')
            .replace('href="site.webmanifest"', 'href="../site.webmanifest"'))


def version_runtime_assets(page_html: str) -> str:
    return (page_html
            .replace('assets/styles.css"', f'assets/styles.css?v={ASSET_VERSION}"')
            .replace('assets/customizer.css"', f'assets/customizer.css?v={ASSET_VERSION}"')
            .replace('assets/app.js"', f'assets/app.js?v={ASSET_VERSION}"')
            .replace('assets/customizer.js"', f'assets/customizer.js?v={ASSET_VERSION}"'))


def main() -> None:
    catalogs = {locale: json.loads((ROOT / "locales" / f"{locale}.json").read_text()) for locale in LOCALES}
    html_files = sorted(PAGES.glob("*.html"))
    for locale in LOCALES:
        output_dir = ROOT / locale
        output_dir.mkdir(exist_ok=True)
        for source_path in html_files:
            page_html = translate_html(source_path.read_text(), catalogs["en"], catalogs[locale], locale)
            page_html = add_seo(page_html, locale, source_path.name)
            page_html = version_runtime_assets(inject_runtime(localized_assets(page_html), catalogs[locale], locale, False))
            (output_dir / source_path.name).write_text(page_html)

    for source_path in html_files:
        page_html = translate_html(source_path.read_text(), catalogs["en"], catalogs["en"], "en")
        page_html = add_seo(page_html, "en", source_path.name)
        page_html = version_runtime_assets(inject_runtime(page_html, catalogs["en"], "en", True))
        (ROOT / source_path.name).write_text(page_html)

    entries = []
    for locale in LOCALES:
        for source_path in html_files:
            suffix = "" if source_path.name == "index.html" else source_path.name
            entries.append(f"  <url><loc>{BASE_URL}/{locale}/{suffix}</loc></url>")
    entries.append(f"  <url><loc>{BASE_URL}/ai-support.html</loc></url>")
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(entries) + "\n</urlset>\n")
    print(f"Built {len(LOCALES) * len(html_files)} localized pages plus {len(html_files)} root aliases.")


if __name__ == "__main__":
    main()
