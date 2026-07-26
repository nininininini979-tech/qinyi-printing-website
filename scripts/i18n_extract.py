#!/usr/bin/env python3
"""Extract stable localization messages from the English HTML templates."""

from __future__ import annotations

import hashlib
import html
import json
import re
from collections import defaultdict
from datetime import date
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / "src" / "pages"
LOCALES = ROOT / "locales"
INDEX = ROOT / "i18n" / "source-index.json"
TRANSLATABLE_ATTRIBUTES = {"alt", "aria-label", "placeholder", "title"}
SKIP_TAGS = {"style"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
UI_MESSAGES = {
    "common.language.label": "Website language",
    "common.menu.open": "Open menu",
    "common.menu.close": "Close menu",
    "common.nav.products": "Products",
    "common.nav.trade": "OEM & Trade Partnership",
    "common.nav.manufacturing": "Manufacturing & Quality",
    "common.nav.projects": "Case Studies",
    "common.nav.company": "Company",
    "common.nav.contact": "Contact",
    "common.nav.privacy": "Privacy & file security",
    "common.nav.quote": "Request a quote",
    "common.form.enquiry_title": "Qinyi Printing enquiry {reference}",
    "common.form.default_product": "Custom paper product",
    "common.form.reference_created": "Reference {reference} created. Your email application will open next; the enquiry is only submitted after you send it.",
    "common.form.not_specified": "not specified",
    "common.rfq.production_brief": "RFQ / Production brief",
    "stats.established": "Established in {year}",
    "stats.facility": "Approximately {area} m² facility",
    "stats.team_members": "More than {count} team members",
    "stats.standard_moq": "Typical MOQ: {count} sets for standard jigsaw projects*",
}


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def is_translatable(value: str) -> bool:
    if not value or not re.search(r"[A-Za-z]", value):
        return False
    if re.fullmatch(r"(?:https?://|mailto:|tel:).+", value):
        return False
    if re.fullmatch(r"[\w.+-]+@[\w.-]+", value):
        return False
    return value not in {"Q", "EN", "DE", "FR", "MOQ", "RFQ", "FAQ"}


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, dict[str, str | None]]] = []
        self.items: list[tuple[str, str]] = []
        self.json_ld = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag not in VOID_TAGS:
            self.stack.append((tag, attributes))
        if tag == "script" and attributes.get("type") == "application/ld+json":
            self.json_ld = True
        for name, value in attrs:
            if name in TRANSLATABLE_ATTRIBUTES and value:
                text = normalize(value)
                if is_translatable(text):
                    self.items.append((f"attribute:{name}", text))
            if tag == "meta" and name == "content" and value:
                marker = attributes.get("name") or attributes.get("property")
                if marker in {"description", "og:title", "og:description"}:
                    text = normalize(value)
                    if is_translatable(text):
                        self.items.append((f"meta:{marker}", text))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "script":
            self.json_ld = False
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_data(self, data):
        if not self.stack:
            return
        tag, attributes = self.stack[-1]
        if tag in SKIP_TAGS:
            return
        if attributes.get("data-i18n-message"):
            return
        if self.json_ld:
            self._extract_json_ld(data)
            return
        if tag == "script":
            return
        text = normalize(data)
        if is_translatable(text):
            self.items.append((f"text:{tag}", text))

    def _extract_json_ld(self, data: str) -> None:
        try:
            payload = json.loads(data)
        except json.JSONDecodeError:
            return

        def walk(value, parent_key=""):
            if isinstance(value, dict):
                for key, child in value.items():
                    if key not in {"@context", "@type", "@id", "url", "item", "email", "telephone", "image"}:
                        walk(child, key)
            elif isinstance(value, list):
                for child in value:
                    walk(child, parent_key)
            elif isinstance(value, str):
                text = normalize(value)
                if is_translatable(text) and parent_key not in {"addressCountry", "foundingDate"}:
                    self.items.append((f"jsonld:{parent_key}", text))

        walk(payload)


def slugify(value: str) -> str:
    value = value.lower().replace("qinyi printing", "qinyi")
    words = re.findall(r"[a-z0-9]+", value)[:7]
    return "_".join(words) or "message"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def load_existing() -> tuple[dict[str, dict], dict[str, str], dict[tuple[str, int, str], str]]:
    if not INDEX.exists():
        return {}, {}, {}
    data = json.loads(INDEX.read_text())
    messages = data.get("messages", {})
    ref_to_key = {}
    for key, entry in messages.items():
        for ref in entry.get("references", []):
            if "position" in ref:
                ref_to_key[(ref["page"], ref["position"], ref["kind"])] = key
    return messages, {entry["source"]: key for key, entry in messages.items()}, ref_to_key


def main() -> None:
    LOCALES.mkdir(exist_ok=True)
    INDEX.parent.mkdir(exist_ok=True)
    existing, source_to_key, ref_to_key = load_existing()
    occurrences: dict[str, list[dict[str, str]]] = defaultdict(list)

    for path in sorted(PAGES.glob("*.html")):
        parser = TextExtractor()
        parser.feed(path.read_text())
        for position, (kind, source) in enumerate(parser.items):
            occurrences[source].append({"page": path.stem, "kind": kind, "position": position})

    for key, source in UI_MESSAGES.items():
        occurrences[source].append({"page": "common", "kind": "javascript", "position": list(UI_MESSAGES).index(key)})
        source_to_key[source] = key

    reserved = set(existing)
    messages: dict[str, dict] = {}
    for source, refs in sorted(occurrences.items(), key=lambda item: (item[1][0]["page"], item[0])):
        key = source_to_key.get(source)
        if not key:
            candidate_keys = {
                ref_to_key.get((ref["page"], ref["position"], ref["kind"]))
                for ref in refs
            } - {None}
            if len(candidate_keys) == 1:
                key = candidate_keys.pop()
        if not key:
            pages = {ref["page"] for ref in refs}
            namespace = "common" if len(pages) > 1 else refs[0]["page"]
            base = f"{namespace}.{slugify(source)}"
            key = base
            counter = 2
            while key in reserved or key in messages:
                key = f"{base}_{counter}"
                counter += 1
        if key in messages and messages[key].get("source") != source:
            key = None
        if not key:
            pages = {ref["page"] for ref in refs}
            namespace = "common" if len(pages) > 1 else refs[0]["page"]
            base = f"{namespace}.{slugify(source)}"
            key = base
            counter = 2
            while key in reserved or key in messages:
                key = f"{base}_{counter}"
                counter += 1
        messages[key] = {
            "source": source,
            "sourceHash": digest(source),
            "references": refs,
        }

    index_payload = {
        "schemaVersion": 1,
        "sourceLocale": "en",
        "messages": dict(sorted(messages.items())),
    }
    INDEX.write_text(json.dumps(index_payload, ensure_ascii=False, indent=2) + "\n")

    en_messages = {
        key: {
            "value": entry["source"],
            "status": "source",
            "sourceHash": entry["sourceHash"],
        }
        for key, entry in sorted(messages.items())
    }
    previous_updated_at = None
    en_path = LOCALES / "en.json"
    if en_path.exists():
        previous_en = json.loads(en_path.read_text())
        if previous_en.get("messages") == en_messages:
            previous_updated_at = previous_en.get("updatedAt")
    en_payload = {
        "locale": "en",
        "languageName": "English",
        "direction": "ltr",
        "updatedAt": previous_updated_at or date.today().isoformat(),
        "messages": en_messages,
    }
    en_path.write_text(json.dumps(en_payload, ensure_ascii=False, indent=2) + "\n")
    print(f"Extracted {len(messages)} messages from {len(list(PAGES.glob('*.html')))} pages.")


if __name__ == "__main__":
    main()
